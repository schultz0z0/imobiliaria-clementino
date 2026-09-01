# Produção State Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate and restore a verifiable migration bundle containing the validated local PostgreSQL state, media volumes, and public release without manual re-cadastros.

**Architecture:** A Windows-friendly preparation command uses Docker to export the stopped local PostgreSQL container and named media/release volumes into a dedicated bundle outside Git. A POSIX restore script runs on the VPS, validates the bundle and confirmation flag, creates a rollback backup, restores data/media/release, revokes imported sessions, and verifies expected counts. The bundle never contains `.env` or secrets.

**Tech Stack:** PowerShell, Bash, Docker Compose, PostgreSQL `pg_dump`/`pg_restore`, tar, SHA-256 manifests, Node test runner.

---

### Task 1: Specify bundle manifest and safety validation

**Files:**
- Create: `scripts/operations/stateMigration.ts`
- Test: `scripts/operations/stateMigration.test.ts`
- Modify: `package.json`
- Modify: `scripts/deployment.test.ts`

**Step 1: Write the failing test**

Add tests for required bundle files, manifest version/counts, path traversal rejection, and refusal when `COMPLETE` is absent.

**Step 2: Run the focused test**

Run: `npx tsx --test scripts/operations/stateMigration.test.ts`

Expected: FAIL because the migration manifest helpers do not exist.

**Step 3: Implement the minimal helper**

Implement typed manifest creation/validation and expose a `state:migration:prepare` script entry. Keep all path checks scoped to the bundle directory.

**Step 4: Verify the focused test**

Run: `npx tsx --test scripts/operations/stateMigration.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/operations/stateMigration.ts scripts/operations/stateMigration.test.ts package.json scripts/deployment.test.ts
git commit -m "feat: add migration bundle manifest validation"
```

### Task 2: Add local Docker export command

**Files:**
- Create: `scripts/operations/prepareProductionMigration.ps1`
- Modify: `README.md`
- Modify: `.gitignore`

**Step 1: Write the failing test**

Extend deployment tests to require the preparation command to validate the local Postgres container, export named media/release volumes, write `database.dump`, `media.tar.gz`, `release.tar.gz`, `manifest.json`, and `COMPLETE`, and reject repository-root output.

**Step 2: Run the focused test**

Run: `npx tsx --test scripts/deployment.test.ts`

Expected: FAIL because the PowerShell command and documentation are absent.

**Step 3: Implement the command**

Use Docker-only operations with explicit defaults for the known dev containers/volumes. Export PostgreSQL logically with `pg_dump --format=custom --no-owner --no-acl`; archive private/public media and releases without including secrets; calculate SHA-256 values; write `COMPLETE` only after all artifacts finish. Keep output outside the repository by default and allow an explicit dedicated directory.

**Step 4: Verify the focused tests and syntax**

Run: `npx tsx --test scripts/deployment.test.ts` and inspect the generated bundle with a dry run against the local volumes.

Expected: all deployment tests pass and the bundle has all required artifacts.

**Step 5: Commit**

```bash
git add scripts/operations/prepareProductionMigration.ps1 README.md .gitignore scripts/deployment.test.ts
git commit -m "feat: prepare local state migration bundle"
```

### Task 3: Add guarded VPS restore command

**Files:**
- Create: `scripts/operations/restoreProductionMigration.sh`
- Modify: `scripts/deployment.test.ts`
- Modify: `docs/ADMIN-DEPLOYMENT.md`

**Step 1: Write the failing test**

Assert the restore script requires `--confirm-production`, checks `COMPLETE` and manifest checksums, creates a pre-restore backup, uses `pg_restore --clean --if-exists --no-owner`, extracts media/release archives, and never runs `down -v` or removes named volumes.

**Step 2: Run the focused test**

Run: `npx tsx --test scripts/deployment.test.ts`

Expected: FAIL because the restore script is absent.

**Step 3: Implement the restore command**

Require an explicit bundle path and confirmation flag. Read connection settings only from `.env.production` through Compose, create a timestamped rollback backup, stop only API/publisher while preserving PostgreSQL and volumes, restore the dump, extract media/release into temporary containers, revoke sessions, and validate `53` properties (`52` published, `1` inactive), one admin, and media file checksums. Abort on any mismatch before reporting success.

**Step 4: Verify script and tests**

Run: `bash -n scripts/operations/restoreProductionMigration.sh` on a POSIX shell and `npx tsx --test scripts/deployment.test.ts` locally.

Expected: syntax valid and tests pass.

**Step 5: Commit**

```bash
git add scripts/operations/restoreProductionMigration.sh scripts/deployment.test.ts docs/ADMIN-DEPLOYMENT.md
git commit -m "feat: add guarded production state restore"
```

### Task 4: Generate and verify the actual local bundle

**Files:**
- Outside Git: `D:/Projetos SaaS/Imobiliaria Clementino-migration-<timestamp>/`

**Step 1: Run preparation**

Run the PowerShell preparation command while the local Postgres container is stopped and verify that the command reports the expected 53/52/1/1/1466 counts.

**Step 2: Verify the bundle**

Run the built-in manifest verifier and compare SHA-256 values for database, media, and release archives.

**Step 3: Package for transfer**

Transfer the dedicated bundle directory to the VPS with `scp`/SFTP. Do not commit it or place it under the repository.

### Task 5: Restore and validate production

**Files:**
- VPS-only: `/opt/imobiliaria-clementino/.migration-backup-*`

**Step 1: Back up current production state**

Run the restore script without the confirmation flag first to prove it refuses to mutate production, then run it with `--confirm-production` after checking the bundle path.

**Step 2: Restore state**

Use the guarded script to restore database, media, and release while preserving Docker volumes.

**Step 3: Reset the admin password**

Set a new production password after restore because the local admin hash becomes authoritative.

**Step 4: Verify**

Check Compose health, database counts, login, `/imoveis`, one detail page, media responses, and absence of restarting containers.

**Step 5: Roll back if needed**

Use the pre-restore backup and prior release only if a verification check fails; never delete the PostgreSQL or media volumes.
