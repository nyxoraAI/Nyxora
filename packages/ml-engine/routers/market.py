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
    
    poolCreatedAt: Optional[int] = None
    txns24h: Optional[int] = None
    
    # New indicators
    rsi: Optional[float]
    ma50: Optional[float]
    ema20: Optional[float]
    macd: Optional[float]
    macdSignal: Optional[float]
    macdHistogram: Optional[float]
    bollingerUpper: Optional[float]
    bollingerLower: Optional[float]
    bollingerBandwidth: Optional[float]
    atr14: Optional[float]
    obv: Optional[float]
    obvTrend: Optional[str]
    
    # Trend
    trendClassification: Optional[str]
    trendConfidence: Optional[float]
    narrative: Optional[str]
    
    isCexAsset: bool
    momentumSources: Optional[List[str]] = None

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
    return re.sub(r'[^A-Z0-9]', '', symbol.upper())

async def _closes_binance(client: httpx.AsyncClient, symbol: str) -> Optional[pd.DataFrame]:
    try:
        r = await client.get(
            f"https://data-api.binance.vision/api/v3/klines?symbol={symbol}USDT&interval=1d&limit=100",
            timeout=10
        )
        data = r.json()
        if isinstance(data, list) and len(data) >= 20:
            df = pd.DataFrame(data, columns=['ts', 'open', 'high', 'low', 'close', 'volume', 'close_time', 'qav', 'trades', 'tbb', 'tbq', 'ignore'])
            return df[['high', 'low', 'close', 'volume']].astype(float)
    except Exception as e:
        print(f"[ML] Binance error for {symbol}: {e}")
    return None

async def _closes_bybit(client: httpx.AsyncClient, symbol: str) -> Optional[pd.DataFrame]:
    try:
        r = await client.get(
            f"https://api.bybit.com/v5/market/kline?category=linear&symbol={symbol}USDT&interval=D&limit=100",
            timeout=10
        )
        data = r.json()
        klines = data.get("result", {}).get("list", [])
        if isinstance(klines, list) and len(klines) >= 20:
            df = pd.DataFrame(reversed(klines), columns=['ts', 'open', 'high', 'low', 'close', 'volume', 'turnover'])
            return df[['high', 'low', 'close', 'volume']].astype(float)
    except Exception as e:
        print(f"[ML] Bybit error for {symbol}: {e}")
    return None

async def _closes_okx(client: httpx.AsyncClient, symbol: str) -> Optional[pd.DataFrame]:
    try:
        r = await client.get(
            f"https://www.okx.com/api/v5/market/candles?instId={symbol}-USDT&bar=1D&limit=100",
            timeout=10
        )
        data = r.json()
        klines = data.get("data", [])
        if isinstance(klines, list) and len(klines) >= 20:
            df = pd.DataFrame(reversed(klines), columns=['ts', 'open', 'high', 'low', 'close', 'vol', 'volCcy', 'volCcyQuote', 'confirm'])
            df['volume'] = df['vol']
            return df[['high', 'low', 'close', 'volume']].astype(float)
    except Exception as e:
        print(f"[ML] OKX error for {symbol}: {e}")
    return None

async def _closes_kucoin(client: httpx.AsyncClient, symbol: str) -> Optional[pd.DataFrame]:
    try:
        now = int(datetime.now(timezone.utc).timestamp())
        start = now - (100 * 86400)
        r = await client.get(
            f"https://api.kucoin.com/api/v1/market/candles?type=1day&symbol={symbol}-USDT&startAt={start}&endAt={now}",
            timeout=10
        )
        data = r.json()
        klines = data.get("data", [])
        if isinstance(klines, list) and len(klines) >= 20:
            df = pd.DataFrame(reversed(klines), columns=['time', 'open', 'close', 'high', 'low', 'volume', 'turnover'])
            return df[['high', 'low', 'close', 'volume']].astype(float)
    except Exception as e:
        print(f"[ML] KuCoin error for {symbol}: {e}")
    return None

