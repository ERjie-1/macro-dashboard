"""
Macro-Economic Dashboard — Data Fetcher & Scorer
Fetches FRED + Yahoo Finance data, computes derived factors, scores them,
and writes public/data/dashboard.json plus trailing 90 US trading days to
public/data/macro_factors_history.jsonl.

Usage:
  cd macro-dashboard/data
  python fetch_data.py
"""

import io
import json
import math
import os
import platform
import ssl
import time
import warnings
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import requests
import yfinance as yf
from dotenv import load_dotenv
from fredapi import Fred

warnings.filterwarnings("ignore")

# Fix macOS SSL certificate verification issue (not needed on Linux/CI)
if platform.system() == "Darwin":
    ssl._create_default_https_context = ssl._create_unverified_context

# ── Config ──────────────────────────────────────────────────────────────────

CALIBRATION_VERSION = "v2-20261121"
ET_TZ = ZoneInfo("America/New_York")
NOW_UTC = datetime.now(timezone.utc)
NOW_ET = NOW_UTC.astimezone(ET_TZ)
TODAY = NOW_ET.date()

# Fetch ~6.65Y raw history so a 252-day rolling baseline leaves a full 5Y window
# for every date across the trailing 90+ trading days.
START_5Y = TODAY - timedelta(days=365 * 5 + 90)
START_RAW = TODAY - timedelta(days=365 * 6 + 240)

PUBLIC_DATA_DIR = Path(__file__).parent.parent / "public" / "data"
OUTPUT_PATH = PUBLIC_DATA_DIR / "dashboard.json"
HISTORY_OUTPUT_PATH = PUBLIC_DATA_DIR / "macro_factors_history.jsonl"

load_dotenv(Path(__file__).parent / ".env")
FRED_API_KEY = os.getenv("FRED_API_KEY", "").strip()
fred = Fred(api_key=FRED_API_KEY) if FRED_API_KEY else None
if fred is None:
    print("INFO: FRED_API_KEY not set — using public FRED CSV fallback")

# ── Module & factor metadata ────────────────────────────────────────────────

MODULE_WEIGHTS = {
    k: 1 / 7
    for k in [
        "liquidity",
        "funding",
        "treasury",
        "rates",
        "credit",
        "risk",
        "external",
    ]
}

MODULE_COLORS = {
    "liquidity": "#ef4444",
    "funding": "#f97316",
    "treasury": "#f97316",
    "rates": "#14b8a6",
    "credit": "#14b8a6",
    "risk": "#f97316",
    "external": "#f97316",
}

FACTOR_WEIGHTS = {
    "liquidity": {
        "fed-net-liquidity": 0.30,
        "bank-reserves": 0.20,
        "net-liquidity-momentum": 0.25,
        "tga-deviation": 0.15,
        "on-rrp-buffer-risk": 0.10,
    },
    "funding": {
        "collateral-repo-friction": 0.18,
        "corridor-friction-1": 0.22,
        "corridor-friction-2": 0.18,
        "effr-iorb-spread": 0.12,
        "cp-tbill-spread": 0.20,
        "funding-fragmentation": 0.10,
    },
    "treasury": {
        "30y-10y-term-premium": 0.35,
        "10y-rate-volatility": 0.35,
        "curve-curvature": 0.30,
    },
    "rates": {
        "real-rate-level": 0.50,
        "real-curve": 0.15,
        "10y-breakeven": 0.35,
    },
    "credit": {
        "nfci": 0.40,
        "hy-credit": 0.25,
        "ig-credit": 0.15,
        "regional-banks-spy": 0.20,
    },
    "risk": {
        "vix": 0.30,
        "vix-term-structure": 0.25,
        "risk-vs-safe": 0.25,
        "high-beta-preference": 0.20,
    },
    "external": {
        "dxy": 0.25,
        "fx-realized-volatility": 0.20,
        "wti-oil": 0.20,
        "oil-volatility-deviation": 0.25,
        "natural-gas": 0.10,
    },
}

CANONICAL_FACTOR_IDS = {
    "fed-net-liquidity": "fed_net_liquidity",
    "bank-reserves": "bank_reserves",
    "net-liquidity-momentum": "delta_net_liq_13w",
    "tga-deviation": "tga_dev_signed",
    "on-rrp-buffer-risk": "onrrp_near_zero_risk",
    "collateral-repo-friction": "collateral_friction",
    "corridor-friction-1": "corridor_friction_1",
    "corridor-friction-2": "corridor_friction_2",
    "effr-iorb-spread": "effr_iorb",
    "cp-tbill-spread": "cp_tbill_spread",
    "funding-fragmentation": "fragmentation_21d",
    "30y-10y-term-premium": "dgs30_dgs10",
    "10y-rate-volatility": "dgs10_vol_21d",
    "curve-curvature": "curve_curvature_abs",
    "real-rate-level": "real_rate_level",
    "real-curve": "real_curve",
    "10y-breakeven": "t10yie",
    "nfci": "nfci",
    "hy-credit": "hy_credit",
    "ig-credit": "ig_credit",
    "regional-banks-spy": "kre_spy",
    "vix": "vix",
    "vix-term-structure": "vix_term_structure",
    "risk-vs-safe": "risk_vs_safe",
    "high-beta-preference": "high_beta_pref",
    "dxy": "dxy",
    "fx-realized-volatility": "fx_vol",
    "wti-oil": "wti",
    "oil-volatility-deviation": "ovx_dev",
    "natural-gas": "natgas",
}

# Factors where lower raw/deviation value = better conditions (score = 100 - pct_lt)
INVERT_FACTORS = {
    "tga-deviation",
    "on-rrp-buffer-risk",
    "collateral-repo-friction",
    "corridor-friction-1",
    "corridor-friction-2",
    "effr-iorb-spread",
    "cp-tbill-spread",
    "funding-fragmentation",
    "10y-rate-volatility",
    "curve-curvature",
    "real-rate-level",
    "10y-breakeven",
    "nfci",
    "vix",
    "vix-term-structure",
    "dxy",
    "fx-realized-volatility",
    "wti-oil",
    "oil-volatility-deviation",
    "natural-gas",
}

