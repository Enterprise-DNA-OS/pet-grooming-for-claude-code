# Pet Grooming for Claude Code

Clients, pets, grooming appointments, van runs, rebooking and care records in a database you own. Built by Enterprise DNA. Works with Claude Code, Codex, OpenCode or Cursor.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free under MIT. Follow the quick start. | Your fields, rules, MoeGo mapping, booking experience and optional mobile interface. [Book a call](https://enterprisedna.co/omni/book?offer=replace-software&utm_medium=readme&utm_campaign=moego). | Installed, connected and operated through **Omni by Enterprise DNA**. One setup fee, then a retainer. [See the offer](https://enterprisedna.co/omni/instead-of/moego?utm_source=github&utm_medium=readme&utm_campaign=moego). |

## Quick start

Node 20 or later on Windows or Linux. No database installation is needed for the demo.

```bash
git clone https://github.com/Enterprise-DNA-OS/pet-grooming-for-claude-code.git
cd pet-grooming-for-claude-code
npm install
npm test
npm run demo
npm run view
npm run docs
```

Open the folder in your coding agent and ask for /weekly-review. The fictional demo contains overdue pets, a partly paid groom, a missed appointment, an open care incident and missing vaccination and consent evidence. Dates move with the day the seed first runs. Seed is repeatable without replacing existing records. The two Milos demonstrate why ambiguous names must be checked.

## The five weekly rituals

1. The day sheet: visits, staff, services, handling notes and contact details.
2. The van run: appointments in time order with addresses and suburbs.
3. Rebooking: overdue pets, their grooming cycle and the waiting list.
4. Balances: completed work, recorded receipts and unpaid amounts by currency.
5. Care review: admission observations, handovers, consent references and open incidents.

The CLI also books appointments with overlap checks, records care, completes grooms, records payments made elsewhere, writes drafts and imports the client and pet list. It does not process payments. One resource represents one van or one salon grooming station. Model multiple salon stations as separate resources. Staffing, travel buffers, routes and local opening hours need the operator's review. Times are UTC with explicit timezone required when booking.

## Commands

- `/clients`: Run `node scripts/grooming.mjs clients --json`.
- `/pets`: Run `node scripts/grooming.mjs pets --json`.
- `/staff`: Run `node scripts/grooming.mjs staff --json`.
- `/resources`: Run `node scripts/grooming.mjs resources --json`.
- `/services`: Run `node scripts/grooming.mjs services --json`.
- `/day-sheet`: Run `node scripts/grooming.mjs day-sheet --json` with `--date=YYYY-MM-DD` for the requested UTC day.
- `/van-run`: Run `node scripts/grooming.mjs van-run --json` with `--date=YYYY-MM-DD` for the requested UTC day.
- `/appointments`: Run `node scripts/grooming.mjs appointments --json`.
- `/rebooking`: Run `node scripts/grooming.mjs rebooking --json`.
- `/balances`: Run `node scripts/grooming.mjs balances --json`.
- `/vaccinations`: Run `node scripts/grooming.mjs vaccinations --json`.
- `/waitlist`: Run `node scripts/grooming.mjs waitlist --json`.
- `/incidents`: Run `node scripts/grooming.mjs incidents --json`.
- `/care-checks`: Run `node scripts/grooming.mjs care-checks --json`.
- `/compliance`: Run `node scripts/grooming.mjs compliance --json`.
- `/attention`: Run `node scripts/grooming.mjs attention --json`.
- `/revenue`: Run `node scripts/grooming.mjs revenue --json`.
- `/pet`: Pet.
- `/client`: Client.
- `/questions`: Questions.
- `/add`: Add.
- `/book`: Book.
- `/status`: Status.
- `/complete`: Complete.
- `/log`: Log.
- `/receive`: Receive.
- `/vaccinate`: Vaccinate.
- `/incident`: Incident.
- `/resolve`: Resolve.
- `/wait`: Wait.
- `/close-wait`: Close wait.
- `/consent`: Consent.
- `/import`: Import.
- `/export`: Export.
- `/draft-rebooking`: Draft rebooking.
- `/weekly-review`: Weekly review.
- `/customise`: Customise.
- `/new-view`: New view.

The recipes live in .claude/commands. Run node scripts/grooming.mjs --help for arguments. Reads default to aligned text and accept --json. Full names match without case. ID prefixes are supported and ambiguous matches list all candidates and exit 1.

## Ten questions across your records

These queries combine your records beyond a single day sheet. They are demonstrated here, not an unsupported claim that MoeGo has no equivalent report. Run node scripts/grooming.mjs questions --question=N.

1. Which overdue pets also have an unresolved care incident?
2. Which upcoming appointments lack an emergency veterinary consent reference?
3. Which overdue pets have both an unpaid groom and a waiting-list request?
4. How many booked minutes does each groomer have in the next seven days?
5. Which van visits need special handling, grouped by suburb?
6. Which pets are due back but have expired vaccination evidence?
7. Which completed grooms have no recorded handover?
8. Which clients need emergency contact details before their next visit?
9. Which waiting pets share a suburb with a booked van visit?
10. How much remains unpaid from completed work, separated by currency?

## Your first hour: ten things to ask for

1. Show the attention list and explain each item.
2. Which pets need rebooking this week?
3. Show tomorrow's van visits with handling notes.
4. Read Poppy's owner and care history.
5. Record the admission observation I supply.
6. List completed grooms with unpaid balances.
7. Draft a rebooking note, without sending it.
8. Render the groom card and owner statement.
9. Test our MoeGo client and pet export and explain every missing mapping.
10. Add a preferred appointment window and show it on the rebooking view through /customise.

## Import and ownership

[The switching guide](docs/replace-moego.md) covers MoeGo's export path, supported CSV headings, optional column mapping, validation and reconciliation. A dry run checks the whole file. Identity imports repeat by stable IDs and preserve local care, consent and cycles. History, payment balances and signed forms require separate mapping. The vendor's public help does not specify fixed CSV columns, so compatibility with a real export must be checked before cutover.

Use a fresh DATA_DIR and run npm run migrate without seed for your business. DATABASE_URL selects your shared Postgres database. Otherwise PGlite stores data locally. Production needs configured access controls, backups and private document storage. Do not share the local database directory between running processes.

Export all eleven record types with node scripts/grooming.mjs export --out=private-snapshot.json. The destination must be new. This exchange snapshot is not an automatic restore. Keep native database backups and original documents too.

## Documents, views and care checks

Set your business name, logo path and colours in brand.json. npm run docs renders groom and handover cards, client statements and incident reports. They are working records, not tax invoices. npm run view renders the week, rebooking, money and care dashboards. Open the HTML locally and print it if needed. Nothing is hosted or sent.

[Compliance notes](docs/compliance.md) separate New Zealand source-based record checks from house rules. The base is not a veterinary or boarding system, does not establish clinical vaccination schedules, and does not certify compliance. [Why no front end](docs/why-no-front-end.md) explains the mobile, booking and route work to scope for your version.

## Validation

npm test uses temporary data and output folders. It exercises every CLI command, migration and seed repeatability, ambiguous names, bookings, care transitions, payment guards, import rollback and mapping, currency separation, exports, drafts and HTML output. GitHub Actions runs Linux and Windows PGlite tests and a separate Postgres 17 job. See docs/validation.md for observed results.

## Licence

MIT. Copyright 2026 Enterprise DNA. MoeGo is named for compatibility and comparison. No affiliation or endorsement is implied.
