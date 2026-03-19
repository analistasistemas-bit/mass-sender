# Campaign UX Restart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a tela da campanha operacionalmente clara, com simulação amigável e reinício da mesma campanha sem criar outra.

**Architecture:** A solução mantém a arquitetura atual FastAPI + JS server-rendered. O backend passa a expor reinício de campanha e payloads mais amigáveis; o frontend interpreta esses payloads em componentes simples sem JSON cru.

**Tech Stack:** FastAPI, SQLAlchemy, vanilla JS, Jinja, pytest, Playwright.

---

### Task 1: Cobrir backend com testes

**Files:**
- Modify: `tests/test_campaign_state.py`
- Create: `tests/test_campaign_actions_ui_payloads.py`
- Modify: `services/campaign_service.py`

- [ ] Step 1: Escrever teste falhando para `restart_campaign(..., 'all')`.
- [ ] Step 2: Rodar pytest focado e verificar falha.
- [ ] Step 3: Implementar código mínimo em `services/campaign_service.py`.
- [ ] Step 4: Rodar teste e verificar sucesso.
- [ ] Step 5: Repetir para `restart_campaign(..., 'failed')` e `dry_run` amigável sem pendentes.

### Task 2: Expor rota e integrar tela

**Files:**
- Modify: `main.py`
- Modify: `templates/campaign.html`
- Modify: `static/app.js`
- Modify: `static/styles.css`

- [ ] Step 1: Escrever teste/expectativa frontend para novo rótulo e modal.
- [ ] Step 2: Implementar rota `POST /campaigns/{id}/restart`.
- [ ] Step 3: Implementar botão `Simular envio`, modal de reinício e rendering amigável.
- [ ] Step 4: Rodar testes Python e Playwright.

### Task 3: Documentar e validar

**Files:**
- Modify: `docs/OPERATIONS.md`

- [ ] Step 1: Atualizar operações com explicação de `Simular envio` e `Reiniciar campanha`.
- [ ] Step 2: Rodar suíte completa (`pytest`, Playwright).
