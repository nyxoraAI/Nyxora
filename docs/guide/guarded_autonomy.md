# Guarded Autonomy Architecture

This document outlines the conceptual blueprint for shifting Nyxora's paradigm from a "free-thinking AI" to a **"Policy-Driven Quantitative Algo-Trading Engine with an AI Interface."**

---

## 1. Policy Engine Expansion (Risk Management)

The policy configuration acts as the ultimate risk control center for the system. Instead of simple on/off switches, it defines:
- **User Risk Profiles:** Tolerances for exposure, maximum position sizes, and maximum daily losses.
- **Strict Trading Criteria:** Hard-coded thresholds such as minimum security scores, minimum DEX liquidity, and momentum indicators.
- **Guarded Autonomy:** A mechanism that allows the agent to auto-execute small micro-trades (e.g., under $50) instantly, while larger transactions are automatically held back for explicit human approval.

---

## 2. Deterministic Decision Pipeline

Decision-making no longer relies on the unpredictable nature of LLM prompts. The workflow is restructured into a strict, deterministic pipeline:

- **Eyes (Data Sources):** The system fetches raw on-chain data, contract security audits, and market metrics.
- **Analytical Brain (Scoring Engine):** The engine mathematically calculates a quantitative score based on the raw data.
- **Judge (Policy Gatekeeper):** The gatekeeper evaluates the quantitative score against the user's defined risk limits.
- **Translator (LLM):** The AI simply narrates the final outcome to the user.

---

## 3. The Role of the Scoring Engine

Instead of asking an LLM to read a chart and guess if a token is "good," a dedicated scoring engine handles the heavy lifting. It converts complex market variables into a straightforward numerical score (e.g., 85/100). This ensures that decisions are deeply rooted in mathematics, completely eliminating the risk of AI hallucination.

---

## 4. The Policy Gatekeeper

Before any transaction reaches the secure signing vault, it must pass through the Policy Gatekeeper. 
If a token is flagged as a honeypot or falls below the user's minimum security score, the Gatekeeper rejects the transaction outright. If the token passes the criteria, the Gatekeeper checks the trade amount against the "Guarded Autonomy" threshold to determine if it should execute silently or prompt the user for a final [Y/N] confirmation.

---

## 5. The LLM as a Translator

In this architecture, the LLM is stripped of its financial decision-making power. It strictly serves as the User Interface. Its only job is to translate the hard-coded verdicts produced by the Policy Gatekeeper into elegant, human-readable narratives. 

By separating the mathematical execution from the language generation, Nyxora achieves institutional-grade reliability, allowing users to trust the agent with autonomous operations within predefined boundaries.

<br>

> ⚠️ *Disclaimer: The concepts and architectures outlined in this Guarded Autonomy blueprint are currently in the active research, development, and testing phase. Features described herein are experimental and not yet fully integrated into the production release.*
