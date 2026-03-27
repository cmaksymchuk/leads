# Fix Blocking Issues Prompt

You have been given a code review containing blocking issues.
Your job is to fix every blocking issue. Nothing else.

## Rules
- Fix only what is listed as blocking.
- Do not refactor, rename, or reorganize anything not in the blocking list.
- Do not change non-blocking items.
- After all fixes, run: npm test
- Report results as: "X tests passed, Y failed" only. No other test output.
- For each fix, report: file changed | what was wrong | what you did.
- If a fix requires a judgment call (e.g. which flow tag to assign),
  ask before proceeding. Do not guess.

## When you are done
Output a short summary:
- N files changed
- List of fixes applied
- Test result (pass/fail)
- Any questions that need answers before this is ready to merge
