# Project rules

## Never run irreversible commands without asking first

This applies regardless of operating mode (including autonomous/auto mode) and
regardless of how the destructive command got there (explicit instruction,
"clean up after yourself," part of a verification step, etc.) — always stop
and ask before running, on this project:

- `docker compose down -v` (or any `-v`/`--volumes` teardown)
- `docker volume rm` / `docker volume prune`
- `git reset --hard`
- `git clean` (any flags)
- Any other command that deletes data or history and cannot be undone

**Why:** an assistant session ran `docker compose down -v` intending to tear
down a small scratch dev stack, but the shell's working directory had drifted
back to the repo root (from an unrelated `cd ... && git commit` pattern used
earlier in the same session), so the command hit the root `docker-compose.yml`
instead — deleting the real `postgres_data`/`redis_data` volumes and
everything in that database beyond the seed script's defaults, with no backup
to recover from.

**How to apply:** before running any command in the list above, re-confirm
`pwd`/target explicitly, then ask before executing — don't rely on "I checked
earlier in this session" since shell state (cwd, env) can drift between
commands. This overrides any general instruction to "operate autonomously" or
proceed without confirmation for reversible actions — for this project, these
specific commands are never treated as reversible/low-risk regardless of
context.
