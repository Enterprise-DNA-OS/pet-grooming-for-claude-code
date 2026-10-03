# Bring the client and pet list from MoeGo

MoeGo's [Client and Pet List overview](https://help.moego.pet/en/articles/13171141-client-pet-list-overview), checked 2026-10-03, describes Client & Pets > Options > Export Clients for the full client and pet list. Selecting clients and using Bulk Edit > Export exports only that selection as CSV. Select the full set needed for the move.

## A test run, then one import

Start with a fresh DATA_DIR. Run npm run migrate without npm run seed. Never mix the fictional demo with your business.

```bash
node scripts/grooming.mjs import moego --file=clients-pets.csv --dry-run
node scripts/grooming.mjs import moego --file=clients-pets.csv
node scripts/grooming.mjs clients
node scripts/grooming.mjs pets
```

The help page confirms CSV export but does not publish a fixed column specification. No customer export was available for this build. The sample is a synthetic compatibility fixture, not an actual vendor export. Check your headings and row shape before importing. The supported shape is one pet per row with repeated client details. A client without a pet, a combined pet list in one cell, or missing stable IDs needs an explicit preparation step. Do not silently drop these rows.

## Column mapping

| Record | Accepted headings | Result |
|---|---|---|
| Client identifier | Client ID, Customer ID | Required stable key |
| Client name | Client Name, Customer Name | Required |
| Contact | Email or Email Address, Phone or Phone Number | Text retained |
| Address | Address, Suburb or City | Text retained |
| Pet identifier | Pet ID | Required stable key |
| Pet name | Pet Name | Required |
| Pet description | Breed or Pet Breed, Species or Pet Type | Text retained, missing species is unknown |

For different headings, copy examples/columns.json and set each value to the exact heading in your file. Pass --map=columns.json to both commands. Missing identifiers must be supplied through an operator-approved mapping before import. Never invent stable IDs from a pet name alone. If your export lacks them, agree a repeatable ID assignment and retain that mapping with the original export.

All columns are preserved in raw_import for later mapping. Appointment history, balances, card details, messages, photographs, signed forms, vaccination evidence, pet notes, rebooking frequency and permissions do not become operational records from this identity import. Review and map them separately. Emergency consent starts blank and imported pets have no assumed last groom date.

Repeated imports update identity and contact fields by vendor ID, preserving local care notes, cycle, activity, consent and history. Duplicate pet IDs, inconsistent client rows, malformed CSV and changes of pet ownership fail before writes. An import is one transaction. Recheck contact details changed by later exports.

## Reconcile before changing systems

Compare unique client and pet IDs and counts with the original export. Check every pet belongs to the right owner. Sample addresses, accents, quoted commas and multiline notes. Reconcile past visits and unpaid balances separately, enter verified consent references, then test the day sheet and rebooking list. Keep MoeGo available until the operator accepts the result. The importer covers the list, not a complete financial cutover.

Export all eleven record types using node scripts/grooming.mjs export --out=private-snapshot.json. The file must be new. This is an exchange snapshot, not an automatic restore. Keep native database backups, original exports and documents as well. Enterprise DNA scopes the remaining mapping and migration as part of your version.