# ── Helpers ──────────────────────────────────────────────────────────────────


def _normalize_dt_index(s: pd.Series) -> pd.Series:
    """Normalize series index to sorted, deduplicated timezone-naive midnights."""
    if s.empty:
        return s
    idx = pd.to_datetime(s.index)
    if idx.tz is not None:
        idx = idx.tz_localize(None)
    s = s.copy()
    s.index = idx.normalize()
    s = s.dropna()
    s = s[~s.index.duplicated(keep="last")].sort_index()
    return s


def rel_log_return(price_a: pd.Series, price_b: pd.Series, window: int = 63) -> pd.Series:
    """Relative log return: log(A/A[-window]) - log(B/B[-window])."""
    la = np.log(price_a)
    lb = np.log(price_b)
    return (la - la.shift(window)) - (lb - lb.shift(window))


def realized_vol(returns: pd.Series, window: int, annualize: int = 252) -> pd.Series:
    """Rolling realized volatility, annualized."""
    return returns.rolling(window).std() * math.sqrt(annualize)


def rolling_pct_strict_lt(series: pd.Series, lookback_days: int = 365 * 5) -> pd.Series:
    """
    Point-in-time rolling 5-year strict_lt percentile: mean(window < cur) * 100.
    Uses only observations in [t - lookback_days, t] (no lookahead bias).
    """
    s = series.dropna().sort_index()
    if s.empty:
        return pd.Series(dtype=float)

    ts_ns = s.index.asi8
    vals = s.values.astype(float)
    win_ns = np.int64(lookback_days) * 86400 * 10**9
    out = np.empty(len(s), dtype=float)

    for i in range(len(s)):
        left = int(np.searchsorted(ts_ns, ts_ns[i] - win_ns, side="left"))
        window = vals[left : i + 1]
        if len(window) < 2:
            out[i] = 50.0
        else:
            out[i] = float(np.mean(window < vals[i]) * 100.0)

    return pd.Series(out, index=s.index, dtype=float)


def rolling_floor_tie_share(series: pd.Series, lookback_days: int = 365 * 5) -> pd.Series:
    """Point-in-time share of exact zero ties in the trailing 5-year window."""
    s = series.dropna().sort_index()
    if s.empty:
        return pd.Series(dtype=float)

    ts_ns = s.index.asi8
    vals = s.values.astype(float)
    win_ns = np.int64(lookback_days) * 86400 * 10**9
    out = np.empty(len(s), dtype=float)

    for i in range(len(s)):
        left = int(np.searchsorted(ts_ns, ts_ns[i] - win_ns, side="left"))
        window = vals[left : i + 1]
        out[i] = float(np.mean(window == 0.0)) if len(window) > 0 else 0.0

    return pd.Series(out, index=s.index, dtype=float)


def score_from_pct_raw(raw_pct: float, factor_id: str) -> float:
    """Convert raw percentile into 0-100 condition score without rounding."""
    score = (100.0 - raw_pct) if factor_id in INVERT_FACTORS else raw_pct
    return max(0.0, min(100.0, float(score)))


def score_from_pct(raw_pct: float, factor_id: str) -> float:
    return round(score_from_pct_raw(raw_pct, factor_id), 1)


def get_status(score: float) -> str:
    if score >= 66:
        return "supportive"
    if score >= 33:
        return "neutral"
    return "restrictive"


def get_status_title(score: float) -> str:
    if score >= 66:
        return "Supportive"
    if score >= 33:
        return "Neutral"
    return "Restrictive"


def get_velocity(series: pd.Series, window: int = 5) -> str:
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


def build_trend_data(series: pd.Series, days: int = 90, decimals: int = 4) -> list:
    """Last N observations of (date, value) for the frontend trend chart."""
    s = series.dropna().tail(days)
    result = []
    for dt, val in s.items():
        result.append(
            {
                "date": pd.Timestamp(dt).strftime("%-m/%-d"),
                "value": round(float(val), decimals),
            }
        )
    return result


def build_score_trend(score_series: pd.Series, days: int = 90) -> list:
    """Trend data for module/overall score history rounded consistently with card score."""
    return build_trend_data(score_series, days=days, decimals=1)


def percentile_dist(series: pd.Series, lookback_years: int = 5) -> list:
    """10-bucket histogram of historical distribution."""
    s = series.dropna().sort_index()
    buckets = [f"{i * 10}-{(i + 1) * 10}" for i in range(10)]
    if s.empty:
        return [{"range": label, "freq": 0} for label in buckets]
    cutoff = s.index[-1] - pd.Timedelta(days=lookback_years * 365)
    hist = s[s.index >= cutoff]
    if hist.empty:
        return [{"range": label, "freq": 0} for label in buckets]
    result = []
    for i, label in enumerate(buckets):
        lo, hi = i * 10, (i + 1) * 10
        hi_val = np.percentile(hist, 100) if i == 9 else np.percentile(hist, hi)
        if i == 9:
            mask = (hist >= np.percentile(hist, lo)) & (hist <= hi_val)
        else:
            mask = (hist >= np.percentile(hist, lo)) & (hist < hi_val)
        result.append({"range": label, "freq": int(mask.sum())})
    return result


def fmt_change(val: float, prev: float, unit: str = "%", bps: bool = False) -> tuple:
    """Returns (change_str, direction)."""
    if math.isnan(val) or math.isnan(prev):
        return ("—", "flat")
    diff = val - prev
    direction = "up" if diff > 0 else ("down" if diff < 0 else "flat")
    arrow = "↗" if diff > 0 else ("↘" if diff < 0 else "→")
    if bps:
        return (f"{arrow} {diff * 100:+.0f} bps", direction)
    return (f"{arrow} {diff:+.2f}{unit}", direction)


# ── Fetch raw data ────────────────────────────────────────────────────────────

print("Fetching FRED data...")


_FRED_SESSION = requests.Session()
_FRED_SESSION.headers.update({"User-Agent": "Mozilla/5.0 (compatible; MacroDashboard/2.0)"})


