# Wallet Import Guide

If you chose **"Manual Input"** during the Nyxora Setup Wizard, you will need to provide a raw Private Key (a 64-character hex string starting with `0x`).

## How to Export your Private Key from MetaMask

::: warning EXTREME CAUTION
Never share your Private Key with anyone. Anyone with your Private Key has full control over all funds in your wallet. Nyxora encrypts this key locally and never sends it to the internet.
:::

1. Open the **MetaMask** extension in your browser.
2. Click the **Three Dots (⋮)** menu in the top right corner.
3. Select **Account Details**.
4. Click the **Show Private Key** button.
5. Enter your MetaMask password to confirm.
6. Copy the string of characters displayed.
7. Prefix it with `0x` if it doesn't already have one (e.g., `0xabc123...`).
8. Paste it into the Nyxora CLI when prompted!

Nyxora will immediately encrypt it using AES-256-GCM and lock it behind your Master Password.
