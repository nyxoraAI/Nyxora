# 🏗️ The Technical Architecture (For Developers)

Under the hood, Nyxora's memory system is powered by a robust architecture designed specifically for high-stakes Web3 environments. This architecture eliminates memory pollution (hallucinations), slashes LLM token consumption, and completely sandboxes sensitive cryptographic data.

## 💾 Dialectic User Modeling (The Memory Engine)

With the latest architecture upgrade, Nyxora transitioned from a rigid, file-based memory system to **Dialectic User Modeling**, powered by the asynchronous `nyxDaemon.ts`.

### 1. Layer 1: Session Memory (Short-Term)
The standard conversational context buffer. It tracks recent dialogue to maintain conversational flow and is inherently volatile.

### 2. Layer 2: Episodic Memory & Persona (ChromaDB RAG)
A powerful hybrid storage system where the **Nyx Daemon** stores extracted persona traits and historical episodes. Instead of blindly trusting raw data, the daemon runs continuously in the background to audit your chat history. It extracts:
- Trading style (e.g., Degen, Conservative)
- Risk tolerance
- Network/Chain preferences
- Stylistic/Tone preferences

These traits are stored securely in the `user_personas` table within `episodic.db` (SQLite). For ultra-fast semantic retrieval, this data is continuously synchronized into a local **ChromaDB** vector store powered by the Python ML Engine (`langchain_huggingface` via the `all-MiniLM-L6-v2` model). This guarantees zero-latency RAG (Retrieval-Augmented Generation) without any expensive cloud embedding API costs.

### 2.5 Layer 2b: Transactional Memory (`memory.db`)
Strictly separated from the AI's episodic persona is the **Transactional Memory**. Powered by a dedicated SQLite database (`memory.db`), this layer ensures that all floating Web3 operations—such as pending swaps or Layer 2 bridging withdrawals—are persistently tracked. It replaces outdated RAM-maps and JSON files, granting Nyxora the ability to flawlessly resume interrupted blockchain operations across sudden reboots.

### 3. Layer 3: Dynamic System Injection
There is no manual `user.md` profile to edit anymore. The reasoning engine (`reasoning.ts`) dynamically queries `episodic.db` upon every interaction, pulling the most relevant persona traits and injecting them directly into the System Prompt. This guarantees that the LLM System Prompt remains lightweight and highly personalized.

### 4. Layer 4: Web3 Knowledge Profile
Unlike generic AI agents, Nyxora also maps behavioral signatures to public blockchain addresses. It learns the functionality of your assets (e.g., *Wallet A is a cold vault, Wallet B is a burner address*), making cross-chain routing suggestions contextually brilliant.

## 🛡️ Defense-in-Depth Security & Triggers

### 💾 Hard-Coded Memory Validator (Anti-Injection Shield)
We operate under a **Zero-Trust** paradigm. We do not rely on LLM System Prompts as the primary defense against Prompt Injection. 
Before any candidate memory touches the SQLite database, it must pass a strict RegExp-based **Hard-Coded Validator**. This physical code barrier autonomously intercepts and annihilates patterns resembling EVM Private Keys, Telegram Bot Tokens, and `"system override"` commands.

### 🔹 Air-Gapped Keyring Isolation
The Nyx Daemon is entirely **air-gapped** from the `packages/signer` module. The Memory System has zero read-paths to the OS Keyring. Even in the event of a catastrophic hallucination, the AI cannot leak what it physically cannot access.

### 🔸 Persistent Background Reflection
The persona extraction process operates asynchronously in the background (`nyxDaemon.ts`) to guarantee zero impact on chat latency. 

<br>

# User Experience

Here is how Nyxora Evolution works from the perspective of an everyday user:

## 1. An Intuitive Assistant That Learns Without Prompting
Imagine having a real-life personal butler. On the first day, you might have to say, *"Please make me a coffee, half a spoon of sugar, in the red mug."* But after a month, you simply say, *"One coffee."* The butler automatically brings your half-sugar coffee in the red mug.

Nyxora works exactly like that. You no longer need to type exhaustively long commands. If you frequently send USDC on the Base network, eventually you can just type:
> **You:** "Nyxora, send 50 USDC to Budi."
> 
> **Nyxora:** "Understood. Routing through the Base network as usual. Proceed?"

## 2. Zero Repeated Mistakes
If Nyxora makes a mistake and you correct it:
> **You:** "I already told you, never use Ethereum! The gas fees are too high!"

Nyxora instantly registers that reprimand as a **Persona Trait**. Moving forward, it will never dare to suggest or use the Ethereum network for your transactions again, unless you explicitly revoke the ban.

## 3. Background Processing During Idle Time
Have you ever had a long conversation with an AI assistant, only for it to suffer amnesia and forget everything the moment you restart your laptop? 

Nyxora does not suffer from amnesia. When you finish chatting, the Nyx Daemon quietly reflects and transcribes the essence of your conversation into its SQLite "Permanent Notebook." Tomorrow, or even next month, when you boot up your laptop, it still remembers exactly who you are and what you prefer.

## 4. God-Tier Security (The Vault vs. The Notebook)
You might be worried: *"If the AI gets too smart and remembers everything, could it steal my funds?"*

Absolutely not. Nyxora is architected like a highly secure bank.
- **The AI Brain (Memory System)** acts like the security guard at the reception desk. They recognize your face, memorize your favorite drink, and track your habits.
- **Your Funds (Private Key)** are strictly locked away in an Underground Vault (The OS Keyring). The receptionist guard has absolutely zero keys or physical access pathways to enter the vault. They can only observe your habits but can never access or read your secret keys.

## 5. You Are the Boss in Full Control
What if Nyxora incorrectly guesses your habit? For example, you tried an obscure meme coin once, and Nyxora assumed it was your favorite asset?

Don't worry. You can simply open the Nyxora Web Dashboard. There, you will find a dedicated tab called **"Memory Log"**. The interface is incredibly simple and transparent:
-  *User prefers casual language.*
-  *User prefers the Arbitrum network.*
-  *User is a fan of PEPE coin.*

If you dislike the third observation, you simply click the **[Delete] ** button next to it. That's it. Nyxora will instantly erase it from its memory forever.

---
**Bottom line:** Nyxora no longer feels like rigid software that requires meticulous daily programming. It feels like an intuitive, obedient, and profoundly secure Web3 companion.