def _fetch_fred_public_csv(series_id: str) -> pd.Series:
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}&cosd={START_RAW}"
    last_err = None
    for attempt in range(3):
        try:
            resp = _FRED_SESSION.get(url, timeout=20)
            resp.raise_for_status()
            df = pd.read_csv(io.StringIO(resp.text))
            date_col = df.columns[0]
            val_col = df.columns[1]
            dates = pd.to_datetime(df[date_col], errors="coerce")
            vals = pd.to_numeric(df[val_col], errors="coerce")
            s = pd.Series(vals.values, index=dates, dtype=float)
            s = s[s.index >= pd.Timestamp(START_RAW)]
            return _normalize_dt_index(s)
        except Exception as e:
            last_err = e
            time.sleep(0.5 * (attempt + 1))
    raise last_err


def fetch_fred(series_id: str, **kwargs) -> pd.Series:
    empty = pd.Series(dtype=float, index=pd.DatetimeIndex([]))
    if fred is not None:
        try:
            s = fred.get_series(series_id, observation_start=str(START_RAW), **kwargs)
            return _normalize_dt_index(s)
        except Exception as e:
            print(f"  WARN: fredapi {series_id} failed ({e}), trying public CSV...")
    try:
        return _fetch_fred_public_csv(series_id)
    except Exception as e:
        print(f"  WARN: FRED public CSV {series_id} failed: {e}")
        return empty


# Raw native-frequency balance sheet & weekly series
walcl_raw = fetch_fred("WALCL")
wdtgal_raw = fetch_fred("WDTGAL")
wresbal_raw = fetch_fred("WRESBAL")
nfci_raw = fetch_fred("NFCI")
rrp_raw = fetch_fred("RRPONTSYD")
rrp_award_raw = fetch_fred("RRPONTSYAWARD") / 100.0

# Calendar-daily ffilled copies for 84-day liquidity momentum & level display
walcl = walcl_raw.resample("D").last().ffill()
wdtgal = wdtgal_raw.resample("D").last().ffill()
wresbal = wresbal_raw.resample("D").last().ffill()
rrp = rrp_raw
nfci = nfci_raw.resample("D").last().ffill()

# Rates & funding (daily, % -> decimal)
dff_raw = fetch_fred("DFF")
sofr_raw = fetch_fred("SOFR")
iorb_raw = fetch_fred("IORB")
obfr_raw = fetch_fred("OBFR")
dgs10_raw = fetch_fred("DGS10")
dgs2_raw = fetch_fred("DGS2")
dgs30_raw = fetch_fred("DGS30")
dgs3m_raw = fetch_fred("DGS3MO")
dtb3_raw = fetch_fred("DTB3")
dfii5_raw = fetch_fred("DFII5")
dfii10_raw = fetch_fred("DFII10")
t10yie_raw = fetch_fred("T10YIE")
dcpf3m_raw = fetch_fred("DCPF3M")
dxy_broad = fetch_fred("DTWEXBGS")
wti_fred = fetch_fred("DCOILWTICO")
ng = fetch_fred("DHHNGSP")

dff = dff_raw / 100.0
sofr = sofr_raw / 100.0
iorb = iorb_raw / 100.0
obfr = obfr_raw / 100.0
dgs10 = dgs10_raw / 100.0
dgs2 = dgs2_raw / 100.0
dgs30 = dgs30_raw / 100.0
dgs3m = dgs3m_raw / 100.0
dtb3 = dtb3_raw / 100.0
dfii5 = dfii5_raw / 100.0
dfii10 = dfii10_raw / 100.0
t10yie = t10yie_raw / 100.0
dcpf3m = dcpf3m_raw / 100.0

# ON RRP award rate from FRED (fallback to IORB - 15bps only if empty)
rrp_rate = rrp_award_raw if len(rrp_award_raw) > 10 else (iorb - 0.0015)

print("Fetching Yahoo Finance data...")

TICKERS = [
    "^VIX",
    "^VIX3M",
    "^OVX",
    "DX-Y.NYB",
    "CL=F",
    "^GSPC",
    "GLD",
    "SPY",
    "TLT",
    "IWM",
    "HYG",
    "LQD",
    "KRE",
    "IEF",
    "IEI",
]

raw_yahoo = yf.download(
    TICKERS,
    start=str(START_RAW),
    end=str(TODAY + timedelta(days=2)),
    auto_adjust=True,
    progress=False,
)


def yp(ticker: str) -> pd.Series:
    """Get adjusted close price series for a Yahoo ticker with normalized midnight index."""
    try:
        if isinstance(raw_yahoo.columns, pd.MultiIndex):
            s = raw_yahoo["Close"][ticker]
        else:
            s = raw_yahoo["Close"]
        return _normalize_dt_index(s)
    except Exception as e:
        print(f"  WARN: Yahoo {ticker}: {e}")
        return pd.Series(dtype=float)


vix = yp("^VIX")
vix3m = yp("^VIX3M")
ovx = yp("^OVX")
dxy_ice = yp("DX-Y.NYB")
cl_f = yp("CL=F")
spx = yp("^GSPC")
gld = yp("GLD")
spy = yp("SPY")
tlt = yp("TLT")
iwm = yp("IWM")
hyg = yp("HYG")
lqd = yp("LQD")
kre = yp("KRE")
ief = yp("IEF")
iei = yp("IEI")

# Authoritative US equity trading calendar
TRADING_CAL = pd.DatetimeIndex(spy.index.sort_values().unique())
if len(TRADING_CAL) == 0:
    raise RuntimeError("SPY trading calendar is empty")

AS_OF_TS = TRADING_CAL[-1]
AS_OF_DATE = AS_OF_TS.date()
close_cutoff_et = datetime(AS_OF_DATE.year, AS_OF_DATE.month, AS_OF_DATE.day, 16, 0, tzinfo=ET_TZ)
SESSION_SCOPE = "post_close" if NOW_ET > close_cutoff_et else "intraday"

# ── Derive calibrated factors ─────────────────────────────────────────────────

print("Computing calibrated derived factors...")

# Liquidity ($B display)
walcl_b = walcl / 1000.0
wdtgal_b = wdtgal / 1000.0
wresbal_b = wresbal / 1000.0
rrp_b = rrp

