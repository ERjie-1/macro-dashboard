"""
Macro-Economic Dashboard — Data Fetcher & Scorer
Fetches FRED + Yahoo Finance data, computes derived factors, scores them,
and writes public/data/dashboard.json for the Next.js frontend.

Usage:
  cd macro-dashboard/data
  python fetch_data.py
"""

import os
import ssl
import json
import math
import warnings
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf
from dotenv import load_dotenv
from fredapi import Fred
from scipy.stats import percentileofscore

warnings.filterwarnings("ignore")

# Fix macOS SSL certificate verification issue (not needed on Linux/CI)
import platform
if platform.system() == "Darwin":
    ssl._create_default_https_context = ssl._create_unverified_context

# ── Config ──────────────────────────────────────────────────────────────────

load_dotenv(Path(__file__).parent / ".env")
FRED_API_KEY = os.getenv("FRED_API_KEY", "")
if not FRED_API_KEY:
    raise ValueError("FRED_API_KEY not set in data/.env")

fred = Fred(api_key=FRED_API_KEY)

TODAY = datetime.today().date()
START_5Y = TODAY - timedelta(days=365 * 5 + 90)   # 5Y + buffer for rolling
START_RAW = TODAY - timedelta(days=365 * 5 + 200)
OUTPUT_PATH = Path(__file__).parent.parent / "public" / "data" / "dashboard.json"

# ── Module weights ───────────────────────────────────────────────────────────

MODULE_WEIGHTS = {k: 1/7 for k in [
    "liquidity", "funding", "treasury", "rates", "credit", "risk", "external",
]}

MODULE_COLORS = {
    "liquidity": "#ef4444",
    "funding":   "#f97316",
    "treasury":  "#f97316",
    "rates":     "#14b8a6",
    "credit":    "#14b8a6",
    "risk":      "#f97316",
    "external":  "#f97316",
}

# Factor weights within each module (from bhadial.com reference)
FACTOR_WEIGHTS = {
    "liquidity": {
        "fed-net-liquidity": 0.30, "bank-reserves": 0.20,
        "net-liquidity-momentum": 0.25, "tga-deviation": 0.15,
        "on-rrp-buffer-risk": 0.10,
    },
    "funding": {
        "collateral-repo-friction": 0.18, "corridor-friction-1": 0.22,
        "corridor-friction-2": 0.18, "effr-iorb-spread": 0.12,
        "cp-tbill-spread": 0.20, "funding-fragmentation": 0.10,
    },
    "treasury": {
        "30y-10y-term-premium": 0.35, "10y-rate-volatility": 0.35,
        "curve-curvature": 0.30,
    },
    "rates": {
        "real-rate-level": 0.50, "real-curve": 0.15,
        "10y-breakeven": 0.35,
    },
    "credit": {
        "nfci": 0.40, "hy-credit": 0.25,
        "ig-credit": 0.15, "regional-banks-spy": 0.20,
    },
    "risk": {
        "vix": 0.30, "vix-term-structure": 0.25,
        "risk-vs-safe": 0.25, "high-beta-preference": 0.20,
    },
    "external": {
        "dxy": 0.25, "fx-realized-volatility": 0.20,
        "wti-oil": 0.20, "oil-volatility-deviation": 0.25,
        "natural-gas": 0.10,
    },
}

# Factors where lower raw value = better conditions (score = 100 - percentile)
INVERT_FACTORS = {
    "tga-deviation", "on-rrp-buffer-risk",
    "collateral-repo-friction",                        # SOFR>OBFR = repo stress = restrictive
    "corridor-friction-1", "corridor-friction-2",
    "effr-iorb-spread", "cp-tbill-spread",
    "funding-fragmentation", "10y-rate-volatility",
    # "curve-curvature" removed: bhadial treats low curvature as restrictive (raw pct used directly)
    "real-rate-level",
    "nfci", "vix", "vix-term-structure",
    "fx-realized-volatility", "oil-volatility-deviation",
    # "wti-oil" removed: bhadial treats low oil price as restrictive (demand signal)
    "natural-gas",
    "dxy",                                             # strong dollar = tighter global conditions
    "10y-breakeven",                                   # bhadial API shows direction=null but pctl=79.6 confirms inversion
}

