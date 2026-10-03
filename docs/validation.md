# Validation evidence

Checked on Linux, 2026-10-03, Node 22.

- npm install passed with no dependency vulnerabilities reported.
- npm test passed 44 checks using an isolated PGlite database.
- The suite exercises 17 reads, every write and all ten demonstrated questions.
- 38 agent command recipes ship, excluding the command-directory README.
- npm run demo passed migration, seed and report execution.
- npm run view rendered four dashboards. npm run docs rendered three document families.
- README, operating instructions and prose docs passed brand lint with no violations.

Windows and Postgres execution results will be appended after the private GitHub run. TEST_DATABASE_URL is only for a disposable test database. No real MoeGo export was available. CSV tests use synthetic fixtures and explicit column mapping.
