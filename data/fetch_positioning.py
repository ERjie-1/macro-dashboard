#!/usr/bin/env python3
"""
Positioning & Flow Data Pipeline
=================================
Fetches options chain, VIX term structure, CFTC COT positioning,
and ETF fund flow data. Outputs public/data/positioning.json.

Designed to run daily via GitHub Actions at UTC 21:30 (post US market close).
"""

import json
import os
import platform
import ssl
import sys
import time
import io
import zipfile
from datetime import datetime, timedelta, timezone
from math import log, sqrt, exp

import numpy as np
import pandas as pd
import yfinance as yf
from scipy.stats import norm, percentileofscore

# ---------------------------------------------------------------------------
# macOS SSL workaround (same as fetch_data.py)
# ---------------------------------------------------------------------------
if platform.system() == "Darwin":
    ssl._create_default_https_context = ssl._create_unverified_context

# ---------------------------------------------------------------------------
# Constants — SNAPSHOT_PARAMS (pinned for Oreo-aligned verification)
# ---------------------------------------------------------------------------
OPTION_TICKERS = ["SPY", "QQQ", "IWM"]

# Dividend yields (annualised), update quarterly
DIV_YIELDS = {"SPY": 0.013, "QQQ": 0.006, "IWM": 0.012}

# HV window
HV_WINDOW = 21  # trading days

# Gamma Flip scan range
FLIP_RANGE_PCT = 0.10   # ±10% around spot
FLIP_STEP = 1.0          # $1 increments

# VIX tickers (Yahoo Finance symbols)
VIX_TICKERS = {
    "9D":  "^VIX9D",
    "30D": "^VIX",
    "3M":  "^VIX3M",
    "6M":  "^VIX6M",
    "1Y":  "^VIX1Y",
}

SKEW_TICKER = "^SKEW"

# ETF tickers for fund flow proxies
ETF_TICKERS = ["SPY", "QQQ", "TLT", "HYG", "LQD", "GLD", "IWM"]

# CFTC COT contracts (Disaggregated Futures)
COT_CONTRACTS = {
    "ES":  {"code": "13874A", "name": "E-mini S&P 500",      "category": "equity"},
    "NQ":  {"code": "209742", "name": "E-mini Nasdaq-100",    "category": "equity"},
    "ZN":  {"code": "043602", "name": "10Y Treasury Note",    "category": "bond"},
    "ZB":  {"code": "020601", "name": "30Y Treasury Bond",    "category": "bond"},
    "GC":  {"code": "088691", "name": "Gold",                 "category": "commodity"},
    "CL":  {"code": "067651", "name": "Crude Oil WTI",        "category": "commodity"},
    "6E":  {"code": "099741", "name": "Euro FX",              "category": "fx"},
}

TODAY = datetime.now(timezone.utc).date()

# Output path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_PATH = os.path.join(PROJECT_ROOT, "public", "data", "positioning.json")


# ===========================================================================
# Black-Scholes Greeks
# ===========================================================================

def bs_gamma(S: float, K: float, T: float, r: float, sigma: float,
             q: float) -> float:
    """Black-Scholes Gamma (identical for calls and puts)."""
    if T <= 0 or sigma <= 0 or S <= 0:
        return 0.0
    d1 = (log(S / K) + (r - q + sigma**2 / 2) * T) / (sigma * sqrt(T))
    return exp(-q * T) * norm.pdf(d1) / (S * sigma * sqrt(T))


def bs_delta(S: float, K: float, T: float, r: float, sigma: float,
             q: float, option_type: str) -> float:
    """Black-Scholes Delta."""
    if T <= 0 or sigma <= 0 or S <= 0:
        return 0.0
    d1 = (log(S / K) + (r - q + sigma**2 / 2) * T) / (sigma * sqrt(T))
    if option_type == "call":
        return exp(-q * T) * norm.cdf(d1)
    else:
        return exp(-q * T) * (norm.cdf(d1) - 1)


# ===========================================================================
# Risk-free rate from FRED (or fallback)
# ===========================================================================

def get_risk_free_rate() -> float:
    """Get current effective federal funds rate. Fallback to 4.5%."""
    try:
        from fredapi import Fred
        from dotenv import load_dotenv
        load_dotenv()
        api_key = os.getenv("FRED_API_KEY")
        if not api_key:
            print("  WARN: No FRED_API_KEY, using r=0.045 fallback")
            return 0.045
        fred = Fred(api_key=api_key)
        effr = fred.get_series("DFF")
        rate = effr.dropna().iloc[-1] / 100.0
        print(f"  Risk-free rate (EFFR): {rate:.4f}")
        return rate
    except Exception as e:
        print(f"  WARN: FRED failed ({e}), using r=0.045 fallback")
        return 0.045