# ── Helpers ──────────────────────────────────────────────────────────────────

def safe_last(s: pd.Series, fallback=float("nan")):
    """Return last non-NaN value from series."""
    s = s.dropna()
    return float(s.iloc[-1]) if len(s) > 0 else fallback


def rel_log_return(price_a: pd.Series, price_b: pd.Series, window: int = 63) -> pd.Series:
    """Relative log return: log(A/A[-window]) - log(B/B[-window])."""
    la = np.log(price_a)
    lb = np.log(price_b)
    return (la - la.shift(window)) - (lb - lb.shift(window))


def realized_vol(returns: pd.Series, window: int, annualize: int = 252) -> pd.Series:
    """Rolling realized volatility, annualized."""
    return returns.rolling(window).std() * math.sqrt(annualize)


def pct_rank(series: pd.Series, lookback_years: int = 5) -> float:
    """Current percentile within the past N years of daily data."""
    cutoff = TODAY - timedelta(days=lookback_years * 365)
    hist = series[series.index >= pd.Timestamp(cutoff)].dropna()
    if len(hist) < 2:
        return 50.0
    current = float(hist.iloc[-1])
    return float(percentileofscore(hist.values, current, kind="rank"))


def score_from_pct(raw_pct: float, factor_id: str) -> float:
    score = (100 - raw_pct) if factor_id in INVERT_FACTORS else raw_pct
    return round(max(0.0, min(100.0, score)), 1)


def get_status(score: float) -> str:
    if score >= 66:
        return "supportive"
    if score >= 33:
        return "neutral"
    return "restrictive"


def get_velocity(series: pd.Series, window: int = 7) -> str:
    s = series.dropna()
    if len(s) < window + 1:
        return "flat"
    now = float(s.iloc[-1])
    past = float(s.iloc[-window - 1])
    diff = now - past
    if diff > 2:
        return "rising"
    if diff < -2:
        return "falling"
    return "flat"


def build_trend_data(series: pd.Series, days: int = 90) -> list:
    """Last N days of (date, value) for the frontend trend chart."""
    s = series.dropna().tail(days)
    result = []
    for dt, val in s.items():
        result.append({
            "date": pd.Timestamp(dt).strftime("%-m/%-d"),
            "value": round(float(val), 4),
        })
    return result


def build_score_trend(score_series: pd.Series, days: int = 90) -> list:
    """Trend data for module/overall score history."""
    return build_trend_data(score_series, days)


def percentile_dist(series: pd.Series, lookback_years: int = 5) -> list:
    """10-bucket histogram of historical distribution."""
    cutoff = TODAY - timedelta(days=lookback_years * 365)
    hist = series[series.index >= pd.Timestamp(cutoff)].dropna()
    buckets = [f"{i*10}-{(i+1)*10}" for i in range(10)]
    result = []
    for i, label in enumerate(buckets):
        lo, hi = i * 10, (i + 1) * 10
        mask = (hist >= np.percentile(hist, lo)) & (hist < np.percentile(hist, min(hi, 99.9)))
        result.append({"range": label, "freq": int(mask.sum())})
    return result


def fmt_value(val: float, prefix: str = "", suffix: str = "", decimals: int = 2) -> str:
    if math.isnan(val):
        return "N/A"
    if abs(val) >= 1e12:
        return f"{prefix}{val/1e12:.2f}T{suffix}"
    if abs(val) >= 1e9:
        return f"{prefix}{val/1e9:.2f}B{suffix}"
    if abs(val) >= 1e6:
        return f"{prefix}{val/1e6:.2f}M{suffix}"
    return f"{prefix}{val:.{decimals}f}{suffix}"


def fmt_change(val: float, prev: float, unit: str = "%", bps: bool = False) -> tuple:
    """Returns (change_str, direction)."""
    if math.isnan(val) or math.isnan(prev):
        return ("—", "flat")
    diff = val - prev
    direction = "up" if diff > 0 else ("down" if diff < 0 else "flat")
    arrow = "↗" if diff > 0 else ("↘" if diff < 0 else "→")
    if bps:
        return (f"{arrow} {diff*100:+.0f} bps", direction)
    return (f"{arrow} {diff:+.2f}{unit}", direction)


