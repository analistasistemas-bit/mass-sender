# Operational Controls and Large-Volume Behavior

## Purpose

This document explains the last major implementation added to the campaign console:

- configurable send delay per campaign
- daily send limit per campaign
- automatic pause when the daily limit is reached
- automatic wait outside the send window `08:00-20:00`
- automatic pause after `5` consecutive failures
- deterministic greeting injection at send time
- operational UI for the controls above
- schema bootstrap for the existing `app.db`

The goal of this layer is operational safety and predictability when the campaign has a large amount of contacts. It is not a bypass layer and it does not change the non-official transport used by the current stack.

## What Changed

The implementation touches five areas:

1. Data model
2. Send engine
3. Campaign services and API
4. Campaign UI
5. Documentation and tests

The project now stores extra operational state per campaign:

- minimum and maximum delay between sends
- daily limit
- number of sends already completed today
- date of the last send activity
- reason for automatic pause

The worker uses that state to decide when to send, when to wait, and when to pause.

## Technical Architecture

### Main flow

The runtime flow is:

1. The frontend opens a campaign.
2. The UI fetches `/campaigns/{id}/stats` and `/campaigns/{id}/overview`.
3. The operator updates operational settings if needed.
4. The operator starts the campaign.
5. The worker pulls pending contacts in small batches.
6. For each contact, the worker:
   - checks the send window
   - checks the daily limit
   - applies a random delay inside the configured range
   - renders the final message with a fixed greeting
   - sends it through the active WhatsApp provider
   - increments the daily counter on success
7. The worker pauses the campaign automatically when a safety rule is hit.

### New helper modules

The implementation is split into small helpers:

- `utils/message_compose.py`
- `utils/schedule_guard.py`
- `utils/daily_limit.py`

That keeps the send engine readable and makes the behavior easier to test.

## Data Model

### New `Campaign` fields

The `Campaign` model now includes:

- `send_delay_min_seconds`
- `send_delay_max_seconds`
- `daily_limit`
- `sent_today`
- `last_send_date`
- `pause_reason`

### Meaning of each field

- `send_delay_min_seconds`
  - lower bound for the delay before each send
  - default: `15`

- `send_delay_max_seconds`
  - upper bound for the delay before each send
  - default: `45`

- `daily_limit`
  - maximum number of successful sends allowed for the current day
  - `0` means no daily limit

- `sent_today`
  - counter of successful sends on the current day

- `last_send_date`
  - timestamp of the last send day used to reset `sent_today`

- `pause_reason`
  - why the campaign was automatically or manually paused
  - values used by the system:
    - `manual`
    - `daily_limit_reached`
    - `consecutive_failures`

## Schema Bootstrap

### Why it was needed

The repository does not use Alembic. Existing installations may have an older `app.db` file that lacks the new columns.

### What the bootstrap does

On startup, the application:

1. creates the base schema with `Base.metadata.create_all()`
2. inspects the `campaigns` table with `PRAGMA table_info`
3. adds missing operational columns with `ALTER TABLE`
4. backfills defaults for old rows

### Operational impact

This makes the deployment safe for the current SQLite database without requiring a manual migration step before the app can boot.

### Validated result

The bootstrap was executed against the existing `app.db` and the new columns were confirmed in the table schema:

- `send_delay_min_seconds`
- `send_delay_max_seconds`
- `daily_limit`
- `sent_today`
- `last_send_date`
- `pause_reason`

## Send Engine Behavior

### Batch handling

The current worker still uses batch processing:

- starts with a small batch size
- grows slowly when the run is stable
- shrinks when consecutive failures appear

The new rules are applied inside that batch flow.

### Delay between sends

Before each send, the worker uses the configured range for the campaign:

- minimum delay
- maximum delay

It picks a random value between those two numbers for every contact.

This means:

- the delay is not fixed for the whole campaign
- the same contact can be retried later with the same message structure, but the delay is still re-evaluated per send attempt
- the configured range is stored per campaign, so different campaigns can run with different pacing

### Examples by campaign size

The values below are operational starting points, not rigid rules. They are meant to help the operator choose a safe configuration before observing real-world behavior.

