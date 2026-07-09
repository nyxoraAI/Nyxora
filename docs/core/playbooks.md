# 📚 Playbooks (Markdown SOPs)

While Nyxora is equipped with hardcoded TypeScript skills for complex API interactions, its true cognitive flexibility comes from **Playbooks**. 

Playbooks are human-readable Standard Operating Procedures (SOPs) written entirely in plain Markdown (`.md`). They teach the Nyxora AI Agent how to perform multi-step workflows, interact with specific websites, or interpret complex DeFi strategies without requiring you to write a single line of code.

## 🧠 How It Works

Nyxora features a built-in `PlaybookManager`. Upon initialization, the agent scans the `packages/core/playbooks/` (synced locally to `~/.nyxora/playbooks/`) directory and loads all available Playbooks into its short-term memory index.

When you ask the agent to perform a task (e.g., "Deploy a smart contract using Foundry" or "Fetch Twitter data"), the Large Language Model (LLM) intelligently searches its index, reads the relevant Markdown Playbook, and executes the exact steps you defined.

## 🛠️ Playbook vs. TypeScript Skills

| Feature | Playbook (Markdown SOP) | TypeScript Skill |
|---------|-------------------------|------------------|
| **Creation** | Plain text editor | Code (TypeScript / API logic) |
| **Hot Reload** | Instant (No restart needed) | Requires daemon restart |
| **Complexity** | Best for workflows, prompt chains | Best for heavy data parsing, signatures |
| **Accessibility**| Anyone (No coding required) | Developers |

## ✍️ Writing a Playbook

Creating a Playbook is as simple as creating a `.md` file in `~/.nyxora/playbooks/`.

A good playbook should have:
1. **Clear Title & Description:** Tell the AI exactly *when* to use this playbook.
2. **Prerequisites:** If the playbook requires environment variables (e.g., API keys), tell the AI where to source them.
3. **Step-by-Step Instructions:** Use numbered lists. Tell the AI what terminal commands to run or what logic to apply.

### Example: Foundry Deployment Playbook

```markdown
# Foundry Smart Contract Deployment Playbook

Use this playbook when the user asks to "deploy", "compile", or "test" a smart contract using Foundry.

## Steps:
1. Check if the current directory is a valid Foundry project by looking for `foundry.toml`.
2. If it is a Foundry project, run `forge build` to compile the contracts.
3. If compilation fails, read the error output, fix the solidity code, and try again.
4. Once compiled, use the `execute_bash` tool to run `forge create` with the user's parameters.
```

## 🤖 Playbook Recorder (Auto-Learn)

As part of the **Nyxora Next** vision (v26.7.10+), Nyxora features an **Auto-Learn** capability (CRITICAL RULE 7). 

If you guide the agent through a complex, multi-step problem in the terminal (e.g., fixing a weird dependency error) and successfully solve it, you can simply tell the agent: 
> *"Remember how we just solved this? Save it as a Playbook."*

The OS Agent will dynamically abstract the chat history into a generalized Markdown SOP and save it to the Playbooks directory. The next time the agent encounters the same issue, it already knows the solution!

## 🎛️ Managing Playbooks (Skill Store)

You can manage your playbooks without touching the file system using the **Nyxora Dashboard**.
Navigate to the **Skill Store** tab in the dashboard (`http://localhost:3000`) to access a modern split-pane Markdown editor. From there, you can browse, edit, delete, or create new playbooks seamlessly.