# ── Fetch raw data ────────────────────────────────────────────────────────────

print("Fetching FRED data...")

def fetch_fred(series_id: str, **kwargs) -> pd.Series:
    empty = pd.Series(dtype=float, index=pd.DatetimeIndex([]))
    try:
        s = fred.get_series(series_id, observation_start=str(START_RAW), **kwargs)
        s.index = pd.to_datetime(s.index)
        return s.dropna()
    except Exception as e:
        print(f"  WARN: FRED {series_id} failed: {e}")
        return empty

# Balance sheet / liquidity (weekly, fill forward to daily)
walcl   = fetch_fred("WALCL").resample("D").last().ffill()   # $M → convert to $T
wdtgal  = fetch_fred("WDTGAL").resample("D").last().ffill()  # $M
rrp     = fetch_fred("RRPONTSYD")                             # $B daily
wresbal = fetch_fred("WRESBAL").resample("D").last().ffill()  # $M

# Rates (daily)
dff   = fetch_fred("DFF")   / 100   # %→ decimal
sofr  = fetch_fred("SOFR")  / 100
iorb  = fetch_fred("IORB")  / 100
obfr  = fetch_fred("OBFR")  / 100
dgs10 = fetch_fred("DGS10") / 100
dgs2  = fetch_fred("DGS2")  / 100
dgs30 = fetch_fred("DGS30") / 100
dgs3m = fetch_fred("DGS3MO")/ 100
dfii5  = fetch_fred("DFII5") / 100
dfii10 = fetch_fred("DFII10")/ 100
t10yie = fetch_fred("T10YIE")/ 100
dcpf3m = fetch_fred("DCPF3M")/ 100   # 90d AA CP rate
nfci   = fetch_fred("NFCI").resample("D").last().ffill()
wti    = fetch_fred("DCOILWTICO")
ng     = fetch_fred("DHHNGSP")

# ON RRP award rate = lower bound of fed funds target range
# Historically set ~15bps below IORB (upper bound). e.g. IORB=3.65% → RRP=3.50%
rrp_rate = iorb - 0.0015

print("Fetching Yahoo Finance data...")

TICKERS = ["^VIX", "^VIX3M", "^OVX", "DX-Y.NYB",
           "SPY", "TLT", "IWM", "HYG", "LQD", "KRE", "IEF", "IEI"]

raw_yahoo = yf.download(
    TICKERS,
    start=str(START_RAW),
    end=str(TODAY + timedelta(days=1)),
    auto_adjust=True,
    progress=False,
)

def yp(ticker: str) -> pd.Series:
    """Get adjusted close price series for a Yahoo ticker."""
    try:
        if isinstance(raw_yahoo.columns, pd.MultiIndex):
            s = raw_yahoo["Close"][ticker].dropna()
        else:
            s = raw_yahoo["Close"].dropna()
        s.index = pd.to_datetime(s.index)
        return s
    except Exception as e:
        print(f"  WARN: Yahoo {ticker}: {e}")
        return pd.Series(dtype=float)

vix    = yp("^VIX")
vix3m  = yp("^VIX3M")
ovx    = yp("^OVX")
dxy    = yp("DX-Y.NYB")
spy    = yp("SPY")
tlt    = yp("TLT")
iwm    = yp("IWM")
hyg    = yp("HYG")
lqd    = yp("LQD")
kre    = yp("KRE")
ief    = yp("IEF")
iei    = yp("IEI")

# ── Derive factors ────────────────────────────────────────────────────────────

print("Computing derived factors...")

# Convert FRED balance sheet units to $B for display
walcl_b  = walcl  / 1000   # $M → $B
wdtgal_b = wdtgal / 1000
rrp_b    = rrp             # already $B
wresbal_b = wresbal / 1000

# Fed Net Liquidity ($B)
net_liq = walcl_b - wdtgal_b - rrp_b

# 13-week (91-day) momentum of net liquidity
net_liq_mom = net_liq - net_liq.shift(91)

# TGA deviation from 52-week rolling median
tga_deviation = wdtgal_b - wdtgal_b.rolling(365).median()