#### Small campaign

Suggested for:

- up to `100` contacts

Suggested settings:

- minimum delay: `10`
- maximum delay: `25`
- daily limit: `50` to `100`

What to expect:

- the campaign finishes in a short period
- the progress bar changes quickly
- the daily limit is usually not the bottleneck

#### Medium campaign

Suggested for:

- `100` to `1,000` contacts

Suggested settings:

- minimum delay: `15`
- maximum delay: `45`
- daily limit: `150` to `400`

What to expect:

- the campaign becomes a multi-hour operation
- the operator should check the daily counter during the run
- pauses caused by the send window are more likely to matter

#### Large campaign

Suggested for:

- `1,000` to `7,000` contacts

Suggested settings:

- minimum delay: `15`
- maximum delay: `45`
- daily limit: `200` to `500`

What to expect:

- the run should be treated as a controlled queue, not a one-time blast
- the operator should expect pauses across days
- the daily limit is the main control that shapes throughput
- failures become operational events that need review

#### Practical rule of thumb

If you are unsure, start with:

- minimum delay: `15`
- maximum delay: `45`
- daily limit: `250`

Then adjust after observing:

- number of failures
- time spent in the send window
- whether the campaign reaches the daily limit too soon

### Send window

The campaign only sends inside:

- `08:00`
- `20:00`

If the worker wakes up outside that window:

- it does not consume pending contacts
- it does not mark contacts as processing
- it waits until the next allowed window
- it logs `send_window_wait` only once per waiting period

### Daily limit

If `daily_limit` is greater than zero:

- every successful send increments `sent_today`
- once `sent_today >= daily_limit`, the worker pauses the campaign
- the pause reason becomes `daily_limit_reached`

The campaign stays paused until an operator resumes it later.

### Consecutive failures

If the worker sees `5` failures in a row:

- the campaign is paused automatically
- `pause_reason` becomes `consecutive_failures`
- the worker stops the active processing loop for that campaign

### Message composition

The final message sent to a contact is built from:

- a fixed greeting chosen from:
  - `Ola`
  - `Oi`
  - `Bom dia`
- the contact name
- the campaign template body

The greeting is deterministic per `contact_id`. That means the same contact keeps the same greeting on retries and the message stays stable for auditing.

Example:

```text
Oi, Maria!

Temos uma novidade para voce.
Confira os detalhes abaixo.
```

## API Changes

### New endpoint

`POST /campaigns/{id}/settings`

Payload:

- `send_delay_min_seconds`
- `send_delay_max_seconds`
- `daily_limit`

Response:

```json
{
  "ok": true,
  "message": "Configuracoes operacionais salvas.",
  "settings": {
    "send_delay_min_seconds": 15,
    "send_delay_max_seconds": 45,
    "daily_limit": 250
  }
}
```

### Extended stats payload

`GET /campaigns/{id}/stats` now exposes:

- `sent_today`
- `daily_limit`
- `pause_reason`
- `send_delay_min_seconds`
- `send_delay_max_seconds`
- `send_window_start`
- `send_window_end`

That is what the UI uses to show the operational state without guessing.

## UI Behavior

### Critical action narration

The interface does not stay silent while a critical action is in flight.

When the operator triggers actions such as:

- `Iniciar campanha`
- `Enviar teste`
- `Reiniciar campanha`
- `Retomar campanha`

the campaign banner immediately switches to a processing narrative, such as:

- `Processando inicio da campanha...`
- `Processando inicio de teste...`
- `Processando reabertura da campanha...`

This gives the operator direct confirmation that the click was received and the request is still running.

### Overview warning debounce

The results and activity panels are refreshed by polling.

After a critical action, the UI temporarily suppresses the generic warning about temporary overview loading failures. The reason is practical:

- the console should first show the action that is happening now
- transient refresh failures immediately after `start`, `test`, `restart`, or `resume` are usually noise
- showing a warning too early makes the interface look unstable even when the campaign action succeeded

Once the short suppression window expires, the warning can appear again if the overview endpoint continues failing.

### New operational settings block

Inside the campaign page, under the message editor, there is a block called:

- `Configuracoes operacionais`

