import re
import asyncio
import httpx
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from config import config
import logging
import warnings

# SSL note: the host system's CA bundle is missing intermediate certificates
# (confirmed: curl also fails without --insecure on this machine).
# verify=False is intentional here — all target domains are well-known exchanges.
SSL_VERIFY = False
log = logging.getLogger("uvicorn.error")

if not SSL_VERIFY:
    warnings.filterwarnings("ignore", message="Unverified HTTPS request")
    log.warning(
        "[ML Engine] ⚠️  SSL_VERIFY=False: system CA bundle is incomplete. "
        "All exchange HTTPS requests run without certificate verification. "
        "Set SSL_CERT_FILE env var to a valid CA bundle to fix this properly."
    )


router = APIRouter()

class MarketResponse(BaseModel):
    officialSymbol: str
    contractAddress: Optional[str]
    network: str
    currentPrice: float
    mcapUsd: float
    liquidityUsd: float
    volume24h: float
    priceChange24h: float
    rsi: Optional[float]
    ma50: Optional[float]
    isCexAsset: bool
    momentumSources: Optional[List[str]] = None  # exchanges yang berhasil contribute data

async def fetch_dexscreener(query: str, is_ca: bool, chain: str = None):
    url = f"https://api.dexscreener.com/latest/dex/tokens/{query}" if is_ca else f"https://api.dexscreener.com/latest/dex/search?q={query}"
    async with httpx.AsyncClient(verify=SSL_VERIFY) as client:
        try:
            resp = await client.get(url, timeout=10)
            data = resp.json()
            if data and data.get('pairs'):
                pairs = data['pairs']
                if chain and chain.lower() != "unknown":
                    filtered = [p for p in pairs if p.get('chainId', '').lower() == chain.lower()]
                    if filtered:
                        pairs = filtered
                pairs = sorted(pairs, key=lambda x: x.get('volume', {}).get('h24', 0), reverse=True)
                return pairs[0]
        except Exception as e:
            print(f"DexScreener Error: {e}")
    return None

async def fetch_coingecko(symbol: str):
    cg_key = config.get_market_key("coingecko_key")
    is_pro = bool(cg_key)
    base_url = "https://pro-api.coingecko.com/api/v3" if is_pro else "https://api.coingecko.com/api/v3"
    headers = {"x-cg-pro-api-key": cg_key} if is_pro else {}
    
    async with httpx.AsyncClient(verify=SSL_VERIFY) as client:
        try:
            search_resp = await client.get(f"{base_url}/search?query={symbol}", headers=headers, timeout=10)
            coins = search_resp.json().get('coins', [])
            target = next((c for c in coins if c['symbol'].lower() == symbol.lower() or c['id'].lower() == symbol.lower()), None)
            
            if target:
                detail = await client.get(f"{base_url}/coins/{target['id']}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false", headers=headers, timeout=10)
                market = detail.json().get('market_data', {})
                return {
                    "symbol": target['symbol'].upper(),
                    "price": market.get("current_price", {}).get("usd", 0),
                    "mcap": market.get("market_cap", {}).get("usd", 0),
                    "fdv": market.get("fully_diluted_valuation", {}).get("usd") or market.get("market_cap", {}).get("usd", 0),
                    "vol": market.get("total_volume", {}).get("usd", 0),
                    "change": market.get("price_change_percentage_24h", 0)
                }
        except Exception as e:
            print(f"CoinGecko Error: {e}")
    return None

def _sanitize_symbol(symbol: str) -> str:
    """Strip characters that most CEX APIs don't accept (dots, dashes, spaces, etc)."""
    return re.sub(r'[^A-Z0-9]', '', symbol.upper())


# ─── Per-exchange close price fetchers ────────────────────────────────────────
# Each returns a list of daily close prices (oldest → newest), or None on failure.

async def _closes_binance(client: httpx.AsyncClient, symbol: str) -> Optional[List[float]]:
    """Binance: [ts, open, high, low, close, ...] — close = index 4, oldest first."""
    try:
        r = await client.get(
            f"https://api.binance.com/api/v3/klines?symbol={symbol}USDT&interval=1d&limit=50",
            timeout=10
        )
        data = r.json()
        if isinstance(data, list) and len(data) >= 14:
            return [float(k[4]) for k in data]
    except Exception as e:
        print(f"[ML] Binance error for {symbol}: {e}")
    return None