# ON RRP Buffer Risk (0–1, non-linear)
on_rrp_risk = ((1 - rrp_b / 100).clip(lower=0) ** 0.5)

# Corridor frictions (bps-level spreads)
coll_repo   = sofr - obfr
corr_fric_1 = sofr - iorb
corr_fric_2 = sofr - rrp_rate
effr_iorb   = dff  - iorb

# CP-TBill spread
cp_tbill = (dcpf3m - dgs3m).dropna()

# Funding fragmentation: 21-day std of spread triad
# Scale to percent-point form (*100) so values match bhadial's ~0.1 range
# (rates are in decimal; *100 brings back to percent-point units)
spread_triad = pd.DataFrame({
    "cf_repo": coll_repo   * 100,
    "cf1":     corr_fric_1 * 100,
    "cf2":     corr_fric_2 * 100,
}).dropna()
frag_mean = spread_triad.mean(axis=1)
funding_frag = frag_mean.rolling(21).std()

# Treasury
term_30_10 = dgs30 - dgs10
# Rate vol: 21D std of daily pct-point changes
# dgs10 is in decimal (0.0404); multiply by 100 to get percent-point daily changes
# NOTE: bhadial raw value ~0.09 suggests pct returns*10, but that gives worse percentile match
# Keeping pct-point diff approach which gives closer percentile (score 88.7 vs bhadial 51.0)
dgs10_chg_pct = dgs10.diff() * 100
rate_vol_21   = dgs10_chg_pct.rolling(21).std()
curve_curv    = (2 * dgs10 - dgs2 - dgs30).abs()

# Rates
real_level = 0.6 * dfii5 + 0.4 * dfii10
real_curve_10_5 = dfii10 - dfii5

# Credit: relative log returns (63-day)
hy_credit  = rel_log_return(hyg, iei)
ig_credit  = rel_log_return(lqd, ief)
kb_spy     = rel_log_return(kre, spy)

# Risk
risk_safe  = rel_log_return(spy, tlt)
hi_beta    = rel_log_return(iwm, spy)
vix_ts     = vix / vix3m

# External
fx_rvol    = realized_vol(dxy.pct_change(), 63)
oil_vol_dev = (ovx - ovx.rolling(252).median()).clip(lower=0)

# ── Score pipeline ────────────────────────────────────────────────────────────

def make_factor(factor_id: str, name: str, series: pd.Series,
                value_fmt: str = "{:.4f}", change_bps: bool = False,
                is_extra: bool = False) -> dict:
    """Build a complete Factor dict for the frontend."""
    series = series.dropna()
    if len(series) < 10:
        return None

    current = float(series.iloc[-1])

    # 7-day ago value
    past_idx = series.index.get_indexer([series.index[-1] - timedelta(days=7)], method="nearest")[0]
    past_val = float(series.iloc[max(0, past_idx)])

    raw_pct   = pct_rank(series)
    score_val = score_from_pct(raw_pct, factor_id)
    status    = get_status(score_val)

    # Score series for velocity
    cutoff = TODAY - timedelta(days=365 * 5 + 90)
    hist = series[series.index >= pd.Timestamp(cutoff)].dropna()
    score_series = hist.apply(
        lambda x: score_from_pct(float(percentileofscore(hist.values, x, kind="rank")), factor_id)
    )
    velocity = get_velocity(score_series)

    # Formatted value
    try:
        val_str = value_fmt.format(current)
    except Exception:
        val_str = f"{current:.4f}"

    chg_str, chg_dir = fmt_change(current, past_val, bps=change_bps)

    return {
        "id":                   factor_id,
        "name":                 name,
        "value":                val_str,
        "sevenDayChange":       chg_str,
        "changeDirection":      chg_dir,
        "historicalPercentile5Y": round(raw_pct, 1),
        "status":               status,
        "velocity":             velocity,
        "trendData":            build_trend_data(series, 90),
        "percentileData":       percentile_dist(series),
        "isExtra":              is_extra,
    }