Fields:

- minimum delay
- maximum delay
- daily limit

The block also explains the fixed send window:

- `Janela ativa: 08h-20h`

### Progress panel

The progress panel now shows the daily counter:

- `Hoje: X / Y envios`

If there is no daily limit:

- `Hoje: X envios (sem limite diario)`

### Pause narratives

The UI now explains automatic pauses in human language:

- `Campanha pausada: limite diario atingido`
- `Campanha pausada: 5 falhas consecutivas detectadas`

This helps the operator understand why the campaign stopped without opening technical logs.

## Operational Behavior With Large Contact Bases

This is the part that matters most for large batches, such as 5,000 contacts.

### How the campaign is processed

The worker does not send all contacts at once. It:

- selects pending contacts in small batches
- marks them as processing
- sends them one by one
- sleeps between sends using the configured range
- pauses when a safety condition is reached

### What happens with 5,000 contacts

With a large list, the campaign behaves like a long-running controlled queue.

Important characteristics:

- the UI remains usable because the data is paginated
- the worker keeps state in the database
- the campaign can be paused and resumed
- completed contacts stay marked as sent
- new contacts added later can reopen the queue
- the progress bar reflects the current cycle and the total campaign state

### Expected operator experience

For a large campaign, the operator should expect:

- a slow and controlled send process
- progress visible in the UI
- daily counter visible in the progress card
- automatic pauses if the configured limits are reached
- no need to keep the browser tab open for the sends to continue

### What the worker will do on a large queue

Given a campaign with thousands of contacts:

1. It will process a subset of pending contacts.
2. It will keep sleeping between sends according to the configured delay range.
3. It will pause if the send window closes.
4. It will pause if the daily limit is reached.
5. It will pause if 5 consecutive failures appear.
6. It will continue from the remaining pending queue when resumed.

### What the operator should not expect

- no bulk fire-and-forget blast
- no instant completion for thousands of records
- no hidden auto-recovery after a daily-limit pause
- no automatic bypass of failed contacts

The design is intentionally conservative so the operator can see what is happening and stop it if needed.

## Operational Flow

### Before starting

1. Connect WhatsApp.
2. Load the campaign contacts.
3. Save the message template.
4. Review `Configuracoes operacionais`.
5. Run the simulation.
6. Send the test.

### During sending

1. Start the campaign.
2. Watch the progress panel.
3. Watch the daily counter.
4. Watch the status narrative.
5. Pause or abort if required.

### After completion

1. Open `Ver resultados`.
2. Review the delivery ratio.
3. Review the final distribution.
4. Open `Atividade operacional` for aggregated milestones and incidents.
5. Export failures if there were problem contacts.

## Activity and Results

### `Ver resultados`

This section is a summary view, not a log feed.

It answers:

- how many were sent
- how many failed
- how many remain pending
- how long the run took
- what the delivery rate was
- what the main failure buckets were

### `Atividade operacional`

This section is a compact observability layer.

It shows:

- consolidated counters
- relevant milestones
- grouped incidents

It is designed to stay readable even when the campaign has thousands of contacts.

## Tests Added

The implementation is covered by:

- `tests/test_operational_controls.py`
- `tests/test_send_engine.py`
- `tests/test_campaign_state.py`
- `tests/test_campaign_actions_ui_payloads.py`
- `tests/e2e/operational.spec.js`

The test coverage includes:

- deterministic greeting composition
- validation of operational settings
- daily counter reset
- daily limit pause behavior
- pause on 5 consecutive failures
- pause while outside the send window
- schema bootstrap against the legacy `app.db`
- UI rendering of the new settings and daily summary
- Playwright validation of the full flow

## Deployment Notes

When you deploy or restart locally:

1. The app starts.
2. The schema bootstrap runs.
3. Existing databases receive the new columns if they are missing.
4. The worker starts with the new operational rules.

No manual migration is required for the current SQLite setup.

## Practical Summary

The latest implementation makes the campaign engine behave like a controlled queue with explicit operator settings.

For small bases, the UI stays simple.
For large bases, the worker keeps the process stable, visible, and resumable.
The system now fails safe instead of continuing blindly.
