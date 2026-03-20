# Operational Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir feedback operacional temporario na faixa principal durante cada acao relevante e usar toasts para o resultado final.

**Architecture:** O frontend passa a usar um override estruturado para a narrativa principal durante requests em andamento. Cada acao define sua copia de processamento e reaproveita a mensagem retornada pelo backend para o toast final.

**Tech Stack:** FastAPI, Jinja templates, `static/app.js`, Playwright E2E

---

### Task 1: Cobrir o comportamento esperado no E2E

**Files:**
- Modify: `tests/e2e/operational.spec.js`

- [ ] **Step 1: Write the failing test**

Adicionar assercoes para verificar:
- `Simular campanha` troca a narrativa para o estado de processamento antes de concluir
- `Enviar teste` troca a narrativa para o estado de processamento antes de concluir

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- --grep "fluxo operacional guiado da home ate a conclusao"`
Expected: FAIL porque a narrativa ainda nao mostra processamento de forma consistente

- [ ] **Step 3: Write minimal implementation**

Implementar override estruturado no frontend para refletir o processamento na faixa principal.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:e2e -- --grep "fluxo operacional guiado da home ate a conclusao"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/operational.spec.js static/app.js docs/plans/2026-03-20-operational-feedback-design.md docs/superpowers/plans/2026-03-20-operational-feedback.md
git commit -m "feat: add operational feedback during campaign actions"
```

### Task 2: Unificar o feedback operacional no frontend

**Files:**
- Modify: `static/app.js`

- [ ] **Step 1: Write the failing test**

Usar o E2E acima como teste de regressao.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- --grep "fluxo operacional guiado da home ate a conclusao"`
Expected: FAIL nas novas assercoes de narrativa

- [ ] **Step 3: Write minimal implementation**

Adicionar:
- override estruturado para narrativa principal
- mapa de copias de processamento por acao
- uso da mensagem retornada pela API no toast de sucesso quando existir
- aplicacao do mesmo padrao a formularios operacionais principais

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:e2e -- --grep "fluxo operacional guiado da home ate a conclusao"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add static/app.js tests/e2e/operational.spec.js
git commit -m "feat: surface campaign action progress in primary narrative"
```