def make_score_series(series: pd.Series, factor_id: str) -> pd.Series:
    """Return daily score series for a factor (for score trend)."""
    series = series.dropna()
    cutoff = TODAY - timedelta(days=365 * 5 + 90)
    hist = series[series.index >= pd.Timestamp(cutoff)].dropna()
    if len(hist) < 5:
        return pd.Series(dtype=float)
    return hist.apply(
        lambda x: score_from_pct(float(percentileofscore(hist.values, x, kind="rank")), factor_id)
    )


# ── Build modules ─────────────────────────────────────────────────────────────

print("Scoring factors and building modules...")

def build_module_obj(slug: str, name: str, factor_specs: list) -> tuple:
    """
    factor_specs: list of (factor_id, name, series, fmt, change_bps, is_extra)
    Returns (module_dict, {factor_id: score_series})
    """
    factors = []
    factor_score_series = {}

    for spec in factor_specs:
        fid, fname, fseries, ffmt, fbps, fextra = spec
        f = make_factor(fid, fname, fseries, ffmt, fbps, fextra)
        if f:
            factors.append(f)
            factor_score_series[fid] = make_score_series(fseries, fid)

    # Module score = weighted average of scored (non-extra) factors
    scored = [f for f in factors if not f["isExtra"]]
    if not scored:
        return None, {}

    fw = FACTOR_WEIGHTS.get(slug, {})
    scored_scores = []
    scored_weights = []
    for f in scored:
        fid = f["id"]
        s = score_from_pct(f["historicalPercentile5Y"], fid)
        w = fw.get(fid, 1.0 / len(scored))
        scored_scores.append(s)
        scored_weights.append(w)
    w_total = sum(scored_weights)
    module_score = round(sum(s * w for s, w in zip(scored_scores, scored_weights)) / w_total, 1)

    # Build module score time series (weighted average of scored factor score series)
    scored_ids = [f["id"] for f in scored]
    valid_ids = [fid for fid in scored_ids if fid in factor_score_series and len(factor_score_series[fid]) > 0]
    ss_list = [factor_score_series[fid] for fid in valid_ids]
    if ss_list:
        df = pd.concat(ss_list, axis=1)
        weights = np.array([fw.get(fid, 1.0 / len(valid_ids)) for fid in valid_ids])
        weights = weights / weights.sum()
        mod_score_ts = (df * weights).sum(axis=1).dropna()
    else:
        mod_score_ts = pd.Series(dtype=float)

    # Trend data for module (90 days)
    mod_trend = build_score_trend(mod_score_ts, 90)

    # Percentile of module score itself (5Y)
    mod_pct = round(pct_rank(mod_score_ts), 1) if len(mod_score_ts) > 10 else 50.0

    # Previous score (7 days ago)
    if len(mod_score_ts) > 7:
        prev_score = round(float(mod_score_ts.iloc[-8]), 1)
    else:
        prev_score = module_score

    change_pct = round((module_score - prev_score) / max(prev_score, 0.01) * 100, 2)

    # Trend direction
    recent = mod_score_ts.tail(3)
    if len(recent) >= 2 and recent.iloc[-1] > recent.iloc[0] + 1:
        trend_dir = "improving"
    elif len(recent) >= 2 and recent.iloc[-1] < recent.iloc[0] - 1:
        trend_dir = "declining"
    else:
        trend_dir = "stable"

    color = MODULE_COLORS.get(slug, "#f97316")
    # Dynamic color based on score
    if module_score >= 66:
        color = "#14b8a6"
    elif module_score >= 33:
        color = "#f97316"
    else:
        color = "#ef4444"

    module = {
        "slug":              slug,
        "name":              name,
        "score":             module_score,
        "prevScore":         prev_score,
        "sevenDayChangePct": change_pct,
        "trendDays":         2,
        "trendDirection":    trend_dir,
        "percentile5Y":      mod_pct,
        "lastUpdated":       f"Updated {TODAY.strftime('%b %d, %Y')}",
        "updatedAt":         datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        "color":             color,
        "trendData":         mod_trend,
        "factors":           factors,
    }
    return module, factor_score_series


# ─── Module specs ──────────────────────────────────────────────────────────

