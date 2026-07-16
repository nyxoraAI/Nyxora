# CLI Overview & Global Flags

The Nyxora Command Line Interface (CLI) is the primary tool for managing your local daemon, installing plugins, and configuring system behaviors.

## ✨ Global Flags

The following flags can be appended to almost any `nyxora` command:

- `--help`, `-h`: Show help documentation for the current command.
- `--version`, `-v`: Display the current installed version of Nyxora CLI.
- `--verbose`: Enable verbose logging for debugging purposes.
- `--json`: Output command results in JSON format.

## 📌 Core Commands

- `nyxora start`: Starts the background daemon (Core LLM, ML Engine, Policy Engine, Signer Vault).
- `nyxora dashboard`: Launches the local React UI dashboard in your web browser.
- `nyxora chat`: Launches the Terminal User Interface for non-GUI / VPS environments.
- `nyxora setup`: Initiates the interactive configuration wizard.
- `nyxora stop`: Safely terminates the background daemon.

## 📌 Environment Variables

The CLI's behavior can be altered using environment variables:
- `NYXORA_HOME`: Defines the root directory for Nyxora configuration (default: `~/.nyxora`).
- `NYXORA_LOG_LEVEL`: Sets the minimum log level (e.g. `info`, `debug`, `error`).
