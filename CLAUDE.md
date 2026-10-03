# Pet Grooming for Claude Code: operating instructions

## Context

Fictional Harbour Paws Grooming demo for a New Zealand salon and mobile operator. Record the real business, operator, jurisdiction and local timezone here before importing live records. Start live data in a fresh DATA_DIR and migrate without seed. Never mix demo and real clients.

## Working rules

Read the records before writing or answering. Use scripts/grooming.mjs as the one CLI. Human output is the default, --json is for agents. Names match without case and ID prefixes work. Ambiguous names must be resolved from the candidates, never guessed. Dates and appointment times are UTC. Money is integer cents with explicit NZD or AUD. Keep currencies separate.

Only record care observations, signed-form references and external payments actually supplied by the operator. Care checks flag record gaps, not legal conclusions. The reference rules are New Zealand only. Australian requirements need local review. No sends, public pages, card charges or bank connections exist. Draft files stay private. A van run is a visit list, not route optimisation.

## Job routing

| Job | Command |
|---|---|
| Clients | `/clients` |
| Pets | `/pets` |
| Staff | `/staff` |
| Resources | `/resources` |
| Services | `/services` |
| Day Sheet | `/day-sheet` |
| Van Run | `/van-run` |
| Appointments | `/appointments` |
| Rebooking | `/rebooking` |
| Balances | `/balances` |
| Vaccinations | `/vaccinations` |
| Waitlist | `/waitlist` |
| Incidents | `/incidents` |
| Care Checks | `/care-checks` |
| Compliance | `/compliance` |
| Attention | `/attention` |
| Revenue | `/revenue` |
| Pet | `/pet` |
| Client | `/client` |
| Questions | `/questions` |
| Add | `/add` |
| Book | `/book` |
| Status | `/status` |
| Complete | `/complete` |
| Log | `/log` |
| Receive | `/receive` |
| Vaccinate | `/vaccinate` |
| Incident | `/incident` |
| Resolve | `/resolve` |
| Wait | `/wait` |
| Close Wait | `/close-wait` |
| Consent | `/consent` |
| Import | `/import` |
| Export | `/export` |
| Draft Rebooking | `/draft-rebooking` |
| Weekly Review | `/weekly-review` |
| Customise | `/customise` |
| New View | `/new-view` |

## Files and changes

- The one command library is .claude/commands for all runtimes. AGENTS.md points here.
- scripts/grooming.mjs contains the domain CLI and ten question queries.
- supabase/migrations holds append-only migrations. npm run migrate applies them transactionally.
- DATABASE_URL selects shared Postgres. Without it, DATA_DIR selects the local PGlite database. Do not open the same embedded directory from two processes.
- brand.json, views.json and documents.json control private printable output.
- Never seed live records. Never delete records without an explicit instruction. Prefer closing or cancelling.
- Run npm test after a change. Tests ignore DATABASE_URL and use temporary data. TEST_DATABASE_URL is only for a disposable CI database.
- Consult docs/replace-moego.md for import scope and docs/compliance.md for sources and limits.

Built and run through Omni by Enterprise DNA.