all_specs = {
    "liquidity": ("Liquidity", [
        ("fed-net-liquidity",      "Fed Net Liquidity",          net_liq,       "${:.2f}B",    False, False),
        ("bank-reserves",          "Bank Reserves",              wresbal_b,     "${:.2f}B",    False, False),
        ("net-liquidity-momentum", "Net Liquidity Momentum (13W)", net_liq_mom, "${:.2f}B",    False, False),
        ("tga-deviation",          "TGA Deviation",              tga_deviation, "${:.2f}B",    False, False),
        ("on-rrp-buffer-risk",     "ON RRP Buffer Risk",         on_rrp_risk,   "{:.4f}",      False, False),
        ("fed-total-assets",       "Fed Total Assets",           walcl_b,       "${:.2f}B",    False, True),
        ("treasury-general-account","Treasury General Account",  wdtgal_b,      "${:.2f}B",    False, True),
        ("on-rrp",                 "ON RRP",                     rrp_b,         "${:.2f}B",    False, True),
    ]),
    "funding": ("Funding", [
        ("collateral-repo-friction","Collateral/Repo Friction",  coll_repo,     "{:.4%}",      True,  False),
        ("corridor-friction-1",    "Corridor Friction 1",        corr_fric_1,   "{:.4%}",      True,  False),
        ("corridor-friction-2",    "Corridor Friction 2",        corr_fric_2,   "{:.4%}",      True,  False),
        ("effr-iorb-spread",       "EFFR−IORB Spread",           effr_iorb,     "{:.4%}",      True,  False),
        ("cp-tbill-spread",        "CP-TBill Spread",            cp_tbill,      "{:.4%}",      True,  False),
        ("funding-fragmentation",  "Funding Fragmentation (21D)",funding_frag,  "{:.4f}",      False, False),
        ("effr",                   "EFFR",                       dff,           "{:.2%}",      True,  True),
        ("sofr",                   "SOFR",                       sofr,          "{:.2%}",      True,  True),
        ("iorb",                   "IORB",                       iorb,          "{:.2%}",      True,  True),
        ("on-rrp-award-rate",      "ON RRP Award Rate",          rrp_rate,      "{:.2%}",      True,  True),
        ("obfr-rate",              "OBFR Rate",                  obfr,          "{:.2%}",      True,  True),
    ]),
    "treasury": ("Treasury", [
        ("30y-10y-term-premium",   "30Y-10Y Term Premium",       term_30_10,    "{:.2%}",      True,  False),
        ("10y-rate-volatility",    "10Y Rate Volatility (21D)",  rate_vol_21,   "{:.4f}",      False, False),
        ("curve-curvature",        "Curve Curvature (Abs)",      curve_curv,    "{:.4%}",      True,  False),
        ("10y-2y-spread",          "10Y-2Y Spread",              dgs10-dgs2,    "{:.2%}",      True,  True),
        ("10y-3m-spread",          "10Y-3M Spread",              dgs10-dgs3m,   "{:.2%}",      True,  True),
        ("10y-nominal-rate",       "10Y Nominal Rate",           dgs10,         "{:.2%}",      True,  True),
        ("30y-rate",               "30Y Rate",                   dgs30,         "{:.2%}",      True,  True),
        ("2y-rate",                "2Y Rate",                    dgs2,          "{:.2%}",      True,  True),
    ]),
    "rates": ("Rates", [
        ("real-rate-level",        "Real Rate Level",            real_level,    "{:.2%}",      True,  False),
        ("real-curve",             "Real Curve (10Y-5Y)",        real_curve_10_5,"{:.2%}",     True,  False),
        ("10y-breakeven",          "10Y Breakeven",              t10yie,        "{:.2%}",      True,  False),
        ("5y-real-rate",           "5Y Real Rate",               dfii5,         "{:.2%}",      True,  True),
        ("10y-real-rate",          "10Y Real Rate",              dfii10,        "{:.2%}",      True,  True),
    ]),
    "credit": ("Credit", [
        ("nfci",                   "NFCI",                       nfci,          "{:.2f}",      False, False),
        ("hy-credit",              "HY Credit",                  hy_credit,     "{:.2%}",      False, False),
        ("ig-credit",              "IG Credit",                  ig_credit,     "{:.2%}",      False, False),
        ("regional-banks-spy",     "Regional Banks vs SPY",      kb_spy,        "{:.2%}",      False, False),
    ]),
    "risk": ("Risk", [
        ("vix",                    "VIX",                        vix,           "{:.2f}",      False, False),
        ("vix-term-structure",     "VIX Term Structure",         vix_ts,        "{:.4f}",      False, False),
        ("risk-vs-safe",           "Risk vs Safe",               risk_safe,     "{:.2%}",      False, False),
        ("high-beta-preference",   "High-Beta Preference",       hi_beta,       "{:.2%}",      False, False),
        ("vix-3m",                 "VIX 3M",                     vix3m,         "{:.2f}",      False, True),
    ]),
    "external": ("External", [
        ("dxy",                    "US Dollar Index (DXY)",      dxy,           "{:.2f}",      False, False),
        ("fx-realized-volatility", "FX Realized Volatility",     fx_rvol,       "{:.4f}",      False, False),
        ("wti-oil",                "WTI Oil",                    wti,           "${:.2f}",     False, False),
        ("oil-volatility-deviation","Oil Volatility Deviation",  oil_vol_dev,   "{:.3f}",      False, False),
        ("natural-gas",            "Natural Gas",                ng,            "${:.2f}",     False, False),
    ]),
}

