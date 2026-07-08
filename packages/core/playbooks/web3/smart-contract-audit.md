---
name: smart-contract-audit
description: "Run standard LOCAL security analysis on Foundry/Hardhat projects using Slither and Aderyn (DO NOT use for responsible disclosure)."
---

# Smart Contract Security Audit

When the user asks to "audit", "check security", or "scan" a local smart contract repository, use this playbook. 

> **Note**: If the user specifically asks for a "responsible disclosure scan", "private vulnerability reporting", or to scan external trending repos for CVEs, **DO NOT** use this playbook. Use `aeon-vuln-scanner` instead.

## Prerequisites
- The project must be a Foundry or Hardhat project.
- Python 3 must be installed (for Slither).
- Rust/Cargo must be installed (for Aderyn).

## Steps

1. **Check Dependencies**:
   Verify if Slither and Aderyn are installed.
   ```bash
   which slither || pip3 install slither-analyzer
   which aderyn || cargo install aderyn
   ```

2. **Run Slither**:
   Run Slither in the root of the project to check for vulnerabilities.
   ```bash
   slither . --print human-summary
   slither . --json slither-results.json
   ```

3. **Run Aderyn**:
   Run Aderyn (a modern Rust-based static analyzer for Solidity).
   ```bash
   aderyn .
   ```

4. **Analyze Results**:
   Read `slither-results.json` and `report.md` (Aderyn's output).
   Use `cat` or `read_file` to fetch the reports.

5. **Report to User**:
   Provide a combined summary of the findings. Group them by Severity (High, Medium, Low) and provide actionable fixes for the vulnerabilities found.