# ===========================================================================
# Options Chain Analysis
# ===========================================================================

def get_monthly_opex(from_date=None):
    """Find the next monthly OPEX (3rd Friday of the month)."""
    if from_date is None:
        from_date = TODAY
    d = from_date.replace(day=1)
    # Try current month and next month
    for _ in range(3):
        # Find 3rd Friday
        first_day_weekday = d.weekday()
        # First Friday
        first_friday = d + timedelta(days=(4 - first_day_weekday) % 7)
        third_friday = first_friday + timedelta(weeks=2)
        if third_friday >= from_date:
            return third_friday
        # Next month
        if d.month == 12:
            d = d.replace(year=d.year + 1, month=1)
        else:
            d = d.replace(month=d.month + 1)
    return None


def fetch_option_chains(ticker_symbol: str):
    """Fetch all available option chains for a ticker."""
    ticker = yf.Ticker(ticker_symbol)

    # Get price history (60d for HV21 reuse, avoids duplicate fetch in VRP)
    hist = ticker.history(period="60d")
    if hist.empty:
        print(f"  WARN: No price data for {ticker_symbol}")
        return None, None, None, None
    spot = float(hist["Close"].iloc[-1])

    # Get all expiry dates
    try:
        expiries = ticker.options
    except Exception as e:
        print(f"  WARN: No options for {ticker_symbol}: {e}")
        return spot, None, None, hist

    if not expiries:
        print(f"  WARN: No expiry dates for {ticker_symbol}")
        return spot, None, None, hist

    print(f"  {ticker_symbol}: spot=${spot:.2f}, {len(expiries)} expiries")

    all_calls = []
    all_puts = []

    for exp_str in expiries:
        exp_date = datetime.strptime(exp_str, "%Y-%m-%d").date()
        dte = (exp_date - TODAY).days
        if dte <= 0:
            continue

        try:
            chain = ticker.option_chain(exp_str)
            time.sleep(0.5)  # rate limit
        except Exception as e:
            print(f"    WARN: Failed to get chain for {exp_str}: {e}")
            continue

        for df, opt_type in [(chain.calls, "call"), (chain.puts, "put")]:
            df = df.copy()
            df["expiry"] = exp_str
            df["dte"] = dte
            df["T"] = dte / 365.0
            df["option_type"] = opt_type
            if opt_type == "call":
                all_calls.append(df)
            else:
                all_puts.append(df)

    if not all_calls or not all_puts:
        return spot, None, None, hist

    calls_df = pd.concat(all_calls, ignore_index=True)
    puts_df = pd.concat(all_puts, ignore_index=True)

    return spot, calls_df, puts_df, hist


def compute_gex(calls_df, puts_df, spot, r, q):
    """
    Compute Gamma Exposure (vectorised).
    Convention: per-$1-move, call positive (stabilising), put negative (amplifying).
    """
    gex_by_strike = {}
    gex_by_expiry = {}

    for df, sign in [(calls_df, 1), (puts_df, -1)]:
        mask = (df["openInterest"] > 0) & (df["impliedVolatility"] > 0) & (df["T"] > 0)
        valid = df[mask]
        if valid.empty:
            continue

        strikes = valid["strike"].values
        Ts = valid["T"].values
        ivs = valid["impliedVolatility"].values
        ois = valid["openInterest"].values

        with np.errstate(divide="ignore", invalid="ignore"):
            d1 = (np.log(spot / strikes) + (r - q + ivs**2 / 2) * Ts) / (ivs * np.sqrt(Ts))
            gammas = np.exp(-q * Ts) * norm.pdf(d1) / (spot * ivs * np.sqrt(Ts))
            gammas = np.nan_to_num(gammas, 0.0)

        gex_vals = sign * ois * gammas * 100 * spot

        for i, (strike, expiry, gex_val) in enumerate(
            zip(valid["strike"], valid["expiry"], gex_vals)
        ):
            gex_by_strike[strike] = gex_by_strike.get(strike, 0) + gex_val
            gex_by_expiry[expiry] = gex_by_expiry.get(expiry, 0) + gex_val

    total_gex = sum(gex_by_strike.values())
    return total_gex, gex_by_strike, gex_by_expiry