rrp_cal = rrp_b.reindex(walcl_b.index).ffill()
net_liq_cal = (walcl_b - wdtgal_b - rrp_cal).dropna()
net_liq = net_liq_cal.reindex(TRADING_CAL).ffill().dropna()

# 12-week (84 calendar days) Net Liquidity momentum
net_liq_mom = (net_liq_cal - net_liq_cal.shift(84)).reindex(TRADING_CAL).ffill().dropna()

# Bank reserves: native weekly series for 5Y scoring
wresbal_weekly_b = (wresbal_raw / 1000.0).dropna()

# TGA deviation: native weekly vs 52-week rolling median
wdtgal_weekly_b = (wdtgal_raw / 1000.0).dropna()
tga_deviation = (wdtgal_weekly_b - wdtgal_weekly_b.rolling(52).median()).dropna()

# ON RRP buffer risk
on_rrp_risk = ((1.0 - rrp_b / 100.0).clip(lower=0.0) ** 0.5).dropna()

# Funding: keep display spreads raw, score UNROUNDED 252D median deviations for the triad
coll_repo = (sofr - obfr).dropna()
coll_repo_score_in = (coll_repo - coll_repo.rolling(252).median()).dropna()

corr_fric_1 = (sofr - iorb).dropna()
corr_fric_1_score_in = (corr_fric_1 - corr_fric_1.rolling(252).median()).dropna()

corr_fric_2 = (sofr - rrp_rate).dropna()
corr_fric_2_score_in = (corr_fric_2 - corr_fric_2.rolling(252).median()).dropna()

effr_iorb = (dff - iorb).dropna().round(6)
cp_tbill = (dcpf3m - dtb3).dropna().round(6)

spread_triad = pd.DataFrame(
    {
        "cf_repo": coll_repo * 100.0,
        "cf1": corr_fric_1 * 100.0,
        "cf2": corr_fric_2 * 100.0,
    }
).dropna()
funding_frag = spread_triad.mean(axis=1).rolling(21).std().dropna()

# Treasury: maturity-weighted butterfly |DGS10 - ((5/7)*DGS2 + (2/7)*DGS30)|
term_30_10 = (dgs30 - dgs10).dropna().round(6)
rate_vol_21 = (dgs10.diff() * 100.0).rolling(21).std().dropna()
curve_curv = (dgs10 - ((5.0 / 7.0) * dgs2 + (2.0 / 7.0) * dgs30)).abs().dropna()
curve_curv_med252 = curve_curv.rolling(252).median().dropna()
curve_curv_score_in = (curve_curv - curve_curv_med252).clip(lower=0.0).dropna()

# Rates
real_level = (0.6 * dfii5 + 0.4 * dfii10).dropna()
real_curve_10_5 = (dfii10 - dfii5).dropna().round(6)
t10yie_clean = t10yie.dropna().round(6)

# Credit
nfci_weekly = nfci_raw.dropna()
hy_credit = rel_log_return(hyg, iei, 63).dropna()
ig_credit = rel_log_return(lqd, ief, 63).dropna()
kb_spy = rel_log_return(kre, spy, 63).dropna()

# Risk
vix_clean = vix.dropna()
vix_ts = (vix / vix3m).dropna()
risk_safe = rel_log_return(spy, tlt, 63).dropna()
hi_beta = rel_log_return(iwm, spy, 63).dropna()

# External: DTWEXBGS broad dollar, WTI FRED+CL=F tail, max(0, x - med252) on WTI/OVX/NatGas
dxy = dxy_broad.dropna()
fx_rvol = realized_vol(dxy.pct_change(), 63).dropna()

if not wti_fred.empty and not cl_f.empty:
    wti_tail = cl_f[cl_f.index > wti_fred.index.max()]
    wti = pd.concat([wti_fred, wti_tail]).sort_index().dropna()
elif not wti_fred.empty:
    wti = wti_fred.dropna()
else:
    wti = cl_f.dropna()
wti_med252 = wti.rolling(252).median().dropna()
wti_score_in = (wti - wti_med252).clip(lower=0.0).dropna()

ovx_clean = ovx.dropna()
ovx_med252 = ovx_clean.rolling(252).median().dropna()
oil_vol_dev = (ovx_clean - ovx_med252).clip(lower=0.0).dropna()

ng_clean = ng.dropna()
ng_med252 = ng_clean.rolling(252).median().dropna()
ng_score_in = (ng_clean - ng_med252).clip(lower=0.0).dropna()

# ── Freshness & Market Close Inputs ──────────────────────────────────────────


def lag_trading_days(last_ts: pd.Timestamp) -> int:
    ts = pd.Timestamp(last_ts).normalize()
    return int((TRADING_CAL > ts).sum())


RAW_SOURCES_FOR_FRESHNESS = {
    "WALCL": walcl_raw,
    "WDTGAL": wdtgal_raw,
    "RRPONTSYD": rrp_raw,
    "WRESBAL": wresbal_raw,
    "SOFR": sofr_raw,
    "OBFR": obfr_raw,
    "IORB": iorb_raw,
    "RRPONTSYAWARD": rrp_award_raw,
    "DFF": dff_raw,
    "DCPF3M": dcpf3m_raw,
    "DTB3": dtb3_raw,
    "DGS2": dgs2_raw,
    "DGS10": dgs10_raw,
    "DGS30": dgs30_raw,
    "DFII5": dfii5_raw,
    "DFII10": dfii10_raw,
    "T10YIE": t10yie_raw,
    "NFCI": nfci_raw,
    "DTWEXBGS": dxy_broad,
    "DCOILWTICO": wti_fred,
    "DHHNGSP": ng_clean,
    "SPY": spy,
    "^VIX": vix_clean,
    "^OVX": ovx_clean,
    "CL=F": cl_f,
    "^GSPC": spx,
    "GLD": gld,
    "DX-Y.NYB": dxy_ice,
}

