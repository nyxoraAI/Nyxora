# Available Capabilities

Once connected, your AI client will have access to:
- **`get_wallet_address`**: Securely retrieves the EVM wallet address managed by the Signer Vault.
- **`request_transaction`**: Requests EVM operations (like `swap` or `transfer`). The Policy Engine evaluates the request and if approved, signs and broadcasts it.

> **Security Note**: External AI clients never touch your private keys. They only interface with the standard MCP API, which is strictly governed by your Nyxora `policy.yaml` rules.
