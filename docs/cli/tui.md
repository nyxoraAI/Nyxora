---
title: TUI Interface
description: Comprehensive guide on using the Nyxora Terminal User Interface (TUI)
---

# 🖥️ TUI Interface

Nyxora features a powerful, interactive Terminal User Interface (TUI) designed specifically for VPS (Virtual Private Server) deployments and CLI-heavy workflows. The TUI provides a rich dashboard experience entirely within your terminal.

## What is the TUI?

The TUI (`nyxora tui`) is a full-featured terminal dashboard. Unlike a standard streaming chat prompt, the TUI leverages the [Ink](https://github.com/vadimdemedes/ink) framework to render a React-like component structure directly in your console. 

It provides:
- Split-pane layout (Chat history vs Active prompt)
- Status indicators (Daemon connection state)
- Formatted markdown rendering for agent responses
- Tabular displays for portfolio/balance checks

## `nyxora tui` vs `nyxora chat`

| Command | Interface Type | Best For | Requires Daemon |
|---------|----------------|----------|-----------------|
| `nyxora tui` | Full Dashboard (Split panes, status bars, dynamic rendering) | VPS monitoring, complex multi-step tasks, full dashboard feel | Yes |
| `nyxora chat` | Simple Streaming Prompt (Standard stdin/stdout loop) | Quick scripts, simple queries, low-resource environments | Yes |

## Launching the TUI

To use the TUI, the Nyxora Daemon must be running in the background.

```bash
# 1. Start the daemon (if not already running)
nyxora start

# 2. Launch the TUI
nyxora tui
```

If the daemon is not running, the TUI will display a connection error and ask you to run `nyxora start`.

## Troubleshooting

### "Cannot find module" or generic TUI crash
If you installed Nyxora from source (Local Development) and the TUI fails to start with a module error, you likely need to rebuild the TUI package:

```bash
# From the root of the Nyxora repository
npm run build
```
This ensures the `@nyxora/tui` package is properly transpiled.

*(If you installed via `npm install -g nyxora`, the TUI is pre-compiled and this step is not necessary).*