async def _closes_mexc(client: httpx.AsyncClient, symbol: str) -> Optional[pd.DataFrame]:
    try:
        r = await client.get(
            f"https://api.mexc.com/api/v3/klines?symbol={symbol}USDT&interval=1d&limit=100",
            timeout=10
        )
        data = r.json()
        if isinstance(data, list) and len(data) >= 20:
            df = pd.DataFrame(data, columns=['ts', 'open', 'high', 'low', 'close', 'volume', 'close_time', 'qav', 'trades', 'tbb', 'tbq', 'ignore'])
            return df[['high', 'low', 'close', 'volume']].astype(float)
    except Exception as e:
        print(f"[ML] MEXC error for {symbol}: {e}")
    return None

def safe_float(v, default=0.0):
    if pd.isna(v) or not np.isfinite(v):
        return default
    return float(v)

def _compute_indicators(df: pd.DataFrame, current_price: float):
    close = df['close']
    high = df['high']
    low = df['low']
    vol = df['volume']
    
    ma50 = close.rolling(50, min_periods=1).mean().iloc[-1]
    ema20 = close.ewm(span=20, adjust=False).mean().iloc[-1]
    
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi_val = 100 - (100 / (1 + rs))
    rsi_val = rsi_val.iloc[-1]
    if pd.isna(rsi_val):
        rsi_val = 50.0
        
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    macd_signal = macd.ewm(span=9, adjust=False).mean()
    macd_hist = macd - macd_signal
    
    sma20 = close.rolling(20, min_periods=1).mean()
    std20 = close.rolling(20, min_periods=1).std()
    bb_up = sma20 + (2 * std20)
    bb_low = sma20 - (2 * std20)
    bb_width = (bb_up - bb_low) / sma20 * 100
    
    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr14 = tr.rolling(14, min_periods=1).mean().iloc[-1]
    
    obv = (np.sign(delta) * vol).fillna(0).cumsum().iloc[-1]
    obv_ma = (np.sign(delta) * vol).fillna(0).cumsum().rolling(10, min_periods=1).mean().iloc[-1]
    obv_trend = "accumulation" if obv > obv_ma else "distribution"
    
    return {
        "rsi": safe_float(rsi_val, 50.0),
        "ma50": safe_float(ma50, current_price),
        "ema20": safe_float(ema20, current_price),
        "macd": safe_float(macd.iloc[-1]),
        "macdSignal": safe_float(macd_signal.iloc[-1]),
        "macdHistogram": safe_float(macd_hist.iloc[-1]),
        "bollingerUpper": safe_float(bb_up.iloc[-1]),
        "bollingerLower": safe_float(bb_low.iloc[-1]),
        "bollingerBandwidth": safe_float(bb_width.iloc[-1]),
        "atr14": safe_float(atr14),
        "obv": safe_float(obv),
        "obvTrend": obv_trend
    }

def classify_trend(indicators: dict, current_price: float):
    score = 0
    max_score = 6
    
    rsi = indicators.get('rsi', 50)
    macd_hist = indicators.get('macdHistogram', 0)
    ema20 = indicators.get('ema20', current_price)
    ma50 = indicators.get('ma50', current_price)
    
    if current_price > ma50: score += 1
    if current_price > ema20: score += 1
    if ema20 > ma50: score += 1
    if macd_hist > 0: score += 1
    if rsi > 50: score += 1
    if indicators.get('obvTrend') == 'accumulation': score += 1
    
    confidence = (score / max_score) * 100
    
    if score >= 5: return "STRONG_BULLISH", confidence
    if score >= 4: return "BULLISH", confidence
    if score >= 3: return "NEUTRAL", confidence
    if score >= 2: return "BEARISH", 100 - confidence
    return "STRONG_BEARISH", 100 - confidence

