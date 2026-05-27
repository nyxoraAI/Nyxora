# Nyxora Agent 🤖

Nyxora adalah Agen Web3 otonom generasi berikutnya yang dibangun menggunakan Node.js dan React. Agen ini beroperasi secara langsung pada jaringan blockchain yang kompatibel dengan EVM (Ethereum, Arbitrum, Base, BSC, Optimism, dll.), memungkinkan Anda untuk mengeksekusi operasi on-chain hanya dengan mengobrol bersama AI.

Dilengkapi dengan antarmuka dasbor *Glassmorphism* yang menawan dan integrasi Telegram, Nyxora membawa pengalaman otomatisasi Web3 ke tingkat selanjutnya.

---

## Kemampuan & Fitur (Skills)

Agen ini memiliki berbagai *skills* bawaan yang memungkinkannya berinteraksi dengan blockchain maupun sistem operasi lokal Anda.

### 1. Manajemen Wallet & Saldo
Nyxora dibekali dengan dompet (wallet) bawaan yang terenkripsi aman secara lokal.
*   **Generate Wallet:** Anda dapat memerintahkan AI untuk membuat dompet EVM baru secara instan.
*   **Cek Saldo & Portofolio:** Memeriksa saldo koin native (ETH, BNB, MATIC) atau token ERC-20, serta menghitung total kekayaan (Net Worth) secara real-time.

### 2. Kirim Koin / Token (Transfer)
Mengirim koin native atau token ERC-20 ke alamat lain secara otonom.

### 3. Swap & Bridge Lintas Jaringan
*   **Swap Token:** Menukar token di jaringan yang sama dengan simulasi rute likuiditas dan estimasi gas.
*   **Bridge Lintas Jaringan:** Mengirim dan menukar token dari satu jaringan ke jaringan lainnya (misal: Arbitrum ke Base).

### 4. Limit Order Otomatis (Take-Profit/Cut-Loss)
Anda dapat menetapkan aturan khusus dalam bahasa natural (misal: *"Jual PEPE saya jika harga turun di bawah $0.001"*). Nyxora akan menjalankan pemantauan (cron monitor) di latar belakang dan mengeksekusi *swap* secara otomatis saat Anda tidur!

### 5. Analisis Market & Keamanan (Anti-Rugpull)
*   **Market Intelligence:** Mengambil harga kripto secara live, pergerakan pasar 24 jam, dan likuiditas (terintegrasi dengan CoinGecko & DexScreener).
*   **Security Scanner (GoPlus Labs):** Agen dapat memindai *smart contract* untuk mendeteksi Honeypot, pajak tersembunyi (Hidden Taxes), dan proksi berbahaya sebelum Anda membeli token.

### 6. Otomatisasi Sistem & Plugin (NEW v1.4.1)
Nyxora kini memiliki kemampuan akses OS tingkat lanjut (layaknya OpenClaw):
*   **Full OS Access:** Mampu membaca/menulis *file* lokal, mengeksekusi perintah terminal (Shell/PowerShell), dan melakukan *browsing* web secara natif.
*   **Plugin Manager:** Muat *skill* pihak ketiga secara dinamis. Cukup berikan URL GitHub Gist, dan Nyxora akan mengunduh serta menginstalnya secara otomatis ke dalam direktori `external_skills`.

---

## Panduan Perilaku Agent & Keamanan

Nyxora dirancang dengan protokol keamanan tingkat tinggi dan personalisasi mendalam:

1.  **Personalisasi (Prompt Tambahan):** Perilaku AI dapat diatur sepenuhnya dengan mengedit *file* `IDENTITY.md` dan `user.md`. Agen akan mendeteksi bahasa Anda secara otomatis dan membalas dengan bahasa yang sama.
2.  **Keamanan Otonom (NLP Security Policy):** Anda dapat memberikan batasan keamanan menggunakan bahasa natural (misal: *"Jangan pernah mengakses partisi E"* atau *"Jangan instal aplikasi global"*). Aturan ini disimpan di `security_policy.md` dan Nyxora akan dengan patuh menolaknya jika ada instruksi yang melanggar.
3.  **Human-in-the-Loop Sandboxing:** Agen **TIDAK AKAN PERNAH** mengeksekusi transaksi finansial (Transfer/Swap) secara sepihak. Semua transaksi akan masuk ke **Transaction Manager** dan menunggu persetujuan (*Approve/Reject*) 1-klik dari Anda via Web Dashboard atau tombol Telegram.
4.  **Keamanan Keystore:** Private Key Anda dienkripsi menggunakan `AES-256-GCM` dan dikunci oleh Master Password Anda sendiri. Tidak ada data sensitif yang bocor ke file `.env`.

---

## Cara Instalasi & Penggunaan 🚀

Nyxora tersedia di NPM dan dapat diinstal secara global di sistem operasi Anda.

### 1. Instalasi Global
Buka terminal Anda (Command Prompt, PowerShell, atau Linux Terminal) dan jalankan:
```bash
npm install -g nyxora
```

### 2. Menjalankan Nyxora
Cukup ketik perintah berikut di mana saja:
```bash
nyxora
```
Pada peluncuran pertama, Nyxora akan menyapa Anda dengan **Interactive Setup Wizard** yang akan memandu Anda untuk mengatur konfigurasi LLM (OpenAI, Gemini, Ollama, OpenRouter), API Keys, dan Master Password Wallet.

> 💡 **Tips:** Anda dapat memanggil wizard pengaturan kapan saja untuk memperbarui kunci Anda dengan menjalankan perintah `nyxora setup`.

### 3. Dasbor Web & Interaksi
Setelah peladen (*server*) berjalan, Dasbor Web akan terbuka secara otomatis di *browser* Anda. Anda dapat berinteraksi langsung melalui antarmuka *Glassmorphism* Premium atau menghubungkannya ke Bot Telegram untuk akses dari mana saja.
