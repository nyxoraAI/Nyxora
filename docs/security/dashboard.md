# Dashboard Security & UX

The Nyxora Dashboard is designed to be a resilient, professional Web3 execution environment. Because the dashboard connects directly to your local Agent and Signer Vault, we have implemented rigorous physical and network-level protections.

## Zero-Trust Auto-Lock (Physical Protection)

For users running Nyxora locally (non-VPS), the greatest threat vector is physical access—such as leaving a laptop unattended in a public space. 

To mitigate this, Nyxora features a **Zero-Trust Auto-Lock**. After a period of inactivity, the dashboard automatically deploys a glassmorphism blur overlay, instantly hiding all portfolio data, active chats, and transaction states.

### Unlocking the Dashboard
To unlock the dashboard, you cannot simply type a password into the browser (as this would be vulnerable to keyloggers or browser extensions). Instead, you must authorize the unlock locally from your operating system's terminal:

```bash
nyxora unlock
```

This guarantees that anyone attempting to interact with your dashboard must possess physical terminal access to the host machine. (Note: VPS users can disable this timeout in their Dashboard Settings for a permanent workflow).

## Resilient UI (Offline Reconnect Overlay)

Nyxora's Dashboard uses a global network interceptor to monitor the health of the background daemon. 

If you restart the daemon (`nyxora restart`) or if the connection is unexpectedly lost, the UI will immediately pause and display a pulsing **"Nyxora Daemon Offline"** overlay. This prevents you from executing "ghost" transactions or losing state.

Once the daemon revives, the overlay automatically lifts, seamlessly resuming your workflow exactly where you left off.
