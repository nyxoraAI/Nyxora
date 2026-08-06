# Autonomous Testing & Fix Loop SOP

## Overview
This SOP outlines the process for autonomously running tests and fixing failures.

## Test Loop Strategy
1. **Run Tests First:** Always run the tests to get a baseline before making any changes. Use the `run_tests_and_fix` tool.
2. **Parse Output:** Carefully read the test output. Identify the specific file, line number, and error type.
3. **Fix Iteratively:** Fix **one failure at a time**. Do not attempt to fix all failing tests in a single go.
4. **Re-run:** Run the tests immediately after making a fix to verify it worked.
5. **Regression Check:** If your fix causes previously passing tests to fail, revert your changes and rethink the approach.
6. **Limit Iterations:** Do not loop infinitely. If the test cannot be fixed after 3-5 iterations, escalate to the user and stop.
7. **Identify Flaky Tests:** Distinguish between deterministic failures and flaky tests (tests that fail randomly). If a test is flaky, flag it rather than trying to fix it blindly.
