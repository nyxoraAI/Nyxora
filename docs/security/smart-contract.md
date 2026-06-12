# Arbitrum Smart Contract Architecture

Nyxora transcends traditional Web2 wrappers by embedding its core security model entirely on-chain. To provide users with absolute, trustless control over their AI agents, Nyxora utilizes the **Arbitrum Network** as its Global Command Center.

## The AI Safety Dilemma
Autonomous Web3 AI agents possess the power to sign transactions and move funds. However, this introduces a critical security risk:
- **What if the AI hallucinates?**
- **What if the local Node.js environment is compromised by malware?**
- **What if a malicious actor gains access to the UI?**

Traditional centralized kill-switches (e.g., a boolean flag in a Web2 database) are highly vulnerable to tampering. If an attacker compromises the application server, they can effortlessly disable the shutdown mechanism.

## The Solution: On-Chain Kill-Switch (The Missing Link)

We built the **`NyxoraAgentRegistry`** Smart Contract natively on the Arbitrum network to solve this dilemma. It acts as an immutable, decentralized registry for all Nyxora agents.

Before Nyxora executes *any* transaction (whether it's on Ethereum Mainnet, Base, Optimism, or Binance Smart Chain), the system's Gateway **must first read the Arbitrum Smart Contract**. 

![Nyxora Registry Security Flow](/registry-flow.svg)

### How It Works

1. **Agent Registration:** Users register their wallet address as an AI Agent Controller on the Arbitrum Smart Contract, establishing an immutable on-chain identity.
2. **Global Execution Halting (Kill-Switch):** If a user suspects their local machine or server is compromised, they can interact directly with the contract via Arbiscan from a secure device (such as a mobile phone) and invoke the `toggleAgentStatus(false)` function.
3. **Execution Intercepted:** The very next time the compromised Nyxora AI attempts to sign a transaction, the Gateway will query the Arbitrum RPC. Upon detecting the `false` status, the transaction will be permanently rejected with a `403 Security Blocked` error, strictly safeguarding the user's funds.

### Multi-Tenant Architecture (Global Registry)

Can other users utilize the same Smart Contract? **Absolutely.** 

The `NyxoraAgentRegistry` is built as a decentralized public registry utilizing isolated data mappings (`mapping(address => AgentData)`). 
- Every user globally interacts with the exact same Smart Contract address.
- Because the registry separates data by the user's wallet address (`msg.sender`), each user's AI Agent status is completely siloed.
- If **User A** activates their Kill-Switch, it exclusively suspends User A's agent. **User B's** agent remains fully operational and unaffected.

### System-Level Integration (The Interceptor Pattern)

How does Nyxora actually embed this decentralized contract into its local operations? 

Nyxora implements a strict **Interceptor Pattern** at the core of its Gateway node. 
Before any AI-generated transaction (e.g., a token swap or bridge) is forwarded to the user's OS-Native Keyring for signing, the transaction manager forcibly invokes the `checkRegistryStatus` function. This function performs an asynchronous RPC call to the Arbitrum network to verify the user's current status. If the Smart Contract returns `isActive == false`, the local Gateway process immediately terminates the execution thread, making it physically impossible for the AI to transmit the payload.

## Smart Contract Details

- **Network:** Arbitrum Sepolia (Testnet deployment for the testing phase)
- **Contract Address:** [`0x6C811587ce9A50f1CF1fE5a42bF2b18a9787318F`](https://sepolia.arbiscan.io/address/0x6c811587ce9a50f1cf1fe5a42bf2b18a9787318f)
- **Core Functions:**
  - `registerAgent(string _agentName)`: Initializes your on-chain agent identity and registers it within the global directory.
  - `toggleAgentStatus(bool _status)`: The ultimate decentralized fail-safe. Set to `false` to immediately suspend all autonomous agent operations globally.

### How to Activate the On-Chain Registry (Step-by-Step)

Activating your on-chain security requires registering your wallet address directly into the Arbitrum Smart Contract. Follow these steps:

1. **Acquire Testnet ETH:** Ensure you have some Arbitrum Sepolia ETH for gas fees (you can use any public faucet).
2. **Visit Arbiscan:** Go to the official [Arbiscan Sepolia Contract Page](https://sepolia.arbiscan.io/address/0x6c811587ce9a50f1cf1fe5a42bf2b18a9787318f#writeContract).
3. **Connect Web3 Wallet:** Click the **"Connect to Web3"** button (with a red/green indicator) and connect your MetaMask or Rabby Wallet. Ensure you are using the *exact same wallet address* that you imported into Nyxora.
4. **Call `registerAgent`:** Scroll down to the `registerAgent` function. Type a name for your local AI (e.g., `"Nyxora Local Node"`) and click **Write**.
5. **Confirm Transaction:** Approve the transaction in your wallet. Wait a few seconds for the blockchain to confirm it.
6. **You're Protected!** Your wallet is now permanently mapped into the Nyxora ecosystem. If you ever need to trigger an emergency shutdown, return to the same page and call `toggleAgentStatus(false)`.

### Why Arbitrum?
We chose Arbitrum as the security backbone because of its **lightning-fast block times** and **sub-cent transaction fees**. Users can flip the Kill-Switch in seconds without worrying about exorbitant gas costs, ensuring the fail-safe is both rapid and economically viable during emergencies.

> [!NOTE]
> *Saat ini (masa pengujian), Smart Contract dideploy di jaringan Arbitrum Sepolia (Testnet). Pada pembaruan berikutnya, sistem ini akan dimigrasikan secara penuh ke Arbitrum Mainnet.*
