# CLAUDE.md — Sales Dashboard (BoldBusiness/laura-dashboard)

## Project
Full-stack sales dashboard for Laura + Darren AI outreach agents.
- **Frontend:** React 18 + Vite, `app/src/`
- **Backend:** Express 5 ESM, `api/server.js` (single file)
- **DB:** PostgreSQL on AWS RDS (`bb-agents-shared-db`, database=`laura`)
- **Repo:** https://github.com/BoldBusiness/laura-dashboard

## Local Dev
```bash
bash dev.sh          # starts API (:3100) + Vite (:5173) together
cd app && npm run build   # production build check
```

## Agent Colors (never change)
- Laura = `#06E5EC` (cyan)
- Darren = `#F59E0B` (amber)
- Combined = `#8B5CF6` (purple)

## Parity Rule (non-negotiable)
Every feature Laura has must exist identically for Darren. Never add a feature for one agent only.

## Key Patterns
- No test runner — verification = `npm run build`
- Auth: global `app.use(authMiddleware)` in server.js covers all routes — do NOT add `requireAuth` as a route-level arg (it's undefined)
- DB migrations: always use `ADD COLUMN IF NOT EXISTS` — runs at every server startup
- Two DB pools: `pgPool` (laura DB, used for contacts/tasks), `bbPool` (bb_agents shared)

## PR Style (always use this format)
Branch: `feat/kebab-case-description` or `fix/kebab-case-description`
Title: `feat(scope): short description` or `fix(scope): description`

```bash
gh pr create --title "feat(scope): description" --body "$(cat <<'EOF'
## Summary
- What was done (bullet points)

## What Changed vs main
- **New files:** ...
- **Modified:** ...
- **Removed:** ...

## How to Test
- [ ] `bash dev.sh` — API on :3100, App on :5173
- [ ] Check affected tabs/features in browser
- [ ] `cd app && npm run build` — must pass

## API Changes
- New endpoints or changed signatures (if any)

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
EOF
)"
```

## Push & PR Flow
```bash
git push -u origin <branch-name>
gh pr create ...   # use template above
```
