# 🧠 Python ML Engine

Nyxora does not rely solely on Large Language Models (LLMs) for decision-making; it also leverages a specialized, Python-based **ML Engine (Cognitive Sidecar)** located in the `packages/ml-engine` directory.

The presence of this ML Engine makes Nyxora a true hybrid autonomous agent—combining generative linguistic reasoning from LLMs with deterministic data analysis and predictive modeling from traditional machine learning.

---

## 🏗️ ML Engine Architecture

The ML Engine runs as a local FastAPI backend service on **Port 50000**, fully isolated from the main Node.js event loop. This separation ensures that heavy mathematical operations and matrix computations will never cause your UI chatbot to become sluggish or unresponsive.

The ML Engine comprises three primary components:

### 1. Predictive Modeling
LLMs are not designed for precise numerical forecasting. Therefore, Nyxora uses pure statistical machine learning models to perform quantitative forecasting:
*   **Time-Series Forecasting**: Uses libraries like Pandas TA (`pandas-ta`) and time-series models to predict short-term price direction based on real-time Binance K-Line data.
*   **Market Sentiment**: Processes raw text from X (Twitter) and Web3 news streams using specialized, compact NLP models to generate quantitative Bull/Bear sentiment scores.

### 2. Reinforcement Learning (RL)
Nyxora is not a static bot; it learns from its execution experience:
*   **PPOAgent (Proximal Policy Optimization)**: The ML Engine implements advanced Reinforcement Learning algorithms. The PPOAgent continuously evaluates the success or failure of token trading and execution strategies.
*   **Feedback Loop**: If a swap frequently fails due to slippage or executes at an unfavorable price, the RL agent dynamically modifies its execution parameters, autonomously discovering more optimal routing and slippage settings for future operations.

### 3. Cryptographic Anomaly Detection (Isolation Forest)
Security is paramount. Before the Policy Engine approves a transaction, it can request an analytical evaluation from the ML Engine:
*   **Isolation Forest Algorithm**: This unsupervised learning model is trained on your historical transaction patterns (stored in the local `memory.db` database).
*   **Behavioral Auditing**: If the agent suddenly attempts to transfer a large volume of funds to an unknown address at 3:00 AM, the Isolation Forest flags the transaction as an anomaly (high deviation score) and automatically halts execution, requiring explicit interactive confirmation from you.

---

## 🔄 Core Runtime Integration

The data exchange between the **Node.js Core** and the **Python ML Engine** is seamless and highly optimized:

1.  **Request**: The Node.js Core bundles parameters (e.g., "Analyze current ETH price trend") and sends an HTTP POST request to `/api/v1/analyze` on Port 50000.
2.  **Computation**: FastAPI delegates the task to the predictive modeling workers (or retrieves RAG embeddings from ChromaDB).
3.  **Deterministic Response**: The ML Engine responds with a clean JSON payload containing scores, standard deviations, and probability metrics.
4.  **LLM Synthesis**: The Node.js Core feeds these deterministic metrics into the LLM context. The LLM then translates the raw numbers into natural, understandable language in your chat window.

With this architecture, the LLM acts as the **"Translator and Communicator"**, while the ML Engine serves as the **"Analytical and Mathematical Brain"**.
