# Campaign Milestones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `Marcos recentes` so it shows only high-signal campaign/system milestones, including aggregated processing milestones and failure peaks.

**Architecture:** Generate milestone items in `build_activity_payload()` from campaign state transitions plus derived summary milestones based on counters. Keep the frontend renderer simple by consuming a short normalized list from the backend.

**Tech Stack:** FastAPI, SQLAlchemy, server-rendered HTML, vanilla JavaScript, Playwright, pytest

---

### Task 1: Backend milestone derivation

**Files:**
- Modify: `services/campaign_service.py`
- Test: `tests/test_campaign_actions_ui_payloads.py`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run the targeted pytest to verify failure**
- [ ] **Step 3: Add milestone derivation logic for campaign state, processed batches and failure peak**
- [ ] **Step 4: Re-run targeted pytest and make it pass**

### Task 2: Frontend milestone presentation

**Files:**
- Modify: `static/app.js`
- Modify: `templates/campaign.html`

- [ ] **Step 1: Update rendering to present short milestone cards with concise narrative**
- [ ] **Step 2: Ensure empty state remains explicit when no milestones are available**
- [ ] **Step 3: Keep existing activity/incident sections intact**

### Task 3: E2E coverage

**Files:**
- Modify: `tests/e2e/operational.spec.js`

- [ ] **Step 1: Add expectations for milestone items like campaign started/completed and aggregated batch markers**
- [ ] **Step 2: Run Playwright and confirm the new behavior**

### Task 4: Final verification

**Files:**
- Modify: `services/campaign_service.py`
- Modify: `static/app.js`
- Modify: `templates/campaign.html`
- Modify: `tests/test_campaign_actions_ui_payloads.py`
- Modify: `tests/e2e/operational.spec.js`

- [ ] **Step 1: Run `PYTHONPATH=. .venv/bin/pytest -q tests/test_campaign_actions_ui_payloads.py`**
- [ ] **Step 2: Run `node --check static/app.js`**
- [ ] **Step 3: Run `PYTHONPATH=. .venv/bin/python -m py_compile main.py services/campaign_service.py`**
- [ ] **Step 4: Run `npm run test:e2e`**