source_freshness = {}
for src_name, src_s in RAW_SOURCES_FOR_FRESHNESS.items():
    s_clean = src_s.dropna()
    if s_clean.empty:
        source_freshness[src_name] = {"lastDate": None, "lagTradingDays": None}
    else:
        last_dt = pd.Timestamp(s_clean.index[-1]).normalize()
        source_freshness[src_name] = {
            "lastDate": last_dt.strftime("%Y-%m-%d"),
            "lagTradingDays": lag_trading_days(last_dt),
        }


def _close_snapshot_at(series: pd.Series, dt: pd.Timestamp, change_mode: str = "pct") -> dict:
    s = series.dropna()
    s = s[s.index <= dt]
    if s.empty:
        return {"close": None, "prevClose": None, "asOfDate": None}
    cur = float(s.iloc[-1])
    as_of = pd.Timestamp(s.index[-1]).strftime("%Y-%m-%d")
    prev = float(s.iloc[-2]) if len(s) >= 2 else None
    out = {
        "close": round(cur, 4),
        "prevClose": round(prev, 4) if prev is not None else None,
        "asOfDate": as_of,
    }
    if change_mode == "bps":
        out["dailyChangeBps"] = (
            round((cur - prev) * 100.0, 2) if prev is not None else None
        )
    else:
        out["dailyReturnPct"] = (
            round((cur / prev - 1.0) * 100.0, 4)
            if (prev is not None and prev != 0)
            else None
        )
    return out


MARKET_INPUT_SERIES = {
    "spx": (spx, "pct"),
    "gold": (gld, "pct"),
    "wti": (wti, "pct"),
    "dxyBroad": (dxy, "pct"),
    "dxyIce": (dxy_ice, "pct"),
    "vix": (vix_clean, "pct"),
    "us10yYieldPct": (dgs10_raw, "bps"),
}


def build_market_close_inputs(dt: pd.Timestamp) -> dict:
    return {
        key: _close_snapshot_at(ser, dt, mode)
        for key, (ser, mode) in MARKET_INPUT_SERIES.items()
    }


# ── Scoring pipeline ──────────────────────────────────────────────────────────


def _align_to_cal(series: pd.Series) -> pd.Series:
    if series.empty:
        return pd.Series(index=TRADING_CAL, dtype=float)
    return series.sort_index().reindex(TRADING_CAL).ffill()


def make_factor_and_artifacts(
    slug: str,
    factor_id: str,
    name: str,
    disp_series: pd.Series,
    score_series: pd.Series,
    value_fmt: str,
    change_bps: bool,
    is_extra: bool,
    meta: dict,
) -> tuple:
    """
    Build frontend Factor dict plus aligned score/display/diagnostic series
    on TRADING_CAL. Returns (factor_dict, artifact_dict).
    """
    disp_native = disp_series.dropna().sort_index()
    if len(disp_native) < 10:
        return None, None

    disp_cal = _align_to_cal(disp_native).dropna()
    current = float(disp_native.iloc[-1])

    past_idx = disp_native.index.get_indexer(
        [disp_native.index[-1] - timedelta(days=7)], method="nearest"
    )[0]
    past_val = float(disp_native.iloc[max(0, past_idx)])

    if not is_extra:
        score_in_native = score_series.dropna().sort_index()
        if len(score_in_native) < 10:
            return None, None
        raw_pct_native = rolling_pct_strict_lt(score_in_native)
        factor_score_native = raw_pct_native.apply(
            lambda p: score_from_pct_raw(p, factor_id)
        )
        factor_score_cal = _align_to_cal(factor_score_native)
        raw_pct_cal = _align_to_cal(raw_pct_native)
        score_in_cal = _align_to_cal(score_in_native)

        raw_pct_now = float(raw_pct_native.iloc[-1])
        score_exact_now = float(factor_score_native.iloc[-1])
        status = get_status(score_exact_now)
        velocity = get_velocity(factor_score_cal, window=5)
        native_last_ts = pd.Timestamp(score_in_native.index[-1]).normalize()
    else:
        raw_pct_native = rolling_pct_strict_lt(disp_native)
        factor_score_native = pd.Series(dtype=float)
        factor_score_cal = pd.Series(dtype=float)
        raw_pct_cal = pd.Series(dtype=float)
        score_in_cal = pd.Series(dtype=float)

        raw_pct_now = float(raw_pct_native.iloc[-1])
        score_exact_now = score_from_pct_raw(raw_pct_now, factor_id)
        status = get_status(score_exact_now)
        velocity = "flat"
        native_last_ts = pd.Timestamp(disp_native.index[-1]).normalize()

    try:
        val_str = value_fmt.format(current)
    except Exception:
        val_str = f"{current:.4f}"

    chg_str, chg_dir = fmt_change(current, past_val, bps=change_bps)

    factor_dict = {
        "id": factor_id,
        "name": name,
        "value": val_str,
        "sevenDayChange": chg_str,
        "changeDirection": chg_dir,
        "historicalPercentile5Y": round(raw_pct_now, 1),
        "status": status,
        "velocity": velocity,
        "trendData": build_trend_data(disp_cal, days=90, decimals=4),
        "percentileData": percentile_dist(disp_native),
        "isExtra": is_extra,
    }
    if not is_extra:
        factor_dict["factorId"] = CANONICAL_FACTOR_IDS[factor_id]
        factor_dict["score"] = round(score_exact_now, 2)

    # Diagnostic series for clipped-floor factors & ovx_dev
    floor_tie_cal = pd.Series(dtype=float)
    baseline_med_cal = pd.Series(dtype=float)
    raw_ovx_cal = pd.Series(dtype=float)
    if not is_extra and meta:
        if meta.get("clipped_floor"):
            floor_tie_cal = _align_to_cal(rolling_floor_tie_share(score_in_native))
        if meta.get("baseline_series") is not None:
            baseline_med_cal = _align_to_cal(meta["baseline_series"].dropna().sort_index())
        if meta.get("raw_ovx_series") is not None:
            raw_ovx_cal = _align_to_cal(meta["raw_ovx_series"].dropna().sort_index())

    artifact = {
        "slug": factor_id,
        "canonicalId": CANONICAL_FACTOR_IDS.get(factor_id),
        "module": slug,
        "isExtra": is_extra,
        "direction": "lower_better" if factor_id in INVERT_FACTORS else "higher_better",
        "weightInModule": FACTOR_WEIGHTS.get(slug, {}).get(factor_id, 0.0),
        "scoreCal": factor_score_cal,
        "rawPctCal": raw_pct_cal,
        "dispCal": disp_cal,
        "scoreInCal": score_in_cal,
        "floorTieCal": floor_tie_cal,
        "baselineMedCal": baseline_med_cal,
        "rawOvxCal": raw_ovx_cal,
        "nativeAsOfDate": native_last_ts.strftime("%Y-%m-%d"),
        "lagTradingDays": lag_trading_days(native_last_ts),
    }
    return factor_dict, artifact