# Build all modules
modules = {}
all_factor_score_series = {}
for slug, (mname, specs) in all_specs.items():
    print(f"  Building module: {slug}")
    mod, fss = build_module_obj(slug, mname, specs)
    if mod:
        modules[slug] = mod
        all_factor_score_series.update(fss)

# ── Overall score ──────────────────────────────────────────────────────────

print("Computing overall score...")

overall_score = round(sum(
    modules[slug]["score"] * w
    for slug, w in MODULE_WEIGHTS.items()
    if slug in modules
), 1)

# Previous overall score (7 days ago)
prev_overall = round(sum(
    modules[slug]["prevScore"] * w
    for slug, w in MODULE_WEIGHTS.items()
    if slug in modules
), 1)

# Overall score trend series (factor-weighted module scores, then module-weighted)
overall_score_ts_parts = []
for slug, w in MODULE_WEIGHTS.items():
    if slug not in modules:
        continue
    fw = FACTOR_WEIGHTS.get(slug, {})
    scored_ids = [f["id"] for f in modules[slug]["factors"] if not f["isExtra"]]
    valid_ids = [fid for fid in scored_ids
                 if fid in all_factor_score_series and len(all_factor_score_series[fid]) > 0]
    ss_list = [all_factor_score_series[fid] for fid in valid_ids]
    if ss_list:
        df = pd.concat(ss_list, axis=1)
        f_weights = np.array([fw.get(fid, 1.0 / len(valid_ids)) for fid in valid_ids])
        f_weights = f_weights / f_weights.sum()
        mod_ts = (df * f_weights).sum(axis=1) * w
        overall_score_ts_parts.append(mod_ts)

if overall_score_ts_parts:
    overall_ts = pd.concat(overall_score_ts_parts, axis=1).sum(axis=1).dropna()
else:
    overall_ts = pd.Series(dtype=float)

overall_trend = build_score_trend(overall_ts, 90)

# 5Y percentile of overall score
overall_pct = round(pct_rank(overall_ts), 1) if len(overall_ts) > 10 else 50.0

# Trend direction
rec = overall_ts.tail(3)
if len(rec) >= 2 and rec.iloc[-1] > rec.iloc[0] + 0.5:
    overall_trend_dir = "improving"
elif len(rec) >= 2 and rec.iloc[-1] < rec.iloc[0] - 0.5:
    overall_trend_dir = "declining"
else:
    overall_trend_dir = "stable"

# ── Score Lift / Drag ─────────────────────────────────────────────────────────

print("Computing Lift/Drag attribution...")

lift_drag = []
for slug, w in MODULE_WEIGHTS.items():
    if slug not in modules:
        continue
    fw = FACTOR_WEIGHTS.get(slug, {})
    scored = [f for f in modules[slug]["factors"] if not f["isExtra"]]
    for f in scored:
        fid = f["id"]
        if fid not in all_factor_score_series:
            continue
        ss = all_factor_score_series[fid].dropna()
        if len(ss) < 9:
            continue
        factor_w = fw.get(fid, 1.0 / len(scored)) * w
        score_now  = float(ss.iloc[-1])
        score_7d   = float(ss.iloc[-8]) if len(ss) > 8 else score_now
        contrib    = (score_now - score_7d) * factor_w
        lift_drag.append({"name": f["name"], "pts": round(contrib, 2)})

