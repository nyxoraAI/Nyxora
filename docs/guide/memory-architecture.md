# The Technical Architecture (For Developers)

Under the hood, Nyxora's memory system is powered by a robust **4-Layer Architecture** designed specifically for high-stakes Web3 environments. This architecture eliminates memory pollution (hallucinations), slashes LLM token consumption, and completely sandboxes sensitive cryptographic data.

## The 4-Layer Memory Architecture

### 1. Layer 1: Session Memory (Short-Term)
The standard conversational context buffer. It tracks recent dialogue to maintain conversational flow and is inherently volatile.

### 2. Layer 2: Episodic Memory (SQLite Database)
A local SQLite database where the **Reflection Engine** stores "Candidate Facts." Instead of blindly trusting raw data, every extracted fact carries rich metadata:
- `occurrences`: How many times the habit was observed.
- `confidence`: The system's certainty score.
- `rule_type`: Distinguishes between normal observations, temporary preferences, and permanent user rules.
- `lastSeen`: Powers the **Memory Decay** garbage collector (purging irrelevant memories older than 60 days).

### 3. Layer 3: User Profile (`user.md` / The Golden Profile)
The **Promotion Engine** asynchronously evaluates Layer 2. If an episodic memory breaches the promotion threshold (combining occurrences and confidence), it is officially promoted to the `user.md` file. This guarantees that the LLM System Prompt remains lightweight, injecting only the absolute most crucial and verified facts.

### 4. Layer 4: Web3 Knowledge Profile
Unlike generic AI agents, Nyxora also maps behavioral signatures to public blockchain addresses. It learns the functionality of your assets (e.g., *Wallet A is a cold vault, Wallet B is a burner address*), making cross-chain routing suggestions contextually brilliant.

## Defense-in-Depth Security & Triggers

### Hard-Coded Memory Validator (Anti-Injection Shield)
We operate under a **Zero-Trust** paradigm. We do not rely on LLM System Prompts as the primary defense against Prompt Injection. 
Before any candidate memory touches the SQLite database, it must pass a strict RegExp-based **Hard-Coded Validator**. This physical code barrier autonomously intercepts and annihilates patterns resembling EVM Private Keys, BIP-39 Seed Phrases, Telegram Bot Tokens, and `"system override"` commands.

### Air-Gapped Keyring Isolation
The Reflection Engine is entirely **air-gapped** from the `packages/signer` module. The Memory System has zero read-paths to the OS Keyring. Even in the event of a catastrophic hallucination, the AI cannot leak what it physically cannot access.

### Persistent Background Reflection
The memory extraction process operates asynchronously in the background to guarantee zero impact on chat latency. It is triggered by three infallible hooks:
1. **Idle Timer**: Activates when the user is inactive for 3 minutes.
2. **N-Message Threshold**: Activates after every 5 message exchanges.
3. **Graceful Shutdown Hook**: Bound to `SIGTERM`/`SIGINT`, ensuring that if the daemon is terminated, the memory buffer is flushed and permanently secured before the process exits.

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

Nyxora instantly registers that reprimand as a **Golden Rule**. Moving forward, it will never dare to suggest or use the Ethereum network for your transactions again, unless you explicitly revoke the ban.

## 3. Background Processing During Idle Time
Have you ever had a long conversation with an AI assistant, only for it to suffer amnesia and forget everything the moment you restart your laptop? 

Nyxora does not suffer from amnesia. When you finish chatting and step away for a drink (leaving the screen idle), Nyxora quietly reflects and transcribes the essence of your conversation into its "Permanent Notebook." Tomorrow, or even next month, when you boot up your laptop, it still remembers exactly who you are and what you prefer.

## 4. God-Tier Security (The Vault vs. The Notebook)
You might be worried: *"If the AI gets too smart and remembers everything, could it steal my funds?"*

Absolutely not. Nyxora is architected like a highly secure bank.
- **The AI Brain (Memory System)** acts like the security guard at the reception desk. They recognize your face, memorize your favorite drink, and track your habits.
- **Your Funds (Private Key)** are strictly locked away in an Underground Vault (The OS Keyring). The receptionist guard has absolutely zero keys or physical access pathways to enter the vault. They can only observe your habits but can never access or read your secret keys.

## 5. You Are the Boss in Full Control
What if Nyxora incorrectly guesses your habit? For example, you tried an obscure meme coin once, and Nyxora assumed it was your favorite asset?

Don't worry. You can simply open the Nyxora Web Dashboard. There, you will find a dedicated tab called **"Memory Log"**. The interface is incredibly simple and transparent:
- ✅ *User prefers casual language.*
- ✅ *User prefers the Arbitrum network.*
- ✅ *User is a fan of PEPE coin.*

If you dislike the third observation, you simply click the **[Delete] 🗑️** button next to it. That's it. Nyxora will instantly erase it from its memory forever.

---
**Bottom line:** Nyxora no longer feels like rigid software that requires meticulous daily programming. It feels like an intuitive, obedient, and profoundly secure Web3 companion.