def find_gamma_flip(calls_df, puts_df, spot, r, q):
    """
    Find Gamma Flip price by recalculating total GEX at hypothetical spot prices.
    Gamma is a function of spot, so we must re-derive it at each hypothetical price.
    """
    low = spot * (1 - FLIP_RANGE_PCT)
    high = spot * (1 + FLIP_RANGE_PCT)
    spot_hyps = np.arange(low, high, FLIP_STEP)

    # Combine chains for vectorised access
    all_chains = []
    for df, sign in [(calls_df, 1), (puts_df, -1)]:
        mask = (df["openInterest"] > 0) & (df["impliedVolatility"] > 0) & (df["T"] > 0)
        valid = df[mask][["strike", "T", "impliedVolatility", "openInterest"]].copy()
        valid["sign"] = sign
        all_chains.append(valid)

    if not all_chains:
        return None

    chains = pd.concat(all_chains, ignore_index=True)
    strikes = chains["strike"].values
    Ts = chains["T"].values
    ivs = chains["impliedVolatility"].values
    ois = chains["openInterest"].values
    signs = chains["sign"].values

    gex_curve = []
    for s_hyp in spot_hyps:
        # Vectorised BS gamma calculation
        with np.errstate(divide="ignore", invalid="ignore"):
            d1 = (np.log(s_hyp / strikes) + (r - q + ivs**2 / 2) * Ts) / (ivs * np.sqrt(Ts))
            gammas = np.exp(-q * Ts) * norm.pdf(d1) / (s_hyp * ivs * np.sqrt(Ts))
            gammas = np.nan_to_num(gammas, 0.0)

        total = np.sum(signs * ois * gammas * 100 * s_hyp)
        gex_curve.append(total)

    # Find zero crossing
    gex_arr = np.array(gex_curve)
    for i in range(1, len(gex_arr)):
        if gex_arr[i - 1] * gex_arr[i] < 0:
            # Linear interpolation
            flip = spot_hyps[i - 1] + (spot_hyps[i] - spot_hyps[i - 1]) * \
                   abs(gex_arr[i - 1]) / (abs(gex_arr[i - 1]) + abs(gex_arr[i]))
            return round(float(flip), 2)

    return None


def compute_pcr(calls_df, puts_df, target_expiry=None):
    """Compute Put/Call Ratio for a specific expiry and all expiries."""
    result = {}

    # All expiries aggregation
    total_put_oi = puts_df["openInterest"].sum()
    total_call_oi = calls_df["openInterest"].sum()
    total_put_vol = puts_df["volume"].fillna(0).sum()
    total_call_vol = calls_df["volume"].fillna(0).sum()

    result["allExpOiRatio"] = round(total_put_oi / max(total_call_oi, 1), 2)
    result["allExpVolRatio"] = round(total_put_vol / max(total_call_vol, 1), 2)

    # Target expiry (monthly OPEX)
    if target_expiry:
        exp_str = str(target_expiry)
        t_calls = calls_df[calls_df["expiry"] == exp_str]
        t_puts = puts_df[puts_df["expiry"] == exp_str]

        t_put_oi = t_puts["openInterest"].sum()
        t_call_oi = t_calls["openInterest"].sum()
        t_put_vol = t_puts["volume"].fillna(0).sum()
        t_call_vol = t_calls["volume"].fillna(0).sum()

        result["targetExpiry"] = exp_str
        result["oiRatio"] = round(t_put_oi / max(t_call_oi, 1), 2)
        result["volRatio"] = round(t_put_vol / max(t_call_vol, 1), 2)
    else:
        result["targetExpiry"] = ""
        result["oiRatio"] = result["allExpOiRatio"]
        result["volRatio"] = result["allExpVolRatio"]

    return result


