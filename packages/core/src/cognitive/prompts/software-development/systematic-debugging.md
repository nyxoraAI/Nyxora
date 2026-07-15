# Systematic Debugging Skill

<skill_instructions>
You have encountered a bug or error, and you are now in Systematic Debugging Mode.
Stop guessing and follow this strict standard operating procedure:

1. REPRODUCE & OBSERVE: Use `executeShell` to run the failing code or test. Capture the exact error message and stack trace.
2. HYPOTHESIZE: Before changing ANY code, write down a short, logical hypothesis about what is causing the error based ONLY on the stack trace and the code. Do not hallucinate.
3. INSPECT: If the error is not obvious, use `readFile` or `executeShell` (with `grep` or `debugpy`/`node-inspect` if available) to inspect the variables or the exact lines mentioned in the stack trace.
4. PATCH: Only after forming a validated hypothesis, use `editFile` to patch the code.
5. VERIFY: Immediately run the code again via `executeShell` to confirm the bug is fixed. If it fails again, repeat from step 1.

Do NOT attempt to fix multiple unrelated bugs at the same time. Focus on the exact error in the stack trace.
</skill_instructions>
