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

3. **Post-Deployment**:
   Extract the deployed contract address from the deployment logs. Present the address and the transaction hash to the user.
