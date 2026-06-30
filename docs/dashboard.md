# Dashboard Security & UX

The Nyxora Dashboard is designed to be a resilient, professional Web3 execution environment. Because the dashboard connects directly to your local Agent and Signer Vault, we have implemented rigorous physical and network-level protections.

## Zero-Trust Auto-Lock (Physical Protection)

For users running Nyxora locally (non-VPS), the greatest threat vector is physical access—such as leaving a laptop unattended in a public space. 

To mitigate this, Nyxora features a **Zero-Trust Auto-Lock**. After a period of inactivity, the dashboard automatically deploys a glassmorphism blur overlay, instantly hiding all portfolio data, active chats, and transaction states.

### Unlocking the Dashboard
To unlock the dashboard, you cannot simply type a password into the browser (as this would be vulnerable to keyloggers or browser extensions). Instead, you must authorize the unlock locally from your operating system's terminal:

```bash
nyxora unlock
```

This guarantees that anyone attempting to interact with your dashboard must possess physical terminal access to the host machine. (Note: VPS users can disable this timeout in their Dashboard Settings for a permanent workflow).

## Resilient UI (Offline Reconnect Overlay)

Nyxora's Dashboard uses a global network interceptor to monitor the health of the background daemon. 

If you restart the daemon (`nyxora restart`) or if the connection is unexpectedly lost, the UI will immediately pause and display a pulsing **"Nyxora Daemon Offline"** overlay. This prevents you from executing "ghost" transactions or losing state.

Once the daemon revives, the overlay automatically lifts, seamlessly resuming your workflow exactly where you left off.

## Bring Your Own Keys (BYOK) & UI Masking

Nyxora supports overriding public endpoints with your own private API keys (e.g., Alchemy, 1inch, KyberSwap, Etherscan). To protect these secrets from malicious browser extensions or accidental screen-sharing leaks, the Dashboard employs **UI Masking**:

1. **Defi Config Isolation:** Keys entered in the DeFi Configuration tab are saved to a separate, isolated YAML file (`defi_keys.yaml`). When the Dashboard requests this configuration, the backend actively censors the actual keys, transmitting only the string `"IS_SET"` to the frontend browser.
3. **Settings Masking:** Keys within the general Web3 settings (like Etherscan and RPC URLs) are rendered using native password masking (`••••••••`). 

This architecture guarantees that once a secret is injected into the backend, it never travels back to the frontend in plain text.

## Dynamic Status Metrics (Real-Time Sync)

The Dashboard is designed to be a transparent window into the background daemon's current state. Hardcoded placeholders have been completely eliminated:
*   **Active CRON Jobs:** The Overview page actively polls the `/api/cron` endpoint to display the exact number of recurring background tasks currently registered by the AI Scheduler.
*   **Agent Identity Sync:** If you instruct the AI to change its name via a chat command (e.g., "Change your name to Jarvis"), the backend instantly updates the global `nyxora.config.json` file. This guarantees that your Dashboard UI and Telegram Bot always reflect the AI's latest personality and naming configurations.

## Policy Engine Dashboard (Hard-coded Firewall)

Nyxora kini memiliki modul **Policy Engine Dashboard** mandiri di dalam antarmuka Settings. Ini merupakan mekanisme keamanan ketat yang bertindak sebagai perisai tak tertembus, yang sama sekali tidak dapat di-bypass oleh agen LLM dalam kondisi apapun. Melalui dashboard ini, Anda dapat langsung mengatur aturan keselamatan berbasis NLP dan batas pengeluaran transaksi tanpa harus mengedit file `policy.yaml` secara manual.

Dua perlindungan utamanya adalah:
1. **Max USD per Transaction:** Batas keras (hard limit) pada nilai fiat maksimum yang diizinkan per transaksi.
2. **Strict Whitelist Only:** Secara instan memblokir transfer atau interaksi *smart contract* apa pun yang diarahkan ke alamat yang tidak terdaftar.

### Manual Whitelist Configuration
Meskipun batas pengeluaran dan aturan NLP dapat diatur melalui GUI Dasbor, untuk mengeliminasi risiko serangan injeksi UI atau kesalahan ketik fatal, antarmuka Dasbor **sengaja tidak menyediakan** kolom input teks untuk mendaftarkan alamat dompet (*whitelist*).

Pengguna tingkat lanjut yang ingin menggunakan fitur ini harus menyuntikkan alamat yang disetujui secara manual ke dalam file `~/.nyxora/policy.yaml` (atau `policy.yaml` di root) di bawah array `whitelist:`.

**Example `policy.yaml` Format:**
```yaml
max_usd_per_tx: 999999999
whitelist_only: true
require_approval: true
custom_llm_rules: []
whitelist: 
  - "0x1234567890abcdef1234567890abcdef12345678"
  - "0xabcdef1234567890abcdef1234567890abcdef12"
```

> [!NOTE]
> Make sure to halt the daemon (`Ctrl+C` or `nyxora stop`) before modifying this YAML file, then restart it to ensure the system ingests the latest configuration securely.

## RPC Dashboard

Nyxora menyediakan tab **RPC Configuration** yang sepenuhnya baru. Melalui antarmuka ini, pengguna dapat dengan mudah mengganti *endpoint* untuk lingkungan Mainnet dan Testnet secara transparan. Sistem ini juga dibangun dengan mekanisme *fallback* yang kokoh; jika node RPC utama gagal, sistem akan otomatis beralih ke jalur cadangan untuk memastikan agen tetap terhubung ke blockchain tanpa hambatan.

## Global Fiat Currency Converter

Untuk memudahkan pelacakan portofolio pengguna dari berbagai negara, Dasbor Portfolio kini terintegrasi dengan **Global Fiat Currency Converter**. Fitur ini mengambil data kurs secara live dari CoinGecko, memungkinkan Anda untuk secara instan mengonversi dan menampilkan total kekayaan kripto lintas rantai Anda ke dalam mata uang fiat lokal (seperti IDR, EUR, GBP, JPY, dll) hanya dengan memilih opsi dari halaman Pengaturan (*Settings*).
