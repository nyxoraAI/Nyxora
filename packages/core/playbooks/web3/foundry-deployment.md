---
name: foundry-deployment
description: "Compile, test, and deploy smart contracts using Foundry (forge)."
---

# Foundry Smart Contract Deployment

When the user asks to "deploy", "compile", or "test" a smart contract using Foundry, follow this playbook.

## Compilation & Testing

1. **Compile**:
   ```bash
   forge build
   ```

2. **Test**:
   ```bash
   forge test -vvv
   ```
   If tests fail, report the failing traces to the user and stop deployment.

## Deployment

1. **Verify Environment Variables**:
   Ensure `RPC_URL` and `PRIVATE_KEY` are available in the `.env` file or exported.
   ```bash
   source .env
   ```

2. **Deploy via Forge Script**:
   Find the script file (usually in `script/`). Run the deployment script.
   ```bash
   forge script script/Deploy.s.sol:DeployScript --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast --verify -vvvv
   ```
   *(Adjust the script path and contract name based on the actual file).*

3. **Post-Deployment & Verification**:
   - **CRITICAL**: Do NOT confuse the "Simulated On-chain Traces" with the actual deployment! A "Success" in the simulation does NOT mean the contract was deployed.
   - You MUST look for the `========================== ONCHAIN EXECUTION ==========================` block in the output.
   - If the output was truncated or you are unsure, read the `broadcast/` folder JSON receipts (e.g. `cat broadcast/Deploy.s.sol/chain_id/run-latest.json`) to confirm the transaction hash and status.
   - Present the deployed contract address and transaction hash to the user ONLY if the ONCHAIN EXECUTION was successful.
