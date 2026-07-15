import asyncio
import httpx

async def test():
    async with httpx.AsyncClient(verify=False) as client:
        r = await client.get("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=100")
        print("Status:", r.status_code)
        print("Content:", r.text[:200])

asyncio.run(test())