def compute_skew_and_vrp(calls_df, puts_df, spot, r, q, price_hist,
                         target_expiry=None):
    """
    Compute 25Δ Risk Reversal (Skew) and VRP.
    Uses the target expiry chain for skew calculation.
    """
    skew_result = {"riskReversal25d": 0, "putIV25d": 0, "callIV25d": 0, "atmIV": 0}
    vrp_result = {"iv": 0, "hv21": 0, "premium": 0}

    # Select chain for target expiry (or closest monthly)
    exp_str = str(target_expiry) if target_expiry else None
    if exp_str:
        t_calls = calls_df[calls_df["expiry"] == exp_str].copy()
        t_puts = puts_df[puts_df["expiry"] == exp_str].copy()
    else:
        t_calls = calls_df.copy()
        t_puts = puts_df.copy()

    if t_calls.empty or t_puts.empty:
        return skew_result, vrp_result

    # ATM IV: closest strike to spot
    t_calls_valid = t_calls[t_calls["impliedVolatility"] > 0]
    if not t_calls_valid.empty:
        atm_idx = (t_calls_valid["strike"] - spot).abs().idxmin()
        atm_iv = t_calls_valid.loc[atm_idx, "impliedVolatility"] * 100
    else:
        atm_iv = 0

    # 25Δ Skew: find strikes with delta ≈ 0.25
    # For calls: find strike where delta ≈ 0.25
    # For puts: find strike where delta ≈ -0.25
    T_val = t_calls["T"].iloc[0] if not t_calls.empty else 30 / 365.0

    call_25d_iv = 0
    put_25d_iv = 0

    # Compute deltas for all call strikes
    if not t_calls_valid.empty:
        call_deltas = []
        for _, row in t_calls_valid.iterrows():
            d = bs_delta(spot, row["strike"], row["T"], r,
                         row["impliedVolatility"], q, "call")
            call_deltas.append({"strike": row["strike"], "delta": d,
                                "iv": row["impliedVolatility"] * 100})
        call_delta_df = pd.DataFrame(call_deltas)

        # Find 25Δ call (interpolate)
        above = call_delta_df[call_delta_df["delta"] >= 0.25]
        below = call_delta_df[call_delta_df["delta"] < 0.25]
        if not above.empty and not below.empty:
            closest_above = above.loc[(above["delta"] - 0.25).abs().idxmin()]
            closest_below = below.loc[(below["delta"] - 0.25).abs().idxmin()]
            # Linear interpolation
            w = abs(closest_above["delta"] - 0.25) / max(
                abs(closest_above["delta"] - closest_below["delta"]), 1e-6)
            call_25d_iv = closest_above["iv"] * (1 - w) + closest_below["iv"] * w

    # Compute deltas for all put strikes
    t_puts_valid = t_puts[t_puts["impliedVolatility"] > 0]
    if not t_puts_valid.empty:
        put_deltas = []
        for _, row in t_puts_valid.iterrows():
            d = bs_delta(spot, row["strike"], row["T"], r,
                         row["impliedVolatility"], q, "put")
            put_deltas.append({"strike": row["strike"], "delta": d,
                               "iv": row["impliedVolatility"] * 100})
        put_delta_df = pd.DataFrame(put_deltas)

        # Find 25Δ put (delta ≈ -0.25)
        above = put_delta_df[put_delta_df["delta"] >= -0.25]
        below = put_delta_df[put_delta_df["delta"] < -0.25]
        if not above.empty and not below.empty:
            closest_above = above.loc[(above["delta"] + 0.25).abs().idxmin()]
            closest_below = below.loc[(below["delta"] + 0.25).abs().idxmin()]
            w = abs(closest_above["delta"] + 0.25) / max(
                abs(closest_above["delta"] - closest_below["delta"]), 1e-6)
            put_25d_iv = closest_above["iv"] * (1 - w) + closest_below["iv"] * w

    risk_reversal = round(put_25d_iv - call_25d_iv, 2)

    skew_result = {
        "riskReversal25d": risk_reversal,
        "putIV25d": round(put_25d_iv, 2),
        "callIV25d": round(call_25d_iv, 2),
        "atmIV": round(atm_iv, 2),
    }

    # VRP = ATM IV - HV21 (reuse price_hist passed from fetch_option_chains)
    hv21 = 0
    if price_hist is not None and len(price_hist) >= HV_WINDOW:
        returns = price_hist["Close"].pct_change().dropna()
        hv21 = returns.tail(HV_WINDOW).std() * sqrt(252) * 100

    vrp_result = {
        "iv": round(atm_iv, 2),
        "hv21": round(hv21, 2),
        "premium": round(atm_iv - hv21, 2),
    }

    return skew_result, vrp_result


def compute_max_pain(calls_df, puts_df, target_expiry):
    """Compute Max Pain for a target expiry (vectorised)."""
    exp_str = str(target_expiry)
    t_calls = calls_df[calls_df["expiry"] == exp_str]
    t_puts = puts_df[puts_df["expiry"] == exp_str]

    if t_calls.empty and t_puts.empty:
        return 0

    all_strikes = np.array(sorted(set(
        list(t_calls["strike"].unique()) + list(t_puts["strike"].unique())
    )))

    call_strikes = t_calls["strike"].values
    call_oi = t_calls["openInterest"].values
    put_strikes = t_puts["strike"].values
    put_oi = t_puts["openInterest"].values

    # For each test_price, compute total pain vectorised
    # call_pain = sum(max(test_price - call_strike, 0) * call_oi)
    # put_pain  = sum(max(put_strike - test_price, 0) * put_oi)
    pain = np.zeros(len(all_strikes))
    for i, tp in enumerate(all_strikes):
        call_pain = np.maximum(tp - call_strikes, 0) @ call_oi
        put_pain = np.maximum(put_strikes - tp, 0) @ put_oi
        pain[i] = call_pain + put_pain

    return float(all_strikes[np.argmin(pain)])