print("Scoring factors and building modules...")


def build_module_obj(slug: str, name: str, factor_specs: list) -> tuple:
    """
    factor_specs items:
      (factor_id, name, disp_series, score_series_or_none, fmt, change_bps, is_extra, meta_or_none)
    Returns (module_dict, mod_score_ts_cal, {factor_id: artifact_dict}).
    """
    factors = []
    artifacts = {}

    for spec in factor_specs:
        fid, fname, disp_s, score_s, ffmt, fbps, fextra, fmeta = spec
        use_score_s = disp_s if score_s is None else score_s
        f_dict, art = make_factor_and_artifacts(
            slug, fid, fname, disp_s, use_score_s, ffmt, fbps, fextra, fmeta or {}
        )
        if f_dict is not None:
            factors.append(f_dict)
            if not fextra:
                artifacts[fid] = art

    scored_ids = [f["id"] for f in factors if not f["isExtra"]]
    if not scored_ids:
        return None, pd.Series(dtype=float), {}

    fw = FACTOR_WEIGHTS.get(slug, {})
    df_scores = pd.concat([artifacts[fid]["scoreCal"] for fid in scored_ids], axis=1)
    df_scores.columns = scored_ids
    # Require full factor availability across module rows so partial warmup doesn't create cliffs
    df_scores = df_scores.dropna(how="any")

    weights = np.array([fw.get(fid, 1.0 / len(scored_ids)) for fid in scored_ids], dtype=float)
    weights = weights / weights.sum()
    raw_mod_ts = (df_scores * weights).sum(axis=1)

    if slug == "funding":
        mod_score_ts = raw_mod_ts.ewm(span=5, adjust=False).mean()
    else:
        mod_score_ts = raw_mod_ts

    module_score = round(float(mod_score_ts.iloc[-1]), 1)
    mod_trend = build_score_trend(mod_score_ts, 90)
    mod_pct = (
        round(float(rolling_pct_strict_lt(mod_score_ts).iloc[-1]), 1)
        if len(mod_score_ts) > 10
        else 50.0
    )

    if len(mod_score_ts) >= 6:
        prev_score = round(float(mod_score_ts.iloc[-6]), 1)
    else:
        prev_score = module_score

    change_pct = round((module_score - prev_score) / max(prev_score, 0.01) * 100.0, 2)

    recent = mod_score_ts.tail(3)
    if len(recent) >= 2 and recent.iloc[-1] > recent.iloc[0] + 1.0:
        trend_dir = "improving"
    elif len(recent) >= 2 and recent.iloc[-1] < recent.iloc[0] - 1.0:
        trend_dir = "declining"
    else:
        trend_dir = "stable"

    if module_score >= 66:
        color = "#14b8a6"
    elif module_score >= 33:
        color = "#f97316"
    else:
        color = "#ef4444"

    module = {
        "slug": slug,
        "name": name,
        "score": module_score,
        "prevScore": prev_score,
        "sevenDayChangePct": change_pct,
        "trendDays": 2,
        "trendDirection": trend_dir,
        "percentile5Y": mod_pct,
        "lastUpdated": f"Updated {AS_OF_DATE.strftime('%b %d, %Y')}",
        "updatedAt": NOW_UTC.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "color": color,
        "trendData": mod_trend,
        "factors": factors,
    }
    return module, mod_score_ts, artifacts


# ─── Module specs ──────────────────────────────────────────────────────────

