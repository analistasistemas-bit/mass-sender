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
  let deleteContactCalled = false;

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

  await page.route('**/campaigns/*/contacts?page=1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 1,
            name: 'Cliente E2E',
            phone_raw: '81999999999',
            phone_e164: '+5581999999999',
            email: 'cliente@example.com',
            status: statsState.pending > 0 ? 'pending' : statsState.sent > 0 ? 'sent' : 'failed',
            error_message: '',
          },
        ],
        pagination: {
          page: 1,
          total_pages: 1,
          total: 1,
          page_size: 100,
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
  await page.locator('[data-testid="status-filter-trigger"]').click();
  await page.getByRole('option', { name: 'Falhas' }).click();
  await expect(page.locator('[data-testid="status-filter-trigger"]')).toHaveText(/Falhas/);

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

  await page.getByRole('button', { name: 'Mostrar logs' }).click();
  await expect(page.locator('[data-testid="logs-panel"]')).toContainText('Historico recente');

  await page.setViewportSize({ width: 960, height: 700 });
  await expect(page.locator('[data-testid="contacts-table-wrap"]')).toBeVisible();
  await page.setViewportSize({ width: 430, height: 932 });
  await expect(page.locator('[data-testid="contacts-table-wrap"]')).toBeVisible();
});