def compute_key_levels(calls_df, puts_df, target_expiry):
    """Find Put Wall, Call Wall, and top OI levels."""
    exp_str = str(target_expiry)
    t_calls = calls_df[calls_df["expiry"] == exp_str]
    t_puts = puts_df[puts_df["expiry"] == exp_str]

    # Put Wall = strike with max put OI
    put_wall = {"strike": 0, "oi": 0}
    if not t_puts.empty:
        max_put_idx = t_puts["openInterest"].idxmax()
        put_wall = {
            "strike": float(t_puts.loc[max_put_idx, "strike"]),
            "oi": int(t_puts.loc[max_put_idx, "openInterest"]),
        }

    # Call Wall = strike with max call OI
    call_wall = {"strike": 0, "oi": 0}
    if not t_calls.empty:
        max_call_idx = t_calls["openInterest"].idxmax()
        call_wall = {
            "strike": float(t_calls.loc[max_call_idx, "strike"]),
            "oi": int(t_calls.loc[max_call_idx, "openInterest"]),
        }

    # Top 10 OI levels across calls and puts
    top_levels = []
    for df, opt_type in [(t_calls, "call"), (t_puts, "put")]:
        if df.empty:
            continue
        top = df.nlargest(5, "openInterest")
        for _, row in top.iterrows():
            top_levels.append({
                "strike": float(row["strike"]),
                "type": opt_type,
                "oi": int(row["openInterest"]),
            })

    top_levels.sort(key=lambda x: x["oi"], reverse=True)
    top_levels = top_levels[:10]

    return {
        "putWall": put_wall,
        "callWall": call_wall,
        "topLevels": top_levels,
    }


def analyse_ticker(ticker_symbol: str, r: float):
    """Full options analysis for one ticker."""
    print(f"\n  Analysing {ticker_symbol}...")
    q = DIV_YIELDS.get(ticker_symbol, 0.01)

    spot, calls_df, puts_df, price_hist = fetch_option_chains(ticker_symbol)
    if spot is None or calls_df is None or puts_df is None:
        print(f"  WARN: Skipping {ticker_symbol}, no chain data")
        return None

    target_opex = get_monthly_opex()
    target_expiry_str = str(target_opex) if target_opex else None

    # GEX
    print(f"    Computing GEX...")
    total_gex, gex_by_strike, gex_by_expiry = compute_gex(calls_df, puts_df, spot, r, q)
    flip_price = find_gamma_flip(calls_df, puts_df, spot, r, q)
    print(f"    Total GEX: ${total_gex/1e9:.2f}B, Flip: {flip_price}")

    # Format GEX by strike for chart (top 40 strikes by absolute GEX)
    sorted_strikes = sorted(gex_by_strike.items(), key=lambda x: abs(x[1]), reverse=True)[:40]
    sorted_strikes.sort(key=lambda x: x[0])  # re-sort by strike for chart
    gex_by_strike_list = [{"strike": float(k), "gex": round(v, 0)}
                          for k, v in sorted_strikes]

    gex_by_expiry_list = [
        {"expiry": k, "gex": round(v, 0),
         "dte": (datetime.strptime(k, "%Y-%m-%d").date() - TODAY).days}
        for k, v in sorted(gex_by_expiry.items())
    ]

    # PCR
    print(f"    Computing PCR...")
    pcr = compute_pcr(calls_df, puts_df, target_opex)

    # Skew & VRP
    print(f"    Computing Skew & VRP...")
    skew, vrp = compute_skew_and_vrp(calls_df, puts_df, spot, r, q,
                                      price_hist, target_opex)

    # Max Pain
    print(f"    Computing Max Pain...")
    max_pain = compute_max_pain(calls_df, puts_df, target_opex) if target_opex else 0

    # Key Levels
    print(f"    Computing Key Levels...")
    key_levels = compute_key_levels(calls_df, puts_df, target_opex) if target_opex else {
        "putWall": {"strike": 0, "oi": 0},
        "callWall": {"strike": 0, "oi": 0},
        "topLevels": [],
    }

    return {
        "spot": round(spot, 2),
        "gex": {
            "total": round(total_gex, 0),
            "byExpiry": gex_by_expiry_list,
            "byStrike": gex_by_strike_list,
            "flipPrice": flip_price,
        },
        "pcr": pcr,
        "skew": skew,
        "vrp": vrp,
        "maxPain": max_pain,
        "keyLevels": key_levels,
    }


# ===========================================================================
# VIX Term Structure & SKEW
# ===========================================================================