all_specs = {
    "liquidity": (
        "Liquidity",
        [
            ("fed-net-liquidity", "Fed Net Liquidity", net_liq, net_liq, "${:.2f}B", False, False, None),
            ("bank-reserves", "Bank Reserves", wresbal_b, wresbal_weekly_b, "${:.2f}B", False, False, None),
            ("net-liquidity-momentum", "Net Liquidity Momentum (13W)", net_liq_mom, net_liq_mom, "${:.2f}B", False, False, None),
            ("tga-deviation", "TGA Deviation", tga_deviation, tga_deviation, "${:.2f}B", False, False, None),
            ("on-rrp-buffer-risk", "ON RRP Buffer Risk", on_rrp_risk, on_rrp_risk, "{:.4f}", False, False, None),
            ("fed-total-assets", "Fed Total Assets", walcl_b, None, "${:.2f}B", False, True, None),
            ("treasury-general-account", "Treasury General Account", wdtgal_b, None, "${:.2f}B", False, True, None),
            ("on-rrp", "ON RRP", rrp_b, None, "${:.2f}B", False, True, None),
        ],
    ),
    "funding": (
        "Funding",
        [
            ("collateral-repo-friction", "Collateral/Repo Friction", coll_repo, coll_repo_score_in, "{:.4%}", True, False, None),
            ("corridor-friction-1", "Corridor Friction 1", corr_fric_1, corr_fric_1_score_in, "{:.4%}", True, False, None),
            ("corridor-friction-2", "Corridor Friction 2", corr_fric_2, corr_fric_2_score_in, "{:.4%}", True, False, None),
            ("effr-iorb-spread", "EFFR−IORB Spread", effr_iorb, effr_iorb, "{:.4%}", True, False, None),
            ("cp-tbill-spread", "CP-TBill Spread", cp_tbill, cp_tbill, "{:.4%}", True, False, None),
            ("funding-fragmentation", "Funding Fragmentation (21D)", funding_frag, funding_frag, "{:.4f}", False, False, None),
            ("effr", "EFFR", dff, None, "{:.2%}", True, True, None),
            ("sofr", "SOFR", sofr, None, "{:.2%}", True, True, None),
            ("iorb", "IORB", iorb, None, "{:.2%}", True, True, None),
            ("on-rrp-award-rate", "ON RRP Award Rate", rrp_rate, None, "{:.2%}", True, True, None),
            ("obfr-rate", "OBFR Rate", obfr, None, "{:.2%}", True, True, None),
        ],
    ),
    "treasury": (
        "Treasury",
        [
            ("30y-10y-term-premium", "30Y-10Y Term Premium", term_30_10, term_30_10, "{:.2%}", True, False, None),
            ("10y-rate-volatility", "10Y Rate Volatility (21D)", rate_vol_21, rate_vol_21, "{:.4f}", False, False, None),
            (
                "curve-curvature",
                "Curve Curvature (Abs)",
                curve_curv,
                curve_curv_score_in,
                "{:.4%}",
                True,
                False,
                {"clipped_floor": True, "baseline_series": curve_curv_med252},
            ),
            ("10y-2y-spread", "10Y-2Y Spread", (dgs10 - dgs2).dropna(), None, "{:.2%}", True, True, None),
            ("10y-3m-spread", "10Y-3M Spread", (dgs10 - dgs3m).dropna(), None, "{:.2%}", True, True, None),
            ("10y-nominal-rate", "10Y Nominal Rate", dgs10, None, "{:.2%}", True, True, None),
            ("30y-rate", "30Y Rate", dgs30, None, "{:.2%}", True, True, None),
            ("2y-rate", "2Y Rate", dgs2, None, "{:.2%}", True, True, None),
        ],
    ),
    "rates": (
        "Rates",
        [
            ("real-rate-level", "Real Rate Level", real_level, real_level, "{:.2%}", True, False, None),
            ("real-curve", "Real Curve (10Y-5Y)", real_curve_10_5, real_curve_10_5, "{:.2%}", True, False, None),
            ("10y-breakeven", "10Y Breakeven", t10yie_clean, t10yie_clean, "{:.2%}", True, False, None),
            ("5y-real-rate", "5Y Real Rate", dfii5, None, "{:.2%}", True, True, None),
            ("10y-real-rate", "10Y Real Rate", dfii10, None, "{:.2%}", True, True, None),
        ],
    ),
    "credit": (
        "Credit",
        [
            ("nfci", "NFCI", nfci, nfci_weekly, "{:.2f}", False, False, None),
            ("hy-credit", "HY Credit", hy_credit, hy_credit, "{:.2%}", False, False, None),
            ("ig-credit", "IG Credit", ig_credit, ig_credit, "{:.2%}", False, False, None),
            ("regional-banks-spy", "Regional Banks vs SPY", kb_spy, kb_spy, "{:.2%}", False, False, None),
        ],
    ),
    "risk": (
        "Risk",
        [
            ("vix", "VIX", vix_clean, vix_clean, "{:.2f}", False, False, None),
            ("vix-term-structure", "VIX Term Structure", vix_ts, vix_ts, "{:.4f}", False, False, None),
            ("risk-vs-safe", "Risk vs Safe", risk_safe, risk_safe, "{:.2%}", False, False, None),
            ("high-beta-preference", "High-Beta Preference", hi_beta, hi_beta, "{:.2%}", False, False, None),
            ("vix-3m", "VIX 3M", vix3m, None, "{:.2f}", False, True, None),
        ],
    ),
    "external": (
        "External",
        [
            ("dxy", "US Dollar Index (DXY)", dxy, dxy, "{:.2f}", False, False, None),
            ("fx-realized-volatility", "FX Realized Volatility", fx_rvol, fx_rvol, "{:.4f}", False, False, None),
            (
                "wti-oil",
                "WTI Oil",
                wti,
                wti_score_in,
                "${:.2f}",
                False,
                False,
                {"clipped_floor": True, "baseline_series": wti_med252},
            ),
            (
                "oil-volatility-deviation",
                "Oil Volatility Deviation",
                oil_vol_dev,
                oil_vol_dev,
                "{:.3f}",
                False,
                False,
                {"clipped_floor": True, "baseline_series": ovx_med252, "raw_ovx_series": ovx_clean},
            ),
            (
                "natural-gas",
                "Natural Gas",
                ng_clean,
                ng_score_in,
                "${:.2f}",
                False,
                False,
                {"clipped_floor": True, "baseline_series": ng_med252},
            ),
        ],
    ),
}

# Build all modules
modules = {}
mod_score_ts_map = {}
all_factor_artifacts = {}
for slug, (mname, specs) in all_specs.items():
    print(f"  Building module: {slug}")
    mod, mod_ts, mod_artifacts = build_module_obj(slug, mname, specs)
    if mod:
        modules[slug] = mod
        mod_score_ts_map[slug] = mod_ts
        all_factor_artifacts.update(mod_artifacts)

# ── Overall score ──────────────────────────────────────────────────────────

print("Computing overall score...")

mod_ts_df = pd.concat(
    {slug: mod_score_ts_map[slug] for slug in MODULE_WEIGHTS if slug in mod_score_ts_map},
    axis=1,
).dropna(how="any")

mod_w_vec = np.array([MODULE_WEIGHTS[slug] for slug in mod_ts_df.columns], dtype=float)
mod_w_vec = mod_w_vec / mod_w_vec.sum()
overall_ts = (mod_ts_df * mod_w_vec).sum(axis=1)

overall_score = round(float(overall_ts.iloc[-1]), 1)
prev_overall = (
    round(float(overall_ts.iloc[-6]), 1) if len(overall_ts) >= 6 else overall_score
)

overall_trend = build_score_trend(overall_ts, 90)
overall_pct = (
    round(float(rolling_pct_strict_lt(overall_ts).iloc[-1]), 1)
    if len(overall_ts) > 10
    else 50.0
)

rec = overall_ts.tail(3)
if len(rec) >= 2 and rec.iloc[-1] > rec.iloc[0] + 0.5:
    overall_trend_dir = "improving"
