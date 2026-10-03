# Import

Read docs/replace-moego.md. Use a fresh data directory and migrate without seed. Run `node scripts/grooming.mjs import moego --file=<export.csv> --dry-run` with `--map=<mapping.json>` if needed. Show counts and missing mappings. Then run the same command without --dry-run when the operator requested the import. Reconcile IDs, owners and counts. Do not claim that appointments, consent or payments were imported.