def fetch_vix_term_structure():
    """Fetch VIX term structure and SKEW index."""
    print("\n--- VIX Term Structure ---")

    # Download VIX family
    vix_symbols = list(VIX_TICKERS.values()) + [SKEW_TICKER]
    try:
        raw = yf.download(vix_symbols, period="1y", auto_adjust=True, progress=False)
    except Exception as e:
        print(f"  WARN: VIX download failed: {e}")
        return _empty_vix(), _empty_skew()

    # Current values
    points = []
    for tenor, symbol in VIX_TICKERS.items():
        try:
            if isinstance(raw.columns, pd.MultiIndex):
                series = raw["Close"][symbol].dropna()
            else:
                series = raw["Close"].dropna()
            if not series.empty:
                points.append({"tenor": tenor, "value": round(float(series.iloc[-1]), 2)})
        except Exception:
            pass

    # Sort by tenor order
    tenor_order = {"1D": 0, "9D": 1, "30D": 2, "3M": 3, "6M": 4, "1Y": 5}
    points.sort(key=lambda p: tenor_order.get(p["tenor"], 99))

    # Determine shape
    vix_30d = next((p["value"] for p in points if p["tenor"] == "30D"), None)
    vix_3m = next((p["value"] for p in points if p["tenor"] == "3M"), None)
    if vix_30d and vix_3m:
        if vix_30d > vix_3m * 1.02:
            shape = "backwardation"
        elif vix_30d < vix_3m * 0.98:
            shape = "contango"
        else:
            shape = "mixed"
    else:
        shape = "mixed"

    # VIX 1Y percentile
    vix_pct = 50.0
    try:
        if isinstance(raw.columns, pd.MultiIndex):
            vix_hist = raw["Close"]["^VIX"].dropna()
        else:
            vix_hist = raw["Close"].dropna()
        if len(vix_hist) > 20 and vix_30d:
            vix_pct = round(percentileofscore(vix_hist.values, vix_30d, kind="rank"), 1)
    except Exception:
        pass

    # 90-day history (VIX vs VIX3M)
    history_90d = []
    try:
        if isinstance(raw.columns, pd.MultiIndex):
            vix_s = raw["Close"]["^VIX"].dropna().tail(90)
            vix3m_s = raw["Close"]["^VIX3M"].dropna().tail(90)
        else:
            vix_s = pd.Series(dtype=float)
            vix3m_s = pd.Series(dtype=float)

        if not vix_s.empty and not vix3m_s.empty:
            merged = pd.DataFrame({"vix": vix_s, "vix3m": vix3m_s}).dropna()
            for date, row in merged.iterrows():
                history_90d.append({
                    "date": date.strftime("%b %d"),
                    "vix": round(float(row["vix"]), 2),
                    "vix3m": round(float(row["vix3m"]), 2),
                })
    except Exception:
        pass

    vix_result = {
        "points": points,
        "shape": shape,
        "vixPercentile1Y": vix_pct,
        "history90D": history_90d,
    }

    # SKEW Index
    skew_result = _empty_skew()
    try:
        if isinstance(raw.columns, pd.MultiIndex):
            skew_s = raw["Close"][SKEW_TICKER].dropna()
        else:
            skew_s = pd.Series(dtype=float)

        if not skew_s.empty:
            current_skew = round(float(skew_s.iloc[-1]), 2)
            skew_1y = skew_s.tail(252)
            skew_pct = round(percentileofscore(skew_1y.values, current_skew, kind="rank"), 1)
            skew_hist = [{"date": d.strftime("%b %d"), "value": round(float(v), 2)}
                         for d, v in skew_s.tail(90).items()]
            skew_result = {
                "current": current_skew,
                "percentile1Y": skew_pct,
                "history90D": skew_hist,
            }
    except Exception:
        pass

    print(f"  VIX points: {len(points)}, shape: {shape}, SKEW: {skew_result.get('current', 'N/A')}")
    return vix_result, skew_result


def _empty_vix():
    return {"points": [], "shape": "mixed", "vixPercentile1Y": 50.0, "history90D": []}


def _empty_skew():
    return {"current": 0, "percentile1Y": 50.0, "history90D": []}


# ===========================================================================
# CFTC COT Positioning
# ===========================================================================

