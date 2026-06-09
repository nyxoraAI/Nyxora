# Arbitrum Smart Contract Architecture

Nyxora transcends traditional Web2 wrappers by embedding its core security model entirely on-chain. To provide users with absolute, trustless control over their AI agents, Nyxora utilizes the **Arbitrum Network** as its Global Command Center.

## The AI Safety Dilemma
Autonomous Web3 AI agents possess the power to sign transactions and move funds. However, this introduces a critical security risk:
- **What if the AI hallucinates?**
- **What if the local Node.js environment is compromised by malware?**
- **What if a malicious actor gains access to the UI?**

If the emergency shutdown switch is merely a button in a Web2 database, a hacker can easily disable the shutdown switch.

## The Solution: On-Chain Kill-Switch (The Missing Link)

We built the **`NyxoraAgentRegistry`** Smart Contract natively on the Arbitrum network to solve this dilemma. It acts as an immutable, decentralized registry for all Nyxora agents.

Before Nyxora executes *any* transaction (whether it's on Ethereum Mainnet, Base, Optimism, or Binance Smart Chain), the system's Gateway **must first read the Arbitrum Smart Contract**. 

![Nyxora Registry Security Flow](../../assets/architecture.svg)

### How It Works

1. **Agent Registration:** Users register their wallet address as an AI Agent Controller on the Arbitrum Smart Contract.
2. **Global Paralyzation (Kill-Switch):** If the user suspects their local machine is compromised, they can visit Arbiscan from a safe device (like their mobile phone) and call the `toggleAgentStatus(false)` function.
3. **Execution Intercepted:** The very next time the compromised Nyxora AI attempts to sign a transaction, the Gateway will query the Arbitrum RPC. Seeing the `false` status, the transaction will be permanently blocked with a `403 Security Blocked` error, saving the user's funds.

## Smart Contract Details

- **Network:** Arbitrum Sepolia (Testnet deployment for the hackathon)
- **Contract Address:** [`0x5031A58CD3D19dfBCCDD1DDea83613542Cf87a9F`](https://sepolia.arbiscan.io/address/0x5031a58cd3d19dfbccdd1ddea83613542cf87a9f)
- **Core Functions:**
  - `registerAgent(string _agentName)`: Initializes your on-chain agent identity.
  - `toggleAgentStatus(bool _status)`: The ultimate fail-safe. Set to `false` to paralyze the AI globally.

### Why Arbitrum?
We chose Arbitrum as the security backbone because of its **lightning-fast block times** and **sub-cent transaction fees**. Users can flip the Kill-Switch in seconds without worrying about exorbitant gas costs, ensuring the fail-safe is both rapid and economically viable during emergencies.