async def _closes_bybit(client: httpx.AsyncClient, symbol: str) -> Optional[List[float]]:
    """Bybit v5: result.list = [[ts, open, high, low, close, ...]] — newest first."""
    try:
        r = await client.get(
            f"https://api.bybit.com/v5/market/kline?category=linear&symbol={symbol}USDT&interval=D&limit=50",
            timeout=10
        )
        data = r.json()
        klines = data.get("result", {}).get("list", [])
        if isinstance(klines, list) and len(klines) >= 14:
            return [float(k[4]) for k in reversed(klines)]  # close = index 4, reverse to oldest-first
    except Exception as e:
        print(f"[ML] Bybit error for {symbol}: {e}")
    return None


async def _closes_okx(client: httpx.AsyncClient, symbol: str) -> Optional[List[float]]:
    """OKX: data = [[ts, open, high, low, close, ...]] — newest first."""
    try:
        r = await client.get(
            f"https://www.okx.com/api/v5/market/candles?instId={symbol}-USDT&bar=1D&limit=50",
            timeout=10
        )
        data = r.json()
        klines = data.get("data", [])
        if isinstance(klines, list) and len(klines) >= 14:
            return [float(k[4]) for k in reversed(klines)]  # close = index 4, reverse to oldest-first
    except Exception as e:
        print(f"[ML] OKX error for {symbol}: {e}")
    return None


async def _closes_kucoin(client: httpx.AsyncClient, symbol: str) -> Optional[List[float]]:
    """KuCoin: data = [[ts_sec, open, close, high, low, vol]] — newest first, close = index 2."""
    try:
        now = int(datetime.now(timezone.utc).timestamp())
        start = now - (50 * 86400)
        r = await client.get(
            f"https://api.kucoin.com/api/v1/market/candles?type=1day&symbol={symbol}-USDT&startAt={start}&endAt={now}",
            timeout=10
        )
        data = r.json()
        klines = data.get("data", [])
        if isinstance(klines, list) and len(klines) >= 14:
            return [float(k[2]) for k in reversed(klines)]  # close = index 2, reverse to oldest-first
    except Exception as e:
        print(f"[ML] KuCoin error for {symbol}: {e}")
    return None


async def _closes_mexc(client: httpx.AsyncClient, symbol: str) -> Optional[List[float]]:
    """MEXC: same wire format as Binance — [ts, open, high, low, close, ...], close = index 4."""
    try:
        r = await client.get(
            f"https://api.mexc.com/api/v3/klines?symbol={symbol}USDT&interval=1d&limit=50",
            timeout=10
        )
        data = r.json()
        if isinstance(data, list) and len(data) >= 14:
            return [float(k[4]) for k in data]
    except Exception as e:
        print(f"[ML] MEXC error for {symbol}: {e}")
    return None


# ─── RSI + MA50 calculator ────────────────────────────────────────────────────

def _compute_rsi_ma50(closes: List[float], current_price: float):
    """Returns (rsi, ma50) from a list of daily close prices."""
    s = pd.Series(closes, dtype=float)

    ma50 = float(s.rolling(window=min(50, len(s))).mean().iloc[-1])
    if not np.isfinite(ma50):
        ma50 = current_price

    delta = s.diff()
    gain = delta.clip(lower=0).rolling(window=14).mean()
    loss = (-delta.clip(upper=0)).rolling(window=14).mean()
    loss_safe = loss.replace(0, np.nan)
    rs = gain / loss_safe
    rsi_val = float((100 - (100 / (1 + rs))).iloc[-1])
    if not np.isfinite(rsi_val):
        rsi_val = 100.0 if float(gain.iloc[-1]) > 0 else 50.0

    return rsi_val, ma50


# ─── Main momentum aggregator ─────────────────────────────────────────────────