def fetch_cot_data():
    """Download and parse CFTC Traders in Financial Futures (TFF) report."""
    print("\n--- CFTC COT Data ---")

    # Financial Futures report: equity indices, bonds, FX
    # For commodities (GC, CL): use Disaggregated Futures report
    year = TODAY.year
    as_of = ""
    contracts = {}

    # --- Financial Futures (ES, NQ, ZN, ZB, 6E) ---
    fin_url = f"https://www.cftc.gov/files/dea/history/fut_fin_txt_{year}.zip"
    print(f"  Downloading TFF from {fin_url}...")
    fin_df = _download_cot_zip(fin_url)

    if fin_df is not None:
        fin_contracts = {k: v for k, v in COT_CONTRACTS.items()
                         if v["category"] in ("equity", "bond", "fx")}
        for key, info in fin_contracts.items():
            result = _parse_cot_contract(fin_df, info["code"], info, report_type="tff")
            contracts[key] = result
            if result["history"]:
                as_of = result["history"][-1]["date"]

    # --- Disaggregated Futures (GC, CL) ---
    disagg_url = f"https://www.cftc.gov/files/dea/history/fut_disagg_txt_{year}.zip"
    print(f"  Downloading Disaggregated from {disagg_url}...")
    disagg_df = _download_cot_zip(disagg_url)

    if disagg_df is not None:
        comm_contracts = {k: v for k, v in COT_CONTRACTS.items()
                          if v["category"] == "commodity"}
        for key, info in comm_contracts.items():
            result = _parse_cot_contract(disagg_df, info["code"], info, report_type="disagg")
            contracts[key] = result
            if result["history"] and not as_of:
                as_of = result["history"][-1]["date"]

    # Fill missing contracts
    for key, info in COT_CONTRACTS.items():
        if key not in contracts:
            contracts[key] = _empty_cot_contract(info)

    return {"asOfDate": as_of, "contracts": contracts}


def _download_cot_zip(url):
    """Download and parse a CFTC ZIP file."""
    try:
        import urllib.request
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; MacroDashboard/1.0)",
        })
        response = urllib.request.urlopen(req, timeout=60)
        zip_data = response.read()
        with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
            csv_name = zf.namelist()[0]
            with zf.open(csv_name) as f:
                df = pd.read_csv(f)
        print(f"    Downloaded {len(df)} rows")
        return df
    except Exception as e:
        print(f"    WARN: Download failed: {e}")
        return None


def _parse_cot_contract(df, code, info, report_type="tff"):
    """Parse a single contract from COT data."""
    mask = df["CFTC_Contract_Market_Code"].astype(str).str.strip() == code
    contract_df = df[mask].copy()

    if contract_df.empty:
        print(f"    {info['name']} ({code}): no data found")
        return _empty_cot_contract(info)

    # Parse dates
    date_col = "Report_Date_as_YYYY-MM-DD"
    if date_col not in contract_df.columns:
        candidates = [c for c in contract_df.columns if "Date" in c and "YYYY" in c]
        if not candidates:
            print(f"    WARN: No date column found for {info['name']}")
            return _empty_cot_contract(info)
        date_col = candidates[0]

    contract_df["date"] = pd.to_datetime(contract_df[date_col], format="mixed")
    contract_df = contract_df.sort_values("date")
    recent = contract_df.tail(52)

    # Column mapping depends on report type
    if report_type == "tff":
        # Traders in Financial Futures
        lev_l = "Lev_Money_Positions_Long_All"
        lev_s = "Lev_Money_Positions_Short_All"
        am_l = "Asset_Mgr_Positions_Long_All"
        am_s = "Asset_Mgr_Positions_Short_All"
        dl_l = "Dealer_Positions_Long_All"
        dl_s = "Dealer_Positions_Short_All"
    else:
        # Disaggregated: Managed Money ≈ Leveraged, Swap Dealer ≈ Dealer
        lev_l = "M_Money_Positions_Long_All"
        lev_s = "M_Money_Positions_Short_All"
        am_l = "Other_Rept_Positions_Long_All"
        am_s = "Other_Rept_Positions_Short_All"
        dl_l = "Swap_Positions_Long_All"
        dl_s = "Swap__Positions_Short_All"

    def safe_net(row, long_col, short_col):
        try:
            return int(row[long_col]) - int(row[short_col])
        except (KeyError, ValueError, TypeError):
            return 0

    last = recent.iloc[-1]
    lev_net = safe_net(last, lev_l, lev_s)
    am_net = safe_net(last, am_l, am_s)
    dl_net = safe_net(last, dl_l, dl_s)

    # Week change
    lev_chg = 0
    if len(recent) >= 2:
        prev = recent.iloc[-2]
        lev_chg = lev_net - safe_net(prev, lev_l, lev_s)

    # History
    history = []
    for _, row in recent.iterrows():
        history.append({
            "date": row["date"].strftime("%Y-%m-%d"),
            "leveragedNet": safe_net(row, lev_l, lev_s),
            "assetMgrNet": safe_net(row, am_l, am_s),
        })

    print(f"    {info['name']}: LevNet={lev_net:+,}, AssetMgr={am_net:+,}, Dealer={dl_net:+,}")

    return {
        "name": info["name"],
        "category": info["category"],
        "leveragedNet": lev_net,
        "assetMgrNet": am_net,
        "dealerNet": dl_net,
        "leveragedNetChg": lev_chg,
        "history": history,
    }



def _empty_cot_contract(info):
    return {
        "name": info["name"],
        "category": info["category"],
        "leveragedNet": 0,
        "assetMgrNet": 0,
        "dealerNet": 0,
        "leveragedNetChg": 0,
        "history": [],
    }


