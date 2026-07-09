# 🧠 Python ML Engine

Nyxora tidak hanya mengandalkan model bahasa besar (LLM) untuk mengambil keputusan, melainkan juga memanfaatkan **ML Engine (Cognitive Sidecar)** khusus berbasis Python yang terletak di direktori `packages/ml-engine`. 

Keberadaan *ML Engine* ini menjadikan Nyxora sebagai agen otonom hibrida yang sesungguhnya—menggabungkan kecerdasan linguistik generatif dari LLM dengan analisis data deterministik dan pemodelan prediktif dari *Machine Learning* tradisional.

---

## 🏗️ Arsitektur ML Engine

ML Engine berjalan sebagai layanan *backend* FastAPI lokal di **Port 8000**, sepenuhnya terisolasi dari antrian peristiwa (*event loop*) Node.js utama. Pemisahan ini memastikan bahwa operasi matematika berat (komputasi matriks) tidak akan pernah membuat *chatbot* antarmuka Anda menjadi lambat atau tidak responsif.

Tiga komponen utama dalam ML Engine:

### 1. Model Prediktif (*Predictive Modeling*)
LLM tidak dirancang untuk memprediksi angka yang presisi. Oleh karena itu, Nyxora menggunakan model *Machine Learning* statistik murni untuk melakukan peramalan (*forecasting*).
*   **Time-Series Forecasting**: Menggunakan perpustakaan seperti Pandas TA (`pandas-ta`) dan model deret waktu untuk memprediksi arah pergerakan harga aset jangka pendek berdasarkan data *K-Line* Binance yang ditarik secara *real-time*.
*   **Sentimen Pasar**: Memproses data mentah dari X (Twitter) dan berita Web3 menggunakan model pemrosesan bahasa alami (NLP) yang lebih kecil dan terspesialisasi untuk menghasilkan skor *Bull/Bear* kuantitatif.

### 2. Reinforcement Learning (RL)
Nyxora bukan sekadar bot statis; ia belajar dari pengalamannya.
*   **PPOAgent (Proximal Policy Optimization)**: ML Engine mengimplementasikan algoritma *Reinforcement Learning* canggih. PPOAgent terus-menerus mengevaluasi keberhasilan atau kegagalan strategi *trading* (eksekusi token).
*   **Feedback Loop**: Jika sebuah *swap* sering gagal akibat *slippage* atau mengeksekusi harga yang buruk, agen RL akan memodifikasi parameter eksekusinya, secara otonom mencari rute atau pengaturan *slippage* yang lebih optimal untuk operasi serupa di masa mendatang.

### 3. Deteksi Anomali Kriptografi (*Isolation Forest*)
Keamanan adalah prioritas utama. Sebelum *Policy Engine* menyetujui transaksi, ia dapat meminta opini dari *ML Engine*.
*   **Isolation Forest Algorithm**: Model algoritma ini dilatih menggunakan pola transaksi historis Anda (yang disimpan di dalam basis data memori lokal `memory.db`). 
*   **Behavioral Auditing**: Jika agen secara tiba-tiba mencoba memindahkan dana dalam jumlah besar ke alamat yang tidak dikenal pada jam 3 pagi, *Isolation Forest* akan menandai transaksi ini sebagai anomali (skor deviasi tinggi) dan secara otomatis memblokir transaksi tersebut, menuntut persetujuan interaktif dari Anda.

---

## 🔄 Integrasi dengan Core Runtime

Proses pertukaran data antara *Node.js Core* dan *Python ML Engine* sangat mulus dan efisien:

1. **Permintaan**: Core Node.js mengumpulkan parameter (misal: "Analisis harga ETH saat ini") dan mengirim HTTP POST ke `/api/v1/analyze` di Port 8000.
2. **Komputasi**: FastAPI mendelegasikan tugas ke *worker* model prediktif (atau mengambil data RAG dari *ChromaDB*).
3. **Respon Deterministik**: ML Engine membalas dengan struktur JSON murni yang berisi skor, deviasi standar, dan probabilitas.
4. **Sintesis LLM**: Core Node.js memberikan angka deterministik ini kepada LLM. LLM kemudian menerjemahkan angka-angka "kering" tersebut menjadi kalimat bahasa alami yang mudah Anda pahami di jendela *chat*.

Dengan kombinasi ini, LLM bertindak sebagai "Penerjemah dan Komunikator", sementara *ML Engine* bertindak sebagai "Otak Matematika dan Analitik".
