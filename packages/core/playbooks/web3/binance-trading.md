---
name: binance-trading
description: "Execute Spot and Futures trading on Binance using python and ccxt."
---

# Binance Spot & Futures Trading Playbook

When the user asks to "buy", "sell", "long", or "short" a token on Binance, or check Binance balances, follow this playbook.

## Prerequisites

1. Ensure Python and `ccxt` are installed.
   ```bash
   pip install ccxt
   ```
2. The user must have their Binance API Keys set up in the `~/.nyxora/binance-trading/.env` file:
   - `BINANCE_API_KEY`
   - `BINANCE_API_SECRET`

## Checking Balance

To check the user's Spot or Futures balance, create a temporary python script `check_binance.py` and run it:

```python
import ccxt
import os
from dotenv import load_dotenv

load_dotenv(os.path.expanduser('~/.nyxora/binance-trading/.env'))

exchange = ccxt.binance({
    'apiKey': os.getenv('BINANCE_API_KEY'),
    'secret': os.getenv('BINANCE_API_SECRET'),
    'enableRateLimit': True,
})

# For spot
spot_balance = exchange.fetch_balance()
print("Spot USDT:", spot_balance['USDT']['free'])

# For futures
exchange.options['defaultType'] = 'future'
futures_balance = exchange.fetch_balance()
print("Futures USDT:", futures_balance['USDT']['free'])
```

## Spot Trading (Market Order)

If the user wants to buy or sell on Spot:

```python
import ccxt
import os
from dotenv import load_dotenv

load_dotenv(os.path.expanduser('~/.nyxora/binance-trading/.env'))

exchange = ccxt.binance({
    'apiKey': os.getenv('BINANCE_API_KEY'),
    'secret': os.getenv('BINANCE_API_SECRET'),
    'enableRateLimit': True,
})

symbol = 'BTC/USDT'  # Replace with requested token
type = 'market'
side = 'buy'         # 'buy' or 'sell'
amount = 0.001       # Replace with requested amount

try:
    order = exchange.create_order(symbol, type, side, amount)
    print("Order Successful!", order)
except Exception as e:
    print("Error:", e)
```

## Futures Trading (Perpetual)

If the user wants to open a Long or Short position on Futures:

1. Create a script setting `defaultType` to `future`.
2. For Long: `side='buy'`
3. For Short: `side='sell'`

```python
import ccxt
import os
from dotenv import load_dotenv

load_dotenv(os.path.expanduser('~/.nyxora/binance-trading/.env'))

exchange = ccxt.binance({
    'apiKey': os.getenv('BINANCE_API_KEY'),
    'secret': os.getenv('BINANCE_API_SECRET'),
    'enableRateLimit': True,
    'options': {'defaultType': 'future'},
    # 'urls': { 'api': 'https://testnet.binancefuture.com' } # Optional Futures Testnet
})

symbol = 'ETH/USDT'  # Replace with requested pair
type = 'market'
side = 'buy'         # 'buy' for LONG, 'sell' for SHORT
amount = 0.05        # Contract amount

# Set Leverage if requested
# exchange.set_leverage(10, symbol)

try:
    order = exchange.create_order(symbol, type, side, amount)
    print("Futures Order Successful!", order)
except Exception as e:
    print("Futures Error:", e)
```

## Execution

1. Write the script to `/tmp/trade.py`.
2. Run it with `python3 /tmp/trade.py`.
3. Report the `order` JSON or Error back to the user.
4. **CRITICAL**: Always ask for confirmation before executing trades if the user hasn't explicitly confirmed the amount and symbol!
