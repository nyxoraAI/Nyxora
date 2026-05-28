# Plugin Sandbox VM

Security is the absolute backbone of the Nyxora ecosystem. Because Nyxora supports loading community-built *External Skills* (Third-Party Plugins), protecting your system against **Supply Chain Attacks** is our highest priority.

To address this, Nyxora utilizes a strict **Node.js Virtual Machine (VM) Sandboxing** architecture.

---

## 🔒 Isolation Architecture (The Sandbox)

Whenever you download and install a third-party *Skill* into the `src/external_skills/` directory, that code is **NEVER** executed directly at the system level.

Instead, Nyxora creates an airtight *isolation chamber* (Sandbox) within memory using the native Node.js `vm` module. Third-party code is forced to live and execute exclusively within this chamber.

### 🚫 Strict Blacklisting

Inside the Sandbox, the native `require` function has been stripped down and replaced with a highly restrictive custom version. If a plugin attempts to call system modules that could compromise your computer, the system will reject it outright.

Permanently **blocked modules** include:
- `fs` (File System): Plugins cannot read, edit, or delete any files on your hard drive.
- `child_process`: Plugins cannot open a terminal or execute silent background commands (e.g., `rm -rf` or disk formatting).
- `os`, `net`, `tls`, `cluster`, `worker_threads`: Blocked to prevent low-level network exploitation.

If a plugin attempts to inject code like `require('fs')`, the VM Sandbox will instantly **Crash** (terminate and throw an error) before the malicious payload can execute.

### ✅ Permitted Modules

To ensure plugin developers still have room for creativity, we whitelist several guaranteed-safe modules:
- `crypto`: For encryption computations.
- `math` and native `String` manipulation utilities.
- `node-fetch` / `axios`: Plugins are **permitted** to make external API calls (for example: fetching live prices from Binance or weather data from OpenWeather). They can pull data from the internet, but they still **cannot** save files to your computer.

---

## 🛡️ Dual-Layer Security Harmony

What happens if a legitimate third-party Plugin *actually needs* to save its output to a text file?

Nyxora solves this using a **Dual-Layer Security Harmony** approach. The plugin itself will never have the ability to save the file. All it can do is process the data and hand the raw text back to the Nyxora AI.

The Nyxora AI then takes over, running the data through our rigorous **NLP Security Policy** evaluation (where the AI assesses whether the action is malicious). If it passes, the Nyxora AI will internally invoke its official *Native Skill* (`writeFile`) to save the document safely.

With this design, external functions can infinitely expand Nyxora's capabilities without ever touching a single OS-level permission on your machine!
