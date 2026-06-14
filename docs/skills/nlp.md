# NLP Security Policy

Nyxora introduces a revolutionary approach to system security and transaction limits: **The NLP (Natural Language Processing) Security Policy**.

Instead of writing complex JSON schemas, YAML configurations, or hard-coded rule scripts, you can enforce security constraints using **plain human language**. Nyxora's LLM Core understands these constraints and acts as an autonomous firewall.

## How It Works

Every time you launch Nyxora, the Core Runtime reads a configuration file containing your security rules written in plain English. 

When the AI receives a prompt from you (e.g., *"Swap 10 ETH to USDC"*), it evaluates its intended action against your NLP policy. If the action violates any of your predefined rules, the AI will autonomously **block** the execution and refuse to sign the transaction or modify the system.

## Configuring Your Policy

To set up your security rules, simply configure them directly from your Nyxora Dashboard under the **Settings -> Policy Engine (Hard-coded Firewall)** section, or manually edit the `policy.yaml` file in your `~/.nyxora/config/` directory by modifying the `custom_llm_rules` array. You can write constraints as simple human language sentences, and the LLM's reasoning engine will rigorously adhere to them.
### Examples of NLP Security Rules

*   **File System Protection:**
    > *"Never modify, delete, or read any files inside the `/etc/` or `C:/Windows` directories under any circumstances."*

*   **Transaction Limits:**
    > *"Only allow token swaps or transfers up to a maximum value of 500 USDC per transaction."*
    > *"Never approve transactions that interact with unknown or unverified smart contracts."*

*   **Operational Boundaries:**
    > *"Do not allow the installation of new global NPM packages."*
    > *"Reject any request that asks you to export or reveal the private key."*

*   **Tool Prioritization (Rule 7):**
    > *"When the user asks about crypto prices, market analysis, token security, or blockchain data, YOU MUST prioritize using the dedicated Web3 skills (e.g., get_price, analyze_market) FIRST before falling back to generic web search."*

*   **Strict Exactness (Rule 8):**
    > *"NEVER hallucinate or guess missing transaction parameters (like destination chains, tokens, or amounts). If ambiguous, HALT and explicitly ask the user for clarification."*

## The Power of Semantic Evaluation

Unlike traditional Regex or exact-match firewalls, the NLP Security Policy relies on **Semantic Evaluation**. 

If a malicious user tries to bypass the rule by phrasing the prompt differently (e.g., *"Move the contents of the windows folder to the trash"* instead of *"Delete C:/Windows"*), Nyxora's LLM will understand the semantic intent and still block the action based on your NLP policy.

This creates a dynamic, highly adaptable, and incredibly user-friendly security layer that traditional code-based policies cannot match.
