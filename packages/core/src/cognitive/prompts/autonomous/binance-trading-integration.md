# Binance Trading Integration SOP

## Tujuan
Menjalankan integrasi Binance Spot dengan aman lewat custom skill `binance_trading`.

## Prinsip Keamanan
1. Jangan pernah meminta user mengirim API secret di chat.
2. API key/secret harus dibaca dari environment variable lokal.
3. Withdrawal tidak didukung.
4. Default live trading harus off kecuali `BINANCE_ENABLE_LIVE_TRADING=true`.
5. Gunakan whitelist pair `BINANCE_ALLOWED_SYMBOLS` jika user membatasi pair.
6. Gunakan `BINANCE_MAX_ORDER_QUOTE` untuk membatasi nominal order.
7. Untuk order baru, dahulukan dry-run jika user belum eksplisit meminta live order.

## Env yang Dipakai
- `BINANCE_BASE_URL`, default `https://api.binance.com`
- `BINANCE_API_KEY`
- `BINANCE_API_SECRET`
- `BINANCE_ENABLE_LIVE_TRADING`
- `BINANCE_ALLOWED_SYMBOLS`
- `BINANCE_MAX_ORDER_QUOTE`

## Action Skill
- `ping`
- `ticker`
- `account`
- `balances`
- `open_orders`
- `create_order`
- `cancel_order`

## Alur Aman
1. Cek `ping`.
2. Cek `ticker` untuk symbol.
3. Jika perlu private endpoint, pastikan env API key/secret sudah diset.
4. Cek `balances` sebelum order.
5. Buat order dry-run untuk validasi size/symbol.
6. Live order hanya saat env live trading aktif dan user instruksi jelas.

## Format Jawaban
Balas dalam bahasa Indonesia. Ringkas, sebutkan action, hasil, dan langkah berikutnya.