async def calculate_momentum(symbol: str, current_price: float):
    """Fetch daily candles from Binance, KuCoin, Bybit, OKX, MEXC concurrently.
    Average RSI-14 and MA-50 across all exchanges that return valid data."""
    import logging
    log = logging.getLogger("uvicorn.error")

    clean_symbol = _sanitize_symbol(symbol)
    if not clean_symbol:
        log.warning(f"[ML Engine] ⚠️ Invalid symbol '{symbol}', skipping momentum.")
        return {"ma50": current_price, "rsi": 50.0, "momentumSources": []}

    EXCHANGE_NAMES = ["Binance", "Bybit", "OKX", "KuCoin", "MEXC"]

    async with httpx.AsyncClient(verify=SSL_VERIFY) as client:
        results = await asyncio.gather(
            _closes_binance(client, clean_symbol),
            _closes_bybit(client, clean_symbol),
            _closes_okx(client, clean_symbol),
            _closes_kucoin(client, clean_symbol),
            _closes_mexc(client, clean_symbol),
            return_exceptions=True  # never let one exchange crash the whole call
        )

    rsi_vals, ma50_vals, sources = [], [], []
    for name, res in zip(EXCHANGE_NAMES, results):
        if isinstance(res, list) and len(res) >= 14:
            try:
                rsi_v, ma50_v = _compute_rsi_ma50(res, current_price)
                rsi_vals.append(rsi_v)
                ma50_vals.append(ma50_v)
                sources.append(name)
            except Exception as e:
                log.warning(f"[ML Engine] ⚠️ {name} compute error: {e}")

    if not sources:
        log.warning(f"[ML Engine] ⚠️ No exchange returned valid data for {clean_symbol}, using fallback.")
        return {"ma50": current_price, "rsi": 50.0, "momentumSources": []}

    avg_rsi  = float(np.mean(rsi_vals))
    avg_ma50 = float(np.mean(ma50_vals))

    log.info(
        f"[ML Engine] 📊 Multi-exchange momentum for {clean_symbol}: "
        f"RSI={avg_rsi:.2f}, MA50={avg_ma50:.4f} "
        f"(sources: {', '.join(sources)})"
    )
    return {"ma50": avg_ma50, "rsi": avg_rsi, "momentumSources": sources}

@router.get("/analyze", response_model=MarketResponse)
async def analyze_market(query: str, chain: str = "UNKNOWN"):
    clean_input = query.replace('$', '').lower()
    is_address = clean_input.startswith('0x') and len(clean_input) == 42
    
    official_symbol = clean_input.upper()
    contract_address = clean_input if is_address else None
    network = chain
    
    current_price = 0.0
    mcap_usd = 0.0
    liquidity_usd = 0.0
    volume_24h = 0.0
    price_change_24h = 0.0
    rsi = None
    ma50 = None
    momentum_sources: Optional[List[str]] = None
    is_cex_asset = False
    
    if is_address:
        pair = await fetch_dexscreener(clean_input, True, chain)
        if pair:
            official_symbol = pair['baseToken']['symbol']
            contract_address = pair['baseToken']['address']
            network = pair.get('chainId', chain).upper()
            current_price = float(pair.get('priceUsd', 0))
            mcap_usd = float(pair.get('fdv', 0))
            liquidity_usd = float(pair.get('liquidity', {}).get('usd', 0))
            volume_24h = float(pair.get('volume', {}).get('h24', 0))
            price_change_24h = float(pair.get('priceChange', {}).get('h24', 0))
            
            mom = await calculate_momentum(official_symbol, current_price)
            ma50, rsi = mom['ma50'], mom['rsi']
            momentum_sources = mom.get('momentumSources')
        else:
            raise HTTPException(status_code=404, detail="Token not found on DEX")
    else:
        cg_data = await fetch_coingecko(official_symbol)
        if cg_data:
            is_cex_asset = True
            network = "Global CEX/Market"
            official_symbol = cg_data['symbol']
            current_price = cg_data['price']
            volume_24h = cg_data['vol']
            price_change_24h = cg_data['change']
            mcap_usd = cg_data['fdv']
            liquidity_usd = mcap_usd * 0.10
            
            mom = await calculate_momentum(official_symbol, current_price)
            ma50, rsi = mom['ma50'], mom['rsi']
            momentum_sources = mom.get('momentumSources')
        else:
            # Fallback to DEX if CEX fails for a symbol
            pair = await fetch_dexscreener(clean_input, False, chain)
            if pair:
                official_symbol = pair['baseToken']['symbol']
                contract_address = pair['baseToken']['address']
                network = pair.get('chainId', chain).upper()
                current_price = float(pair.get('priceUsd', 0))
                mcap_usd = float(pair.get('fdv', 0))
                liquidity_usd = float(pair.get('liquidity', {}).get('usd', 0))
                volume_24h = float(pair.get('volume', {}).get('h24', 0))
                price_change_24h = float(pair.get('priceChange', {}).get('h24', 0))
                mom = await calculate_momentum(official_symbol, current_price)
                ma50, rsi = mom['ma50'], mom['rsi']
                momentum_sources = mom.get('momentumSources')
            else:
                raise HTTPException(status_code=404, detail="Token not found anywhere")

    return MarketResponse(
        officialSymbol=official_symbol,
        contractAddress=contract_address,
        network=network,
        currentPrice=current_price,
        mcapUsd=mcap_usd,
        liquidityUsd=liquidity_usd,
        volume24h=volume_24h,
        priceChange24h=price_change_24h,
        rsi=rsi,
        ma50=ma50,
        isCexAsset=is_cex_asset,
        momentumSources=momentum_sources
    )
