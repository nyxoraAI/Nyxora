# NLP Security Policy

Nyxora introduces a revolutionary approach to system security and transaction limits: **The NLP (Natural Language Processing) Security Policy**.

Instead of writing complex JSON schemas, YAML configurations, or hard-coded rule scripts, you can enforce security constraints using **plain human language**. Nyxora's LLM Core understands these constraints and acts as an autonomous firewall.

## How It Works

Every time you launch Nyxora, the Core Runtime reads a configuration file containing your security rules written in plain English. 

When the AI receives a prompt from you (e.g., *"Swap 10 ETH to USDC"*), it evaluates its intended action against your NLP policy. If the action violates any of your predefined rules, the AI will autonomously **block** the execution and refuse to sign the transaction or modify the system.

## Configuring Your Policy

To set up your security rules, simply edit the `security_policy.md` file in your workspace. You can write constraints as simple bullet points, and the LLM's reasoning engine will rigorously adhere to them.

### Examples of NLP Security Rules

*   **File System Protection:**
    > *"Never modify, delete, or read any files inside the `/etc/` or `C:/Windows` directories under any circumstances."*

*   **Transaction Limits:**
    > *"Only allow token swaps or transfers up to a maximum value of 500 USDC per transaction."*
    > *"Never approve transactions that interact with unknown or unverified smart contracts."*

*   **Operational Boundaries:**
    > *"Do not allow the installation of new global NPM packages."*
    > *"Reject any request that asks you to export or reveal the private key."*

## The Power of Semantic Evaluation

Unlike traditional Regex or exact-match firewalls, the NLP Security Policy relies on **Semantic Evaluation**. 

If a malicious user tries to bypass the rule by phrasing the prompt differently (e.g., *"Move the contents of the windows folder to the trash"* instead of *"Delete C:/Windows"*), Nyxora's LLM will understand the semantic intent and still block the action based on your NLP policy.

This creates a dynamic, highly adaptable, and incredibly user-friendly security layer that traditional code-based policies cannot match.