# ===========================================================================
# ETF Fund Flows (proxy indicators)
# ===========================================================================

def fetch_etf_flows():
    """Compute OBV, MFI, and Volume vs Avg for key ETFs."""
    print("\n--- ETF Fund Flows ---")

    try:
        raw = yf.download(ETF_TICKERS, period="90d", auto_adjust=True, progress=False)
    except Exception as e:
        print(f"  WARN: ETF download failed: {e}")
        return {}

    flows = {}
    for ticker in ETF_TICKERS:
        try:
            if isinstance(raw.columns, pd.MultiIndex):
                close = raw["Close"][ticker].dropna()
                volume = raw["Volume"][ticker].dropna()
                high = raw["High"][ticker].dropna()
                low = raw["Low"][ticker].dropna()
            else:
                close = raw["Close"].dropna()
                volume = raw["Volume"].dropna()
                high = raw["High"].dropna()
                low = raw["Low"].dropna()

            if close.empty or len(close) < 20:
                continue

            # Align all series
            idx = close.index.intersection(volume.index).intersection(
                high.index).intersection(low.index)
            close = close[idx]
            volume = volume[idx]
            high = high[idx]
            low = low[idx]

            # OBV (On-Balance Volume)
            price_change = close.diff()
            obv_direction = price_change.apply(
                lambda x: 1 if x > 0 else (-1 if x < 0 else 0))
            obv = (volume * obv_direction).cumsum()

            # MFI (Money Flow Index, 14 days)
            typical_price = (high + low + close) / 3
            raw_money_flow = typical_price * volume
            tp_diff = typical_price.diff()

            pos_flow = raw_money_flow.where(tp_diff > 0, 0).rolling(14).sum()
            neg_flow = raw_money_flow.where(tp_diff < 0, 0).rolling(14).sum()
            mfi = 100 - (100 / (1 + pos_flow / neg_flow.replace(0, 1e-10)))

            # Volume vs 20D Average
            vol_avg_20 = volume.rolling(20).mean()
            vol_vs_avg = volume / vol_avg_20.replace(0, 1e-10)

            # 30-day history
            history_30d = []
            for i in range(-min(30, len(obv)), 0):
                date = obv.index[i]
                history_30d.append({
                    "date": date.strftime("%b %d"),
                    "obv": round(float(obv.iloc[i]), 0),
                    "mfi": round(float(mfi.iloc[i]), 1) if not pd.isna(mfi.iloc[i]) else 50,
                })

            flows[ticker] = {
                "name": ticker,
                "obv": round(float(obv.iloc[-1]), 0),
                "mfi14": round(float(mfi.iloc[-1]), 1) if not pd.isna(mfi.iloc[-1]) else 50,
                "volumeVsAvg": round(float(vol_vs_avg.iloc[-1]), 2),
                "history30D": history_30d,
            }

            print(f"  {ticker}: OBV={obv.iloc[-1]:,.0f}, MFI={mfi.iloc[-1]:.1f}, "
                  f"Vol/Avg={vol_vs_avg.iloc[-1]:.2f}x")

        except Exception as e:
            print(f"  WARN: {ticker} failed: {e}")
            continue

    return flows


# ===========================================================================
# Main
# ===========================================================================

def main():
    print("=" * 60)
    print(f"Positioning & Flow Pipeline — {TODAY}")
    print("=" * 60)

    # Risk-free rate
    r = get_risk_free_rate()

    # --- Options Analysis ---
    print("\n--- Options Chain Analysis ---")
    options_data = {}
    for ticker in OPTION_TICKERS:
        result = analyse_ticker(ticker, r)
        if result:
            options_data[ticker] = result

    # --- VIX Term Structure ---
    vix_data, skew_data = fetch_vix_term_structure()

    # --- CFTC COT ---
    cot_data = fetch_cot_data()

    # --- ETF Flows ---
    etf_flows = fetch_etf_flows()

    # --- Assemble output ---
    positioning = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "vixTermStructure": vix_data,
        "skewIndex": skew_data,
        "options": options_data,
        "cot": cot_data,
        "etfFlows": etf_flows,
    }

    # Write JSON
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(positioning, f, indent=2, default=str)

    print(f"\n{'=' * 60}")
    print(f"Output written to {OUTPUT_PATH}")
    file_size = os.path.getsize(OUTPUT_PATH)
    print(f"File size: {file_size / 1024:.1f} KB")
    print(f"Tickers: {list(options_data.keys())}")
    print(f"COT contracts: {list(cot_data.get('contracts', {}).keys())}")
    print(f"ETF flows: {list(etf_flows.keys())}")
    print("=" * 60)


if __name__ == "__main__":
    main()