elif len(rec) >= 2 and rec.iloc[-1] < rec.iloc[0] - 0.5:
    overall_trend_dir = "declining"
else:
    overall_trend_dir = "stable"

# ── Score Lift / Drag (5 US trading days) ────────────────────────────────────

print("Computing Lift/Drag attribution...")

lift_drag = []
for slug, w in MODULE_WEIGHTS.items():
    if slug not in modules:
        continue
    fw = FACTOR_WEIGHTS.get(slug, {})
    scored = [f for f in modules[slug]["factors"] if not f["isExtra"]]
    for f in scored:
        fid = f["id"]
        art = all_factor_artifacts.get(fid)
        if not art:
            continue
        ss = art["scoreCal"].dropna()
        if len(ss) < 6:
            continue
        factor_w = fw.get(fid, 1.0 / len(scored)) * w
        score_now = float(ss.iloc[-1])
        score_prev = float(ss.iloc[-6])
        contrib = (score_now - score_prev) * factor_w
        lift_drag.append({"name": f["name"], "pts": round(contrib, 2)})

lift_drag.sort(key=lambda x: x["pts"], reverse=True)
score_lift = [i for i in lift_drag if i["pts"] > 0]
score_drag = [i for i in lift_drag if i["pts"] < 0]

# ── Canonical scoredFactors snapshot & 90-day history JSONL ──────────────────


def build_scored_factors_at(dt: pd.Timestamp, include_meta: bool) -> dict:
    out = {}
    for fid, art in all_factor_artifacts.items():
        cid = art["canonicalId"]
        sc_val = float(art["scoreCal"].loc[dt])
        disp_val = float(art["dispCal"].loc[dt])
        sin_val = float(art["scoreInCal"].loc[dt])
        pct_val = float(art["rawPctCal"].loc[dt])

        entry = {
            "score": round(sc_val, 2),
            "status": get_status_title(sc_val),
            "rawValue": round(disp_val, 6),
            "scoreInput": round(sin_val, 6),
            "rawPercentile5Y": round(pct_val, 2),
        }

        if not art["baselineMedCal"].empty and dt in art["baselineMedCal"].index:
            med_v = float(art["baselineMedCal"].loc[dt])
            entry["baselineMedian252d"] = round(med_v, 4)
            if cid == "ovx_dev":
                entry["ovxMedian252d"] = round(med_v, 4)
        if not art["floorTieCal"].empty and dt in art["floorTieCal"].index:
            entry["floorTieShare"] = round(float(art["floorTieCal"].loc[dt]), 4)
        if cid == "ovx_dev" and not art["rawOvxCal"].empty and dt in art["rawOvxCal"].index:
            entry["rawOvx"] = round(float(art["rawOvxCal"].loc[dt]), 4)

        if include_meta:
            entry["factorId"] = cid
            entry["slug"] = fid
            entry["module"] = art["module"]
            entry["direction"] = art["direction"]
            entry["weightInModule"] = art["weightInModule"]
            entry["asOfDate"] = art["nativeAsOfDate"]
            entry["lagTradingDays"] = art["lagTradingDays"]

        out[cid] = entry
    return out


latest_market_inputs = build_market_close_inputs(AS_OF_TS)
latest_scored_factors = build_scored_factors_at(AS_OF_TS, include_meta=True)

# Trailing 90 US trading days JSONL for downstream backtest & shadow replay
trailing_90_dates = overall_ts.index[-90:]
generated_at_utc = NOW_UTC.strftime("%Y-%m-%dT%H:%M:%SZ")
generated_at_et = NOW_ET.isoformat()

PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)
with open(HISTORY_OUTPUT_PATH, "w") as hf:
    for dt in trailing_90_dates:
        row_scope = "post_close" if dt.date() < AS_OF_DATE else SESSION_SCOPE
        row = {
            "asOfTradingDate": pd.Timestamp(dt).strftime("%Y-%m-%d"),
            "calibrationVersion": CALIBRATION_VERSION,
            "generatedAtUtc": generated_at_utc,
            "sessionScope": row_scope,
            "overallScore": round(float(overall_ts.loc[dt]), 2),
            "moduleScores": {
                slug: round(float(mod_score_ts_map[slug].loc[dt]), 2)
                for slug in MODULE_WEIGHTS
                if slug in mod_score_ts_map
            },
            "scoredFactors": build_scored_factors_at(dt, include_meta=False),
            "marketCloseInputs": build_market_close_inputs(dt),
        }
        hf.write(json.dumps(row, sort_keys=True) + "\n")

# ── Assemble final dashboard JSON ─────────────────────────────────────────────

dashboard = {
    "calibrationVersion": CALIBRATION_VERSION,
    "asOfTradingDate": AS_OF_DATE.strftime("%Y-%m-%d"),
    "generatedAtUtc": generated_at_utc,
    "generatedAtEt": generated_at_et,
    "sessionScope": SESSION_SCOPE,
    "sourceFreshness": source_freshness,
    "marketCloseInputs": latest_market_inputs,
    "scoredFactors": latest_scored_factors,
    "score": overall_score,
    "prevScore": prev_overall,
    "trendDays": 2,
    "trendDirection": overall_trend_dir,
    "percentile5Y": overall_pct,
    "lastUpdated": f"Updated {AS_OF_DATE.strftime('%b %d, %Y')}",
    "updatedAt": generated_at_utc,
    "trendData": overall_trend,
    "modules": list(modules.values()),
    "scoreLift": score_lift,
    "scoreDrag": score_drag,
}

with open(OUTPUT_PATH, "w") as f:
    json.dump(dashboard, f, indent=2, default=str)

print(f"\n✓ Done! Written to {OUTPUT_PATH} and {HISTORY_OUTPUT_PATH}")
print(
    f"  As-Of Trading Date: {AS_OF_DATE} | Session Scope: {SESSION_SCOPE} | "
    f"Version: {CALIBRATION_VERSION}"
)
print(f"  Overall Score: {overall_score} (prev 5TD: {prev_overall})")
for slug, mod in modules.items():
    print(f"  {mod['name']:12s}: {mod['score']:.1f} (prev 5TD: {mod['prevScore']:.1f})")
