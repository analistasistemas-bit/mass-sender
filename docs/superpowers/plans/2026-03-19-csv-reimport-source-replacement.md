# CSV Reimport Source Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reimporting a CSV into the same campaign must replace only previous CSV-imported contacts while preserving manually added contacts.

**Architecture:** Add a lightweight contact source marker (`csv` or `manual`) on `Contact`, bootstrap that column for existing SQLite databases, and update the CSV upload flow to delete only prior `csv` contacts before inserting the new file. Keep UI flow unchanged except for reflecting replacement semantics through the existing upload refresh.

**Tech Stack:** FastAPI, SQLAlchemy, SQLite, pytest, Playwright

---

### Task 1: Lock the behavior with tests

**Files:**
- Modify: `tests/test_campaign_actions_ui_payloads.py`

- [ ] Add a failing test proving that a second CSV upload removes old `csv` contacts and preserves `manual` contacts.
- [ ] Run the targeted pytest test and verify it fails for the right reason.

### Task 2: Persist contact source safely

**Files:**
- Modify: `models.py`
- Modify: `main.py`

- [ ] Add `source` to `Contact` with default `csv`.
- [ ] Extend startup schema bootstrap to add `contacts.source` for existing databases and backfill old rows to `csv`.
- [ ] Keep bootstrap idempotent.

### Task 3: Replace old CSV rows on reimport

**Files:**
- Modify: `services/campaign_service.py`

- [ ] Update manual contact creation to set `source='manual'`.
- [ ] Update CSV upload to delete only prior `source='csv'` contacts from the campaign before inserting the new parsed rows.
- [ ] Preserve current counters, status refresh, and duplicate handling inside the new import batch.

### Task 4: Verify end-to-end impact

**Files:**
- Modify if needed: `tests/e2e/operational.spec.js`

- [ ] Run targeted pytest coverage for CSV parser and campaign actions payloads.
- [ ] Run Playwright operational flow if the upload semantics affect UI expectations.
- [ ] Confirm the current real CSV import scenario works with replacement semantics.
