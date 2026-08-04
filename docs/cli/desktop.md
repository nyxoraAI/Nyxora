# 🖥️ Nyxora Desktop Application

Nyxora includes a native, standalone desktop client built with **Electron**, **Vite**, and **SvelteKit 5** (`@nyxora/desktop`).

The Desktop app brings the full power of the Web Dashboard into an OS-native application window with enhanced performance, hardware-accelerated rendering, and desktop-exclusive capabilities.

---

## 🚀 Launching the Desktop App

When running Nyxora from source or within a local development workspace, you can launch the native desktop application using:

```bash
# Launch from the repository root
npm run desktop

# Or launch directly from the workspace
npm run dev --workspace=nyxora-desktop
```

> [!NOTE]
> **Zero-Touch Daemon Bootstrapping:** The Electron main process intelligently manages the background daemon lifecycle. Upon launch, it automatically checks for a running Nyxora daemon (`http://localhost:40000`). If offline, it boots the daemon in the background and shuts it down safely when you exit the app.

---

## 🐧 Linux Sandbox Execution (SUID Compatibility)

To ensure reliable execution across Linux distributions (such as Ubuntu, Debian, Arch, and Fedora) without requiring root-owned SUID sandbox binaries, Nyxora Desktop injects hardened Electron sandbox flags:
*   `--no-sandbox`
*   `--disable-gpu-sandbox`
*   `--disable-setuid-sandbox`
*   `ELECTRON_DISABLE_SANDBOX=1` environment injection

This guarantees that launching the desktop app from unprivileged user directories or global npx environments works seamlessly without fatal kernel sandbox crashes.

---

## ✨ Desktop Features & UI Parity

The SvelteKit desktop app offers 100% feature parity with the web dashboard while introducing native OS features:

### 🎙️ Voice Mode & Listen
*   **Speech-to-Text (STT) & Text-to-Speech (TTS):** Enable **Listen** and **Voice** mode in your Agent Profile settings to speak directly to your agent and hear conversational spoken responses.

### 📅 Cron / Scheduled Tasks Navigation
*   Access your time-based recurring jobs (`CronManager`) directly from the header icon button located immediately below the global **Search** button.

### 📚 Workflows (SOPs)
*   Manage, create, and execute your Markdown-based Standard Operating Procedures directly from the **Workflows** menu (previously titled "Playbooks").

### 🎛️ LLM Engine Parameter Parity
*   Fine-tune AI randomness and generation behavior with interactive slider controls in **Settings ➔ LLM Engine**:
    *   **Frequency Penalty** (`-2.0` to `2.0`)
    *   **Presence Penalty** (`-2.0` to `2.0`)
    *   **Repetition Penalty** (`0.0` to `2.0`)
    *   **Reasoning Effort** (`low`, `medium`, `high`)

### ⚡ GPU-Accelerated Smooth Scrolling
*   The Desktop Settings modal is engineered with virtualized rendering, CSS containment (`contain: content`), and hardware-accelerated transforms (`will-change-transform`) for fluid, zero-lag scrolling even across heavy configuration panels.
