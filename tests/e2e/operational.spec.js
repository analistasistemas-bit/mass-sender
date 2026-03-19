const { test, expect } = require('@playwright/test');
const path = require('path');

const QR_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3Z8m8AAAAASUVORK5CYII=';

test('fluxo operacional guiado da home ate a conclusao', async ({ page }) => {
  let sessionState = {
    connected: false,
    state: 'qr_ready',
    phone: null,
    hasQr: true,
    lastError: null,
    history: [],
  };

  let statsState = {
    campaign_id: 1,
    status: 'draft',
    sent: 0,
    failed: 0,
    pending: 0,
    valid: 0,
    invalid: 0,
    total: 0,
    test_completed_at: null,
    started_at: null,
    finished_at: null,
    updated_at: '2026-03-18T12:00:00+00:00',
  };
  let overviewState = {
    results: {
      headline: 'Resultados parciais',
      summary: 'Os principais indicadores aparecem aqui quando houver execucao suficiente.',
      processed: 0,
      success_rate: 0,
      failure_rate: 0,
      coverage_rate: 0,
      duration_seconds: 0,
      distribution: {
        sent: 0,
        failed: 0,
        pending: 0,
        invalid: 0,
        valid: 0,
        total: 0,
      },
      top_failures: [],
      started_at: null,
      finished_at: null,
    },
    activity: {
      total_events: 0,
      summary_cards: [
        { key: 'state', label: 'Mudancas de estado', count: 0, tone: 'info' },
        { key: 'success', label: 'Entregas confirmadas', count: 0, tone: 'success' },
        { key: 'retry', label: 'Novas tentativas', count: 0, tone: 'warn' },
        { key: 'failure', label: 'Falhas tecnicas', count: 0, tone: 'error' },
      ],
      milestones: [],
      incidents: [],
    },
  };
  let deleteContactCalled = false;
  let currentContactsPage = 1;
  let currentPerPage = 25;

  await page.route('**/bridge/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, session: sessionState }),
    });
  });

  await page.route('**/bridge/qr', async (route) => {
    sessionState = {
      ...sessionState,
      connected: true,
      state: 'connected',
      phone: '+55 81 99999-9999',
      hasQr: false,
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        qr: {
          ok: true,
          base64: QR_BASE64,
        },
      }),
    });
  });

  await page.route('**/bridge/reset', async (route) => {
    sessionState = {
      connected: false,
      state: 'qr_ready',
      phone: null,
      hasQr: true,
      lastError: null,
      history: [],
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, result: { ok: true, message: 'session restarting' } }),
    });
  });

  await page.route('**/campaigns/*/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(statsState),
    });
  });

  await page.route('**/campaigns/*/overview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(overviewState),
    });
  });

  await page.route('**/campaigns/*/contacts/upload', async (route) => {
    statsState = {
      ...statsState,
      status: 'ready',
      pending: 1,
      valid: 1,
      invalid: 0,
      total: 1,
      updated_at: '2026-03-18T12:01:00+00:00',
    };
    overviewState = {
      ...overviewState,
      results: {
        ...overviewState.results,
        headline: 'Resultados parciais',
        summary: 'Base pronta para a proxima etapa operacional.',
        coverage_rate: 0,
        distribution: { sent: 0, failed: 0, pending: 1, invalid: 0, valid: 1, total: 1 },
      },
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: {
          total: 1,
          valid: 1,
          invalid: 0,
          inserted: 1,
          duplicates_skipped: 0,
        },
      }),
    });
  });

  await page.route('**/campaigns/*/contacts/manual', async (route) => {
    const body = route.request().postData() || '';
    const params = new URLSearchParams(body);
    const phone = (params.get('phone') || '').trim();
    if (phone === '1234') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, message: 'Formato inválido para Brasil (+55)' }),
      });
      return;
    }

    statsState = {
      ...statsState,
      status: 'ready',
      pending: 1,
      valid: 1,
      invalid: 0,
      total: 1,
      updated_at: '2026-03-18T12:00:30+00:00',
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        contact: {
          id: 900,
          name: params.get('name') || 'Cliente Manual',
          phone_raw: phone,
          phone_e164: '+5581999999999',
          email: params.get('email') || '',
          status: 'pending',
        },
      }),
    });
  });

  await page.route(/\/campaigns\/\d+\/contacts(\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    currentContactsPage = Number(url.searchParams.get('page') || '1');
    currentPerPage = Number(url.searchParams.get('per_page') || '25');
    const allItems = Array.from({ length: 26 }, (_, index) => ({
      id: index + 1,
      name: `Cliente ${index + 1}`,
      phone_raw: `819999999${String(index + 1).padStart(2, '0')}`,
      phone_e164: `+55819999999${String(index + 1).padStart(2, '0')}`,
      email: `cliente${index + 1}@example.com`,
      status: 'pending',
      error_message: '',
    }));
    const offset = (currentContactsPage - 1) * currentPerPage;
    const items = allItems.slice(offset, offset + currentPerPage);
    const totalPages = Math.max(1, Math.ceil(allItems.length / currentPerPage));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items,
        pagination: {
          page: currentContactsPage,
          total_pages: totalPages,
          total: allItems.length,
          page_size: currentPerPage,
        },
        status_filter: '',
      }),
    });
  });

  await page.route('**/campaigns/*/contacts/*/delete', async (route) => {
    deleteContactCalled = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, message: 'Contato removido da campanha com sucesso.' }),
    });
  });

  await page.route('**/campaigns/*/dry-run', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        message: 'Esta ação não envia mensagens reais. Existem 1 contatos prontos para envio.',
        pending_count: 1,
        summary: {
          valid: 1,
          invalid: 0,
          total: 1,
        },
        preview: [
          {
            name: 'Cliente E2E',
            phone: '+5581999999999',
            message: 'Oi, Cliente E2E! Mensagem E2E',
          },
        ],
        estimated_seconds: 7,
        empty_reason: null,
      }),
    });
  });

  await page.route('**/campaigns/*/test-run', async (route) => {
    statsState = {
      ...statsState,
      test_completed_at: '2026-03-18T12:03:00+00:00',
      updated_at: '2026-03-18T12:03:00+00:00',
    };
    overviewState = {
      ...overviewState,
      activity: {
        ...overviewState.activity,
        total_events: 1,
        summary_cards: [
          { key: 'state', label: 'Mudancas de estado', count: 1, tone: 'info' },
          { key: 'success', label: 'Entregas confirmadas', count: 0, tone: 'success' },
          { key: 'retry', label: 'Novas tentativas', count: 0, tone: 'warn' },
          { key: 'failure', label: 'Falhas tecnicas', count: 0, tone: 'error' },
        ],
        milestones: [
          { title: 'Campanha iniciada', summary: 'O envio real foi liberado e a campanha entrou em execucao.', time: '2026-03-18T12:03:00+00:00', tone: 'info' },
        ],
        incidents: [],
      },
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        sent: 1,
        failures: 0,
        message: 'Amostra enviada',
        destination_note: 'Mesmo número conectado',
        failure_reasons: {},
        failure_details: [],
        hint: '',
      }),
    });
  });

  await page.route('**/campaigns/*/start', async (route) => {
    statsState = {
      ...statsState,
      status: 'running',
      started_at: '2026-03-18T12:04:00+00:00',
      updated_at: '2026-03-18T12:04:00+00:00',
    };
    overviewState = {
      ...overviewState,
      results: {
        ...overviewState.results,
        headline: 'Campanha em andamento',
        summary: 'A execucao segue ativa.',
        processed: 0,
        distribution: { sent: 0, failed: 0, pending: 1, invalid: 0, valid: 1, total: 1 },
        started_at: '2026-03-18T12:04:00+00:00',
        finished_at: null,
      },
      activity: {
        ...overviewState.activity,
        total_events: 2,
        summary_cards: [
          { key: 'state', label: 'Mudancas de estado', count: 2, tone: 'info' },
          { key: 'success', label: 'Entregas confirmadas', count: 0, tone: 'success' },
          { key: 'retry', label: 'Novas tentativas', count: 0, tone: 'warn' },
          { key: 'failure', label: 'Falhas tecnicas', count: 0, tone: 'error' },
        ],
        milestones: [
          { title: 'Campanha iniciada', summary: 'O envio real foi liberado e a campanha entrou em execucao.', time: '2026-03-18T12:04:00+00:00', tone: 'info' },
        ],
        incidents: [],
      },
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, message: 'Campanha iniciada' }),
    });
  });

  await page.route('**/campaigns/*/pause', async (route) => {
    statsState = {
      ...statsState,
      status: 'paused',
      updated_at: '2026-03-18T12:05:00+00:00',
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, message: 'Campanha pausada' }),
    });
  });

  await page.route('**/campaigns/*/resume', async (route) => {
    statsState = {
      ...statsState,
      status: 'running',
      sent: 1,
      pending: 0,
      updated_at: '2026-03-18T12:06:00+00:00',
    };
    overviewState = {
      results: {
        headline: 'Campanha concluida',
        summary: 'Resultado final sem incidentes relevantes.',
        processed: 1,
        success_rate: 100,
        failure_rate: 0,
        coverage_rate: 100,
        duration_seconds: 120,
        distribution: {
          sent: 1,
          failed: 0,
          pending: 0,
          invalid: 0,
          valid: 1,
          total: 1,
        },
        top_failures: [],
        started_at: '2026-03-18T12:04:00+00:00',
        finished_at: '2026-03-18T12:06:00+00:00',
      },
      activity: {
        total_events: 4,
        summary_cards: [
          { key: 'state', label: 'Mudancas de estado', count: 3, tone: 'info' },
          { key: 'success', label: 'Entregas confirmadas', count: 1, tone: 'success' },
          { key: 'retry', label: 'Novas tentativas', count: 0, tone: 'warn' },
          { key: 'failure', label: 'Falhas tecnicas', count: 0, tone: 'error' },
        ],
        milestones: [
          { title: 'Campanha concluida', summary: 'A campanha terminou e encerrou a fila atual.', time: '2026-03-18T12:06:00+00:00', tone: 'success' },
          { title: 'Campanha iniciada', summary: 'O envio real foi liberado e a campanha entrou em execucao.', time: '2026-03-18T12:04:00+00:00', tone: 'info' },
          { title: 'Lote processado', summary: 'Lote de 1 contatos processado.', time: '2026-03-18T12:05:50+00:00', tone: 'success' },
        ],
        incidents: [
          { title: 'Falha de envio', summary: 'Sistema de envio indisponivel', tone: 'error', count: 4, time: '2026-03-18T12:05:40+00:00', error_class: 'temporary', http_status: 503 },
        ],
      },
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, message: 'Campanha retomada' }),
    });
  });

  await page.route('**/campaigns/*/cancel', async (route) => {
    statsState = {
      ...statsState,
      status: 'cancelled',
      updated_at: '2026-03-18T12:06:30+00:00',
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, message: 'Campanha cancelada' }),
    });
  });

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Mass Sender' })).toBeVisible();
  await page.getByPlaceholder('Senha').fill('admin123');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByRole('heading', { name: 'Operacao de campanhas' })).toBeVisible();
  await expect(page.getByText('Canal WhatsApp')).toBeVisible();
  await expect(page.getByText('Sessao pronta para conectar um numero.')).toBeVisible();
  await page.getByRole('button', { name: 'Gerar QR para conectar' }).click();
  await expect(page.locator('#qr-image')).toHaveAttribute('src', /data:image\/png;base64/);
  await expect(page.getByText('Numero conectado e pronto para envio')).toBeVisible();

  await page.locator('input[name="name"]').fill('Campanha E2E');
  await page.getByRole('button', { name: 'Criar campanha' }).click();

  await expect(page.getByRole('heading', { name: 'Campanha E2E' })).toBeVisible();
  await expect(page.locator('[data-testid="campaign-stepper"]')).toBeVisible();
  await expect(page.locator('[data-testid="status-narrative"]')).toContainText('Configure sua campanha para validar contatos antes do envio.');
  await expect(page.getByRole('button', { name: 'Simular campanha' })).toBeVisible();
  await expect(page.locator('[data-testid="primary-action"]')).toContainText('Simular campanha');
  await expect(page.locator('[data-testid="status-filter-trigger"]')).toHaveText(/Todos/);
  await expect(page.locator('#contacts-meta')).toContainText('Pagina 1 de 2');
  await page.locator('[data-testid="status-filter-trigger"]').click();
  await page.getByRole('option', { name: 'Falhas' }).click();
  await expect(page.locator('[data-testid="status-filter-trigger"]')).toHaveText(/Falhas/);
  await expect(page.locator('#contacts-per-page')).toHaveValue('25');
  await expect(page.locator('#contacts-body tr')).toHaveCount(25);
  await expect(page.locator('#contacts-meta')).toContainText('Total exibido: 25 de 26 registros. Pagina 1 de 2.');
  await page.getByRole('button', { name: 'Proxima pagina' }).click();
  await expect(page.locator('#contacts-meta')).toContainText('Total exibido: 1 de 26 registros. Pagina 2 de 2.');
  await expect(page.locator('#contacts-body')).toContainText('Cliente 26');
  await page.getByRole('button', { name: 'Pagina anterior' }).click();
  await expect(page.locator('#contacts-meta')).toContainText('Total exibido: 25 de 26 registros. Pagina 1 de 2.');

  await page.getByRole('button', { name: 'Adicionar cliente manualmente' }).click();
  await page.locator('#manual-contact-form input[name="name"]').fill('Cliente Manual');
  await page.locator('#manual-contact-form input[name="phone"]').fill('1234');
  await page.getByRole('button', { name: 'Salvar cliente' }).click();
  await expect(page.locator('#manual-contact-feedback')).toContainText('Formato inválido para Brasil (+55)');
  await page.locator('#manual-contact-form input[name="phone"]').fill('+55 81999999999');
  await page.locator('#manual-contact-form input[name="email"]').fill('manual@cliente.com');
  await page.getByRole('button', { name: 'Salvar cliente' }).click();
  await expect(page.getByText('Cliente adicionado manualmente.')).toBeVisible();

  await page.getByRole('button', { name: 'Excluir' }).first().click();
  await expect(page.locator('#confirm-title')).toContainText('Excluir contato da campanha');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Contato removido da campanha.')).toBeVisible();
  expect(deleteContactCalled).toBeTruthy();

  await page.locator('textarea[name="message_template"]').fill('Oi, {{nome}}! Mensagem E2E');
  await page.getByRole('button', { name: 'Salvar mensagem' }).click();

  await page.setInputFiles('input[name="csv_file"]', path.resolve(__dirname, '../fixtures/contatos_e2e.csv'));
  await page.getByRole('button', { name: 'Enviar arquivo CSV' }).click();
  await expect(page.getByText('Upload concluido com sucesso.')).toBeVisible();
  await expect(page.locator('#upload-summary')).toContainText('1 contato pronto para envio');

  await page.getByRole('button', { name: 'Simular campanha' }).click();
  await expect(page.locator('[data-testid="status-narrative"]')).toContainText('Tudo pronto para uma verificacao final.');
  await expect(page.getByText('Tempo estimado')).toBeVisible();
  await expect(page.getByText('7s')).toBeVisible();

  await page.getByRole('button', { name: 'Enviar teste' }).click();
  await expect(page.getByText('Amostra enviada para confirmacao.')).toBeVisible();
  await expect(page.locator('[data-testid="primary-action"]')).toContainText('Iniciar campanha');

  await page.getByRole('button', { name: 'Iniciar campanha' }).click();
  await expect(page.locator('[data-testid="status-narrative"]')).toContainText('Enviando mensagens');
  await expect(page.locator('[data-testid="primary-action"]')).toContainText('Pausar campanha');
  await expect(page.locator('[data-testid="execution-progress-bar"]')).toBeVisible();
  await page.getByRole('button', { name: 'Abortar' }).click();
  await expect(page.locator('#confirm-title')).toContainText('Abortar envio da campanha');
  await expect(page.locator('#confirm-cancel')).toBeFocused();
  await page.locator('#confirm-cancel').click();

  await page.getByRole('button', { name: 'Pausar campanha' }).click();
  await expect(page.locator('[data-testid="status-narrative"]')).toContainText('Campanha pausada');
  await expect(page.locator('[data-testid="primary-action"]')).toContainText('Retomar campanha');

  await page.getByRole('button', { name: 'Retomar campanha' }).click();
  statsState = {
    ...statsState,
    status: 'completed',
    finished_at: '2026-03-18T12:07:00+00:00',
    updated_at: '2026-03-18T12:07:00+00:00',
  };
  await page.reload();

  await expect(page.locator('[data-testid="status-narrative"]')).toContainText('Campanha finalizada com sucesso.');
  await expect(page.locator('[data-testid="primary-action"]')).toContainText('Ver resultados');
  await expect(page.getByRole('button', { name: 'Ver resultados' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Exportar falhas' })).toBeVisible();
  await expect(page.locator('.stepper-item[data-step-key="3"]')).toHaveAttribute('data-step-state', 'done');
  await expect(page.locator('.stepper-item[data-step-key="4"]')).toHaveAttribute('data-step-state', 'done');
  await expect(page.locator('.stepper-item[data-step-key="5"]')).toHaveAttribute('data-step-state', 'done');
  await page.getByRole('button', { name: 'Ver resultados' }).click();
  await expect(page.locator('[data-testid="results-section"]')).toBeFocused();
  await expect(page.locator('#results-headline')).toContainText('Campanha concluida');
  await expect(page.locator('#results-success-rate')).toContainText('100%');
  await expect(page.locator('#results-distribution')).toContainText('Enviados');

  statsState = {
    ...statsState,
    test_completed_at: null,
  };
  await page.getByRole('button', { name: 'Adicionar cliente manualmente' }).click();
  await page.locator('#manual-contact-form input[name="name"]').fill('Novo apos concluida');
  await page.locator('#manual-contact-form input[name="phone"]').fill('+55 81999999998');
  await page.getByRole('button', { name: 'Salvar cliente' }).click();
  await expect(page.getByText('Cliente adicionado manualmente.')).toBeVisible();
  await expect(page.locator('[data-testid="primary-action"]')).toContainText('Iniciar campanha');

  statsState = {
    ...statsState,
    status: 'cancelled',
    finished_at: '2026-03-18T12:08:00+00:00',
    updated_at: '2026-03-18T12:08:00+00:00',
  };
  await page.reload();
  await expect(page.locator('[data-testid="primary-action"]')).toContainText('Reiniciar campanha');
  await expect(page.getByRole('button', { name: 'Reiniciar campanha' })).toHaveCount(1);

  await page.getByRole('button', { name: 'Mostrar atividade tecnica' }).click();
  await expect(page.locator('[data-testid="logs-panel"]')).toContainText('Incidentes agrupados');
  await expect(page.locator('#activity-summary-grid')).toContainText('Entregas confirmadas');
  await expect(page.locator('#activity-incidents')).toContainText('Sistema de envio indisponivel');
  await expect(page.locator('#activity-milestones')).toContainText('Campanha concluida');
  await expect(page.locator('#activity-milestones')).toContainText('Campanha iniciada');
  await expect(page.locator('#activity-milestones')).toContainText('Lote processado');

  await page.setViewportSize({ width: 960, height: 700 });
  await expect(page.locator('[data-testid="contacts-table-wrap"]')).toBeVisible();
  await page.setViewportSize({ width: 430, height: 932 });
  await expect(page.locator('[data-testid="contacts-table-wrap"]')).toBeVisible();
});
