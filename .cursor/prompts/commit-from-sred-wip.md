# Commit from SR&ED WIP

Read `docs/sred/wip-<current-branch-with-slashes-as-hyphens>.md` (create path from `git branch --show-current`). Read staged diff (or working tree if nothing staged).

1. Propose a conventional commit **subject** and **body** describing the change for humans (what we did — **required**; do not output SR&ED-only).
2. In the **same** message, after that body: apply `.cursorrules` SR&ED Mandatory Pre-Check; append either the full **SRED TECHNICAL LOG** (only if rules satisfied and WIP supports it) or exactly: `SRED: Not applicable (routine work)`.
3. Archive WIP entries used for this message under `## Archived (today's date)` in the same WIP file.

Do not invent experiments or failures not present in the WIP or diff.