def generate_narrative(symbol: str, classification: str, confidence: float, indicators: dict):
    narrative = f"{symbol} is currently in a {classification} trend ({confidence:.0f}% confidence). "
    
    if classification in ["STRONG_BULLISH", "BULLISH"]:
        narrative += f"Price action shows strength above key moving averages. "
    elif classification in ["STRONG_BEARISH", "BEARISH"]:
        narrative += f"Price faces downward pressure below key moving averages. "
    else:
        narrative += f"The market is moving sideways. "
        
    macd_hist = indicators.get('macdHistogram', 0)
    if macd_hist > 0:
        narrative += "MACD shows positive momentum. "
    else:
        narrative += "MACD indicates negative momentum. "
        
    rsi = indicators.get('rsi', 50)
    if rsi > 70:
        narrative += "RSI is overbought (>70), warning of a potential pullback. "
    elif rsi < 30:
        narrative += "RSI is oversold (<30), hinting at a potential bounce. "
        
    obv_trend = indicators.get('obvTrend')
    if obv_trend == 'accumulation':
        narrative += "Volume profile (OBV) indicates accumulation by buyers."
    elif obv_trend == 'distribution':
        narrative += "Volume profile (OBV) suggests distribution by sellers."
        
    return narrative

async def calculate_momentum(symbol: str, current_price: float):
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
            return_exceptions=True
        )

    dfs = []
    sources = []
    for name, res in zip(EXCHANGE_NAMES, results):
        if isinstance(res, pd.DataFrame) and len(res) >= 14:
            dfs.append(res)
            sources.append(name)

    if not dfs:
        log.warning(f"[ML Engine] ⚠️ No exchange returned valid data for {clean_symbol}.")
        return {"ma50": current_price, "rsi": 50.0, "momentumSources": []}

    # Aggregate by averaging across all valid dataframes
    all_inds = []
    for df in dfs:
        try:
            inds = _compute_indicators(df, current_price)
            all_inds.append(inds)
        except Exception as e:
            pass

    if not all_inds:
        return {"ma50": current_price, "rsi": 50.0, "momentumSources": []}

    # Average the indicators
    avg_inds = {}
    for key in all_inds[0].keys():
        if isinstance(all_inds[0][key], (int, float)):
            avg_inds[key] = sum([ind[key] for ind in all_inds]) / len(all_inds)
        else:
            # For categorical like obvTrend, take majority
            vals = [ind[key] for ind in all_inds]
            avg_inds[key] = max(set(vals), key=vals.count)

    avg_inds['momentumSources'] = sources
    
    # Classify trend & generate narrative
    classification, confidence = classify_trend(avg_inds, current_price)
    narrative = generate_narrative(clean_symbol, classification, confidence, avg_inds)
    
    avg_inds['trendClassification'] = classification
    avg_inds['trendConfidence'] = confidence
    avg_inds['narrative'] = narrative

    return avg_inds

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
    is_cex_asset = False
    
    pool_created_at = None
    txns_24h = None
    
    mom = {}
    
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
            
            pool_created_at = pair.get('pairCreatedAt')
            txns = pair.get('txns', {}).get('h24', {})
            txns_24h = txns.get('buys', 0) + txns.get('sells', 0)
            
            mom = await calculate_momentum(official_symbol, current_price)
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
        else:
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
                
                pool_created_at = pair.get('pairCreatedAt')
                txns = pair.get('txns', {}).get('h24', {})
                txns_24h = txns.get('buys', 0) + txns.get('sells', 0)
                
                mom = await calculate_momentum(official_symbol, current_price)
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
        
        poolCreatedAt=pool_created_at,
        txns24h=txns_24h,
        
        rsi=mom.get('rsi'),
        ma50=mom.get('ma50'),
        ema20=mom.get('ema20'),
        macd=mom.get('macd'),
        macdSignal=mom.get('macdSignal'),
        macdHistogram=mom.get('macdHistogram'),
        bollingerUpper=mom.get('bollingerUpper'),
        bollingerLower=mom.get('bollingerLower'),
        bollingerBandwidth=mom.get('bollingerBandwidth'),
        atr14=mom.get('atr14'),
        obv=mom.get('obv'),
        obvTrend=mom.get('obvTrend'),
        
        trendClassification=mom.get('trendClassification'),
        trendConfidence=mom.get('trendConfidence'),
        narrative=mom.get('narrative'),
        
        isCexAsset=is_cex_asset,
        momentumSources=mom.get('momentumSources')
    )
