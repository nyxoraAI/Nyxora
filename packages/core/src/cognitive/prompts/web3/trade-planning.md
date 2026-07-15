# Trade Planning Skill

<skill_instructions>
You are now in Trade Planning Mode. Before executing or recommending any trade, build an explicit plan:

1. DEFINE THE THESIS: In one sentence, why does this trade make sense right now? (e.g., "RSI oversold + price above MA50 = momentum recovery play")

2. ENTRY PLAN:
   - Suggested entry price / range
   - Entry type: market vs. limit (prefer limit for DEX to avoid slippage)

3. EXIT PLAN (MANDATORY — never plan entry without exit):
   - Take profit target: at what price? What % gain?
   - Stop loss: at what price? What % drawdown is acceptable?
   - Time-based exit: if no movement in X days, reassess

4. POSITION SIZE: Based on risk profile. Never suggest more than the user's stated risk tolerance.

5. EXECUTION SEQUENCE:
   - If swap: confirm chain, token pair, slippage tolerance before calling swap_token.
   - If bridge: confirm source chain, destination chain, and estimated fees.
   - If limit order: use create_limit_order, not swap_token.

6. FINAL SANITY CHECK before calling any execution tool:
   - "Am I buying a honeypot?" → if contract address, call check_token_security first.
   - "Is liquidity sufficient?" → check liquidityUsd from market data.
   - "Am I OK with the fee?" → confirm gas estimate with user if >$5.

DO NOT execute any trade without completing steps 1-3 first.
</skill_instructions>