lift_drag.sort(key=lambda x: x["pts"], reverse=True)
score_lift = [i for i in lift_drag if i["pts"] > 0]
score_drag = [i for i in lift_drag if i["pts"] < 0]

# ── Assemble final dashboard JSON ─────────────────────────────────────────────

dashboard = {
    "score":          overall_score,
    "prevScore":      prev_overall,
    "trendDays":      2,
    "trendDirection": overall_trend_dir,
    "percentile5Y":   overall_pct,
    "lastUpdated":    f"Updated {TODAY.strftime('%b %d, %Y')}",
    "updatedAt":      datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
    "trendData":      overall_trend,
    "modules":        list(modules.values()),
    "scoreLift":      score_lift,
    "scoreDrag":      score_drag,
}

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
with open(OUTPUT_PATH, "w") as f:
    json.dump(dashboard, f, indent=2, default=str)

print(f"\n✓ Done! Written to {OUTPUT_PATH}")
print(f"  Overall Score: {overall_score} (prev: {prev_overall})")
for slug, mod in modules.items():
    print(f"  {mod['name']:12s}: {mod['score']:.1f}")

# ── Factor-level comparison vs bhadial.com (2026-02-26 snapshot) ─────────────

BHADIAL_PCTL = {
    # Liquidity (bhadial pctl = factor score, already direction-adjusted)
    "fed-net-liquidity": 4.60, "bank-reserves": 4.60,
    "net-liquidity-momentum": 63.98, "tga-deviation": 6.90,
    "on-rrp-buffer-risk": 2.30,
    # Funding
    "collateral-repo-friction": 20.84, "corridor-friction-1": 34.37,
    "corridor-friction-2": 21.03, "effr-iorb-spread": 5.44,
    "cp-tbill-spread": 66.08, "funding-fragmentation": 100.00,
    # Treasury
    "30y-10y-term-premium": 92.16, "10y-rate-volatility": 51.04,
    "curve-curvature": 30.06,
    # Rates
    "real-rate-level": 60.16, "real-curve": 79.60, "10y-breakeven": 79.60,
    # Credit
    "nfci": 83.14, "hy-credit": 60.35, "ig-credit": 57.40,
    "regional-banks-spy": 80.49,
    # Risk
    "vix": 49.18, "vix-term-structure": 50.27,
    "risk-vs-safe": 43.15, "high-beta-preference": 97.45,
    # External
    "dxy": 77.08, "fx-realized-volatility": 77.25,
    "wti-oil": 29.03, "oil-volatility-deviation": 2.84,
    "natural-gas": 100.00,
}

print("\n── Factor Comparison: Ours vs Bhadial ──────────────────────────")
print(f"{'Module':<12} {'Factor':<28} {'Our Score':>9} {'Bhadial':>9} {'Δ':>7}")
print("─" * 70)
for slug, mod in modules.items():
    scored = [f for f in mod["factors"] if not f["isExtra"]]
    for f in scored:
        fid = f["id"]
        our_score = score_from_pct(f["historicalPercentile5Y"], fid)
        bh = BHADIAL_PCTL.get(fid)
        if bh is not None:
            delta = our_score - bh
            flag = " ◀" if abs(delta) > 10 else ""
            print(f"  {slug:<10} {f['name']:<28} {our_score:>8.1f} {bh:>8.1f} {delta:>+7.1f}{flag}")
    # Module total
    bh_mod = {"liquidity": 20.40, "funding": 41.93, "treasury": 58.37,
              "rates": 70.16, "credit": 73.60, "risk": 58.20, "external": 50.68}
    bm = bh_mod.get(slug, 0)
    md = mod["score"] - bm
    print(f"  {'':10} {'MODULE TOTAL':<28} {mod['score']:>8.1f} {bm:>8.1f} {md:>+7.1f}")
    print()
