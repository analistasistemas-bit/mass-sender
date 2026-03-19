(function () {
  const root = document.querySelector('[data-campaign-id]');
  if (!root) return;

  const campaignId = root.dataset.campaignId;
  let contactsPage = Number(root.dataset.contactsPage || '1');
  let contactsPerPage = Number(root.dataset.contactsPerPage || '25');
  const contactsFilter = (root.dataset.contactsFilter || '').trim();
  const isTestRequired = Number(root.dataset.testRequired || '1') !== 0;

  const statusBadge = document.getElementById('campaign-status-badge');
  const bridgeBadge = document.getElementById('bridge-state-badge');
  const statusNarrative = document.getElementById('status-narrative');
  const lastUpdated = document.getElementById('last-updated');
  const pollingLabel = document.getElementById('polling-label');
  const primaryTitle = document.getElementById('primary-title');
  const primaryDescription = document.getElementById('primary-description');
  const primaryRule = document.getElementById('primary-rule');
  const primaryButton = document.getElementById('primary-action-button');
  const secondaryActions = document.getElementById('secondary-actions');
  const destructiveActions = document.getElementById('destructive-actions');
  const actionInsightText = document.getElementById('action-insight-text');
  const progressCaption = document.getElementById('progress-caption');
  const progressFill = document.getElementById('progress-fill');
  const progressSummary = document.getElementById('progress-summary');
  const sentEl = document.getElementById('sent');
  const failedEl = document.getElementById('failed');
  const pendingEl = document.getElementById('pending');
  const totalEl = document.getElementById('total');
  const validEl = document.getElementById('valid-count');
  const invalidEl = document.getElementById('invalid-count');
  const etaValue = document.getElementById('eta-value');
  const speedValue = document.getElementById('speed-value');
  const resultValue = document.getElementById('result-value');
  const contactsReadyCopy = document.getElementById('contacts-ready-copy');
  const contactsMeta = document.getElementById('contacts-meta');
  const contactsBody = document.getElementById('contacts-body');
  const contactsPerPageSelect = document.getElementById('contacts-per-page');
  const contactsPrevPage = document.getElementById('contacts-prev-page');
  const contactsNextPage = document.getElementById('contacts-next-page');
  const contactsPageIndicator = document.getElementById('contacts-page-indicator');
  const statusFilterInput = document.getElementById('status-filter-input');
  const statusFilterTrigger = document.getElementById('status-filter-trigger');
  const statusFilterLabel = document.getElementById('status-filter-label');
  const statusFilterMenu = document.getElementById('status-filter-menu');
  const statusFilterOptions = Array.from(document.querySelectorAll('.filter-option'));
  const uploadSummary = document.getElementById('upload-summary');
  const resultsSection = document.getElementById('results-section');
  const resultsHeadline = document.getElementById('results-headline');
  const resultsSummary = document.getElementById('results-summary');
  const resultsInsightPill = document.getElementById('results-insight-pill');
  const resultsSuccessRate = document.getElementById('results-success-rate');
  const resultsCoverageRate = document.getElementById('results-coverage-rate');
  const resultsDuration = document.getElementById('results-duration');
  const resultsWindow = document.getElementById('results-window');
  const resultsDistribution = document.getElementById('results-distribution');
  const resultsFailures = document.getElementById('results-failures');
  const activityTotalEvents = document.getElementById('activity-total-events');
  const activitySummaryGrid = document.getElementById('activity-summary-grid');
  const activityMilestones = document.getElementById('activity-milestones');
  const activityIncidents = document.getElementById('activity-incidents');
  const templateForm = document.getElementById('template-form');
  const uploadForm = document.getElementById('upload-form');
  const manualContactToggle = document.getElementById('manual-contact-toggle');
  const manualContactForm = document.getElementById('manual-contact-form');
  const manualContactSubmit = document.getElementById('manual-contact-submit');
  const manualContactCancel = document.getElementById('manual-contact-cancel');
  const manualContactFeedback = document.getElementById('manual-contact-feedback');
  const saveTemplateButton = document.getElementById('save-template-button');
  const uploadSubmitButton = document.getElementById('upload-submit');
  const logsToggle = document.getElementById('logs-toggle');
  const logsPanel = document.getElementById('logs-panel');
  const confirmModal = document.getElementById('confirm-modal');
  const confirmTitle = document.getElementById('confirm-title');
  const confirmMessage = document.getElementById('confirm-message');
  const confirmSubmit = document.getElementById('confirm-submit');
  const confirmCancel = document.getElementById('confirm-cancel');
  const executionProgressBar = document.getElementById('execution-progress-bar');
  const executionProgressTitle = document.getElementById('execution-progress-title');
  const executionProgressCopy = document.getElementById('execution-progress-copy');
  const executionProgressFill = document.getElementById('execution-progress-fill');
  const executionProgressStats = document.getElementById('execution-progress-stats');
  const executionRefreshButton = document.getElementById('execution-refresh-button');
  const executionAbortButton = document.getElementById('execution-abort-button');
  const toastRegion = document.getElementById('toast-region');
  const stepItems = Array.from(document.querySelectorAll('.stepper-item'));

  let confirmHandler = null;
  let bridgeState = null;
  let stats = {
    status: root.dataset.status || 'draft',
    sent: 0,
    failed: 0,
    pending: Number(root.dataset.pending || '0'),
    valid: Number(root.dataset.valid || '0'),
    invalid: Number(root.dataset.invalid || '0'),
    total: Number(root.dataset.total || '0'),
    test_completed_at: root.dataset.testCompletedAt || null,
    started_at: null,
    finished_at: null,
    updated_at: null,
  };
  let currentPrimaryAction = null;
  let activeLoads = new Map();
  let overview = {
    results: null,
    activity: null,
  };
  let overviewFailureReason = null;
  let overviewFailureWarned = false;

  const actionLabels = {
    dryRun: 'Simular campanha',
    testRun: 'Enviar teste',
    start: 'Iniciar campanha',
    pause: 'Pausar campanha',
    resume: 'Retomar campanha',
    cancel: 'Cancelar campanha',
    restart: 'Reiniciar campanha',
    refresh: 'Atualizar agora',
    viewResults: 'Ver resultados',
    showLogs: 'Ver atividade',
    exportFailures: 'Exportar falhas',
  };

  const filterLabels = {
    '': 'Todos',
    pending: 'Prontos para envio',
    processing: 'Em processamento',
    sent: 'Enviados',
    failed: 'Falhas',
    invalid: 'Invalidos',
  };

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function humanStatus(status) {
    const map = {
      draft: 'Rascunho',
      ready: 'Pronta',
      running: 'Em envio',
      paused: 'Pausada',
      completed: 'Concluida',
      cancelled: 'Cancelada',
    };
    return map[status] || status;
  }

  function humanBridgeState(session) {
    if (!session) return { label: 'Verificando WhatsApp', tone: 'muted' };
    if (session.connected) return { label: 'WhatsApp conectado', tone: 'success' };
    if (session.state === 'initialize_failed') return { label: 'WhatsApp com falha', tone: 'error' };
    if (session.hasQr || session.state === 'qr_ready') return { label: 'WhatsApp aguardando QR', tone: 'warn' };
    return { label: 'WhatsApp desconectado', tone: 'muted' };
  }

  function showToast(type, message) {
    const item = document.createElement('div');
    item.className = `toast toast--${type}`;
    item.innerHTML = `<div><p class="font-semibold text-slate-900">${message}</p></div>`;
    toastRegion?.appendChild(item);
    window.setTimeout(() => item.remove(), 3600);
  }

  function setStatusFilterSelection(value) {
    const selectedValue = Object.prototype.hasOwnProperty.call(filterLabels, value) ? value : '';
    if (statusFilterInput) statusFilterInput.value = selectedValue;
    if (statusFilterLabel) statusFilterLabel.textContent = filterLabels[selectedValue];
    statusFilterOptions.forEach((option) => {
      const isSelected = option.dataset.value === selectedValue;
      option.dataset.selected = isSelected ? 'true' : 'false';
      option.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
  }

  function closeStatusFilterMenu() {
    if (!statusFilterMenu || !statusFilterTrigger) return;
    statusFilterMenu.classList.add('hidden');
    statusFilterTrigger.setAttribute('aria-expanded', 'false');
  }

  function openStatusFilterMenu() {
    if (!statusFilterMenu || !statusFilterTrigger) return;
    statusFilterMenu.classList.remove('hidden');
    statusFilterTrigger.setAttribute('aria-expanded', 'true');
  }

  function bindStatusFilter() {
    if (!statusFilterTrigger || !statusFilterMenu || !statusFilterInput) return;

    setStatusFilterSelection((statusFilterInput.value || '').trim());

    statusFilterTrigger.addEventListener('click', () => {
      const isOpen = statusFilterTrigger.getAttribute('aria-expanded') === 'true';
      if (isOpen) closeStatusFilterMenu();
      else openStatusFilterMenu();
    });

    statusFilterOptions.forEach((option) => {
      option.addEventListener('click', () => {
        setStatusFilterSelection(option.dataset.value || '');
        closeStatusFilterMenu();
      });
    });

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (statusFilterMenu.contains(target) || statusFilterTrigger.contains(target)) return;
      closeStatusFilterMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      closeStatusFilterMenu();
    });
  }

  function setStatusBadge(status) {
    statusBadge.dataset.state = status;
    statusBadge.textContent = humanStatus(status);
  }

  function setBridgeBadge(session) {
    const view = humanBridgeState(session);
    bridgeBadge.className = `status-badge status-badge--${view.tone}`;
    bridgeBadge.textContent = view.label;
  }

  function formatRelativeTime(value) {
    if (!value) return 'Atualizacao pendente.';
    const diffSeconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
    if (diffSeconds < 5) return 'Atualizado agora mesmo.';
    if (diffSeconds < 60) return `Atualizado ha ${diffSeconds}s.`;
    const minutes = Math.round(diffSeconds / 60);
    return `Atualizado ha ${minutes} min.`;
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '--';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.round(seconds % 60);
    return remainder ? `${minutes}min ${remainder}s` : `${minutes}min`;
  }

  function formatCompactDate(value) {
    if (!value) return '--';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value));
    } catch (_) {
      return '--';
    }
  }

  function syncContactsUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set('page', String(contactsPage));
    url.searchParams.set('per_page', String(contactsPerPage));
    if (contactsFilter) url.searchParams.set('status', contactsFilter);
    else url.searchParams.delete('status');
    window.history.replaceState({}, '', url);
  }

  function getProgressMetrics(currentStats) {
    const cycle = currentStats.current_cycle || {};
    const cycleSent = Number(cycle.sent || 0);
    const cycleFailed = Number(cycle.failed || 0);
    const cyclePending = Number(cycle.pending || 0);
    const cycleTotal = Number(cycle.total || 0);
    const sent = Number(currentStats.sent || 0);
    const failed = Number(currentStats.failed || 0);
    const pending = Number(currentStats.pending || 0);
    const isReopenedQueue = currentStats.status === 'ready' && pending > 0 && (sent > 0 || failed > 0);
    const totalProcessable = cycleTotal > 0 ? cycleTotal : isReopenedQueue ? pending : Number(currentStats.valid || 0);
    const completed = cycleTotal > 0 ? cycleSent + cycleFailed : isReopenedQueue ? 0 : sent + failed;
    const pct = totalProcessable > 0 ? Math.min(100, Math.round((completed / totalProcessable) * 100)) : 0;
    const etaSeconds = pending > 0 ? pending * 7 : 0;
    const speed = currentStats.status === 'running' ? '~1 contato / 7s' : '--';
    return {
      totalProcessable,
      sent,
      failed,
      pending,
      completed,
      pct,
      etaSeconds,
      speed,
      cycleSent,
      cycleFailed,
      cyclePending,
      cycleTotal,
      isReopenedQueue,
    };
  }

  function deriveFallbackResultsFromStats(currentStats) {
    const sent = Number(currentStats.sent || 0);
    const failed = Number(currentStats.failed || 0);
    const pending = Number(currentStats.pending || 0);
    const invalid = Number(currentStats.invalid || 0);
    const valid = Number(currentStats.valid || 0);
    const total = Number(currentStats.total || 0);
    const processed = sent + failed;
    const successRate = processed > 0 ? Math.round((sent / processed) * 100) : 0;
    const coverageRate = valid > 0 ? Math.round((processed / valid) * 100) : 0;
    const durationSeconds =
      currentStats.started_at && currentStats.finished_at
        ? Math.max(0, Math.round((new Date(currentStats.finished_at).getTime() - new Date(currentStats.started_at).getTime()) / 1000))
        : 0;
    return {
      headline: currentStats.status === 'completed' ? 'Campanha concluida' : 'Resultados parciais',
      summary:
        'Resumo carregado via stats basicos. O detalhamento completo de resultados nao respondeu nesta atualizacao.',
      processed,
      success_rate: successRate,
      failure_rate: Math.max(0, 100 - successRate),
      coverage_rate: coverageRate,
      duration_seconds: durationSeconds,
      distribution: { sent, failed, pending, invalid, valid, total },
      top_failures: [],
      started_at: currentStats.started_at || null,
      finished_at: currentStats.finished_at || null,
      is_fallback: true,
    };
  }

  function deriveFallbackActivityFromStats(currentStats) {
    const sent = Number(currentStats.sent || 0);
    const failed = Number(currentStats.failed || 0);
    const fallbackMessage =
      overviewFailureReason === 'not_found'
        ? 'Atividade detalhada indisponivel no backend atual. Reinicie o servidor para habilitar a visao completa.'
        : 'Nao foi possivel carregar a atividade detalhada neste momento.';
    return {
      total_events: sent + failed,
      summary_cards: [
        { key: 'state', label: 'Mudancas de estado', count: 0, tone: 'info' },
        { key: 'success', label: 'Entregas confirmadas', count: sent, tone: 'success' },
        { key: 'retry', label: 'Novas tentativas', count: 0, tone: 'warn' },
        { key: 'failure', label: 'Falhas tecnicas', count: failed, tone: 'error' },
      ],
      milestones: [
        {
          title: 'Detalhamento indisponivel',
          summary: fallbackMessage,
          tone: 'warn',
          time: currentStats.updated_at || new Date().toISOString(),
        },
      ],
      incidents: [],
      is_fallback: true,
    };
  }

  function deriveCampaignUiState(currentStats, session) {
    if (currentStats.status === 'completed') return 'completed';
    if (currentStats.status === 'cancelled') return 'cancelled';
    if (currentStats.status === 'running') return 'running';
    if (currentStats.status === 'paused') return 'paused';
    if (currentStats.status === 'ready' && isTestRequired && !currentStats.test_completed_at && Number(currentStats.sent || 0) === 0) {
      return 'ready-awaiting-test';
    }
    if (currentStats.status === 'ready' && (currentStats.test_completed_at || Number(currentStats.sent || 0) > 0)) {
      return 'ready-to-start';
    }
    return 'draft';
  }

  function getNarrativeStatus(uiState, currentStats, session) {
    if (!session?.connected && (uiState === 'draft' || uiState === 'ready-awaiting-test')) {
      return 'Conecte o WhatsApp para liberar a validacao final e reduzir risco operacional.';
    }

    if (uiState === 'draft') return 'Configure sua campanha para validar contatos antes do envio.';
    if (uiState === 'ready-awaiting-test') return 'Tudo pronto para uma verificacao final. Envie uma amostra antes do disparo real.';
    if (uiState === 'ready-to-start') {
      if (Number(currentStats.pending || 0) > 0 && Number(currentStats.sent || 0) > 0) {
        return 'Fila reaberta. Os contatos ja enviados permanecem no historico e os pendentes estao prontos para novo disparo.';
      }
      return 'Validacao concluida. Voce pode iniciar a campanha com seguranca.';
    }
    if (uiState === 'running') return 'Enviando mensagens...';
    if (uiState === 'paused') return 'Campanha pausada. Nenhuma mensagem sera enviada ate a retomada.';
    if (uiState === 'completed') {
      return Number(currentStats.failed || 0) > 0
        ? 'Campanha finalizada. Algumas mensagens nao foram entregues.'
        : 'Campanha finalizada com sucesso.';
    }
    if (uiState === 'cancelled') return 'Campanha cancelada. O envio foi interrompido antes da conclusao.';
    return 'Aguardando proximo passo.';
  }

  function getPrimaryAction(uiState) {
    if (uiState === 'draft') return { key: 'dryRun', label: actionLabels.dryRun, description: 'Valide a base antes de qualquer disparo.' };
    if (uiState === 'ready-awaiting-test') {
      return { key: 'testRun', label: actionLabels.testRun, description: 'Use uma amostra para confirmar mensagem, numero e entrega.' };
    }
    if (uiState === 'ready-to-start') {
      return { key: 'start', label: actionLabels.start, description: 'Com a amostra aprovada, o sistema libera o envio real.' };
    }
    if (uiState === 'running') return { key: 'pause', label: actionLabels.pause, description: 'Pause o envio se precisar interromper a operacao.' };
    if (uiState === 'paused') return { key: 'resume', label: actionLabels.resume, description: 'Retome o envio do ponto em que a campanha parou.' };
    if (uiState === 'completed') return { key: 'viewResults', label: actionLabels.viewResults, description: 'Revise o resultado e exporte falhas se necessario.' };
    if (uiState === 'cancelled') return { key: 'restart', label: actionLabels.restart, description: 'Recrie a fila para uma nova execucao segura.' };
    return { key: 'dryRun', label: actionLabels.dryRun, description: 'Valide a base antes de qualquer disparo.' };
  }

  function getSecondaryActionConfigs(uiState, currentStats) {
    const items = [];
    if (uiState === 'ready-awaiting-test') items.push({ key: 'dryRun', label: actionLabels.dryRun });
    if (uiState === 'ready-to-start') items.push({ key: 'dryRun', label: 'Simular novamente' });
    if (uiState === 'running') {
      items.push({ key: 'refresh', label: actionLabels.refresh });
      items.push({ key: 'showLogs', label: actionLabels.showLogs });
    }
    if (uiState === 'paused') {
      items.push({ key: 'viewResults', label: 'Ver progresso' });
      if (Number(currentStats.failed || 0) > 0) items.push({ key: 'exportFailures', label: actionLabels.exportFailures, href: `/campaigns/${campaignId}/failures/export` });
    }
    if (uiState === 'completed' || uiState === 'cancelled') {
      if (Number(currentStats.failed || 0) > 0 || uiState === 'completed') {
        items.push({ key: 'exportFailures', label: actionLabels.exportFailures, href: `/campaigns/${campaignId}/failures/export` });
      }
      items.push({ key: 'showLogs', label: actionLabels.showLogs });
    }
    return items.slice(0, 3);
  }

  function getDestructiveActions(uiState) {
    const items = [];
    if (uiState === 'running' || uiState === 'paused' || uiState === 'ready-awaiting-test' || uiState === 'ready-to-start') {
      items.push({ key: 'cancel', label: actionLabels.cancel });
    }
    if (uiState === 'completed') {
      items.push({ key: 'restart', label: actionLabels.restart });
    }
    return items.slice(0, 1);
  }

  function getStepperState(uiState, currentStats, session) {
    const hasContacts = Number(currentStats.total || 0) > 0;
    const tested =
      Boolean(currentStats.test_completed_at) ||
      Number(currentStats.sent || 0) > 0 ||
      Number(currentStats.failed || 0) > 0 ||
      uiState === 'completed';
    const sending = uiState === 'running' || uiState === 'paused' || uiState === 'completed' || uiState === 'cancelled';
    const done = uiState === 'completed';
    return [
      session?.connected ? 'done' : uiState === 'draft' ? 'active' : 'blocked',
      hasContacts ? 'done' : uiState === 'draft' ? 'active' : 'blocked',
      hasContacts ? 'done' : 'blocked',
      tested ? 'done' : uiState === 'ready-awaiting-test' ? 'active' : hasContacts ? 'blocked' : 'blocked',
      done ? 'done' : sending ? 'active' : 'blocked',
      done ? 'done' : uiState === 'cancelled' ? 'blocked' : 'blocked',
    ];
  }

  function renderStepper(uiState, currentStats, session) {
    const states = getStepperState(uiState, currentStats, session);
    stepItems.forEach((item, index) => {
      const state = states[index] || 'blocked';
      item.dataset.stepState = state;
      const dot = item.querySelector('.stepper-item__dot');
      if (dot) dot.textContent = state === 'done' ? '✓' : String(index + 1);
    });
  }

  function renderProgress(currentStats) {
    const metrics = getProgressMetrics(currentStats);
    sentEl.textContent = String(metrics.sent);
    failedEl.textContent = String(metrics.failed);
    pendingEl.textContent = String(metrics.pending);
    totalEl.textContent = String(currentStats.total || 0);
    validEl.textContent = String(currentStats.valid || 0);
    invalidEl.textContent = String(currentStats.invalid || 0);
    progressCaption.textContent = `${metrics.pct}%`;
    progressFill.style.width = `${metrics.pct}%`;
    etaValue.textContent = formatDuration(metrics.etaSeconds);
    speedValue.textContent = metrics.speed;
    resultValue.textContent =
      currentStats.status === 'completed'
        ? `${metrics.sent} enviados`
        : currentStats.status === 'paused'
          ? 'Pausa em andamento'
          : currentStats.status === 'running'
            ? 'Envio ativo'
            : 'Aguardando';
    contactsReadyCopy.textContent =
      metrics.pending > 0
        ? `${metrics.pending} contato${metrics.pending > 1 ? 's' : ''} pronto${metrics.pending > 1 ? 's' : ''} para envio`
        : currentStats.total > 0
          ? 'Base carregada e sem fila pendente'
          : 'Aguardando importacao';

    if (currentStats.status === 'running') {
      const currentIndex =
        metrics.cycleTotal > 0
          ? Math.min(metrics.cycleSent + metrics.cycleFailed + 1, Math.max(metrics.cycleTotal, 1))
          : Math.min(metrics.completed + 1, Math.max(metrics.totalProcessable, 1));
      const currentTotal = metrics.cycleTotal > 0 ? metrics.cycleTotal : Math.max(metrics.totalProcessable, 1);
      progressSummary.textContent = `Enviando mensagem ${currentIndex} de ${currentTotal}.`;
    } else if (currentStats.status === 'completed') {
      progressSummary.textContent = `Resultado final: ${metrics.sent} enviados e ${metrics.failed} falhas.`;
    } else if (metrics.isReopenedQueue) {
      progressSummary.textContent = `Nova fila pronta: ${metrics.pending} contato${metrics.pending > 1 ? 's' : ''} aguardando envio. Historico preservado: ${metrics.sent} enviado${metrics.sent > 1 ? 's' : ''}.`;
    } else {
      progressSummary.textContent = `${metrics.pct}% concluido (${metrics.completed}/${metrics.totalProcessable || 0}).`;
    }
  }

  function renderExecutionBar(currentStats) {
    if (!executionProgressBar) return;
    const uiState = deriveCampaignUiState(currentStats, bridgeState);
    const visible = uiState === 'running' || uiState === 'paused';
    executionProgressBar.classList.toggle('hidden', !visible);
    if (!visible) return;

    const metrics = getProgressMetrics(currentStats);
    const done = metrics.cycleTotal > 0 ? metrics.cycleSent + metrics.cycleFailed : metrics.completed;
    const total = metrics.cycleTotal > 0 ? metrics.cycleTotal : Math.max(metrics.totalProcessable, 0);
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

    executionProgressTitle.textContent = uiState === 'paused' ? 'Envio pausado' : 'Envio em andamento';
    executionProgressCopy.textContent =
      uiState === 'paused'
        ? 'A fila permanece preservada. Os envios continuam apenas quando voce retomar.'
        : 'Os envios continuam mesmo se voce sair desta pagina. Use Abortar apenas para interromper a campanha.';
    executionProgressFill.style.width = `${pct}%`;
    executionProgressStats.textContent = `${done} de ${total} processados. ${metrics.pending} restante${metrics.pending === 1 ? '' : 's'}.`;
  }

  function renderUploadSummary(currentStats) {
    if (Number(currentStats.total || 0) === 0) {
      uploadSummary.innerHTML = `
        <p class="text-sm font-semibold text-ink">Nenhum CSV enviado ainda.</p>
        <p class="mt-2 text-sm leading-6 text-slate-500">Envie sua base para liberar a simulacao e o teste controlado.</p>
      `;
      return;
    }

    uploadSummary.innerHTML = `
      <p class="text-sm font-semibold text-ink">${currentStats.valid || 0} contato${Number(currentStats.valid || 0) > 1 ? 's' : ''} pronto${Number(currentStats.valid || 0) > 1 ? 's' : ''} para envio</p>
      <p class="mt-2 text-sm leading-6 text-slate-500">Base importada com ${currentStats.valid || 0} validos e ${currentStats.invalid || 0} invalidos.</p>
    `;
  }

  function renderResults(currentStats, payload) {
    const metrics = payload || {};
    const distribution = metrics.distribution || {};
    const processed = Number(metrics.processed || 0);

    resultsHeadline.textContent = metrics.headline || 'Resultados da campanha';
    resultsSummary.textContent =
      metrics.summary || 'Os principais indicadores da campanha aparecem aqui quando houver execucao suficiente.';
    resultsSuccessRate.textContent = `${Math.round(Number(metrics.success_rate || 0))}%`;
    resultsCoverageRate.textContent = `${Math.round(Number(metrics.coverage_rate || 0))}%`;
    resultsDuration.textContent = formatDuration(Number(metrics.duration_seconds || 0));
    resultsWindow.textContent =
      metrics.started_at
        ? `${formatCompactDate(metrics.started_at)}${metrics.finished_at ? ` ate ${formatCompactDate(metrics.finished_at)}` : ' ate agora'}`
        : 'Aguardando execucao';

    if (currentStats.status === 'completed' && Number(currentStats.failed || 0) === 0) {
      resultsInsightPill.textContent = 'Entrega concluida sem falhas';
    } else if (Number(currentStats.failed || 0) > 0) {
      resultsInsightPill.textContent = `${currentStats.failed} falha${Number(currentStats.failed || 0) > 1 ? 's' : ''} precisa${Number(currentStats.failed || 0) > 1 ? 'm' : ''} de revisao`;
    } else if (processed > 0) {
      resultsInsightPill.textContent = `${processed} contato${processed > 1 ? 's' : ''} ja processado${processed > 1 ? 's' : ''}`;
    } else {
      resultsInsightPill.textContent = 'Sem volume processado ainda';
    }

    resultsDistribution.innerHTML = [
      { label: 'Enviados', value: distribution.sent || 0, tone: 'success' },
      { label: 'Falhas', value: distribution.failed || 0, tone: 'error' },
      { label: 'Pendentes', value: distribution.pending || 0, tone: 'warn' },
      { label: 'Invalidos', value: distribution.invalid || 0, tone: 'muted' },
    ]
      .map(
        (item) => `
          <div class="distribution-pill distribution-pill--${item.tone}">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </div>
        `,
      )
      .join('');

    const failures = Array.isArray(metrics.top_failures) ? metrics.top_failures : [];
    if (!failures.length) {
      resultsFailures.innerHTML = `
        <div class="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
          ${metrics.is_fallback ? 'Sem detalhamento de falhas nesta atualizacao.' : 'Nenhuma falha relevante identificada nesta campanha.'}
        </div>
      `;
      return;
    }

    resultsFailures.innerHTML = failures
      .map(
        (item) => `
          <article class="incident-card incident-card--${escapeHtml(item.tone || 'error')}">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-semibold text-ink">${escapeHtml(item.label)}</p>
              <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">${escapeHtml(item.count)} ocorrencia${Number(item.count) > 1 ? 's' : ''}</span>
            </div>
          </article>
        `,
      )
      .join('');
  }

  function renderActivity(payload) {
    const activity = payload || {};
    const summaryCards = Array.isArray(activity.summary_cards) ? activity.summary_cards : [];
    const milestones = Array.isArray(activity.milestones) ? activity.milestones : [];
    const incidents = Array.isArray(activity.incidents) ? activity.incidents : [];

    activityTotalEvents.textContent = `${Number(activity.total_events || 0)} evento${Number(activity.total_events || 0) === 1 ? '' : 's'}`;
    activitySummaryGrid.innerHTML = summaryCards
      .map(
        (card) => `
          <article class="activity-summary-card activity-summary-card--${escapeHtml(card.tone || 'info')}">
            <p class="metric-label">${escapeHtml(card.label)}</p>
            <p class="mt-3 text-2xl font-semibold text-ink">${escapeHtml(card.count || 0)}</p>
          </article>
        `,
      )
      .join('');

    activityMilestones.innerHTML = milestones.length
      ? milestones
          .map(
            (item) => `
              <article class="activity-item activity-item--${escapeHtml(item.tone || 'info')}">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold text-ink">${escapeHtml(item.title)}</p>
                    <p class="mt-1 text-sm leading-6 text-slate-600">${escapeHtml(item.summary)}</p>
                  </div>
                  <time class="activity-item__time">${escapeHtml(formatCompactDate(item.time))}</time>
                </div>
              </article>
            `,
          )
          .join('')
      : `
          <div class="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
            ${activity.is_fallback ? 'Detalhamento operacional indisponivel nesta atualizacao.' : 'Nenhum marco relevante registrado ainda.'}
          </div>
        `;

    activityIncidents.innerHTML = incidents.length
      ? incidents
          .map(
            (item) => `
              <article class="incident-card incident-card--${escapeHtml(item.tone || 'info')}">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold text-ink">${escapeHtml(item.title)}</p>
                    <p class="mt-1 text-sm leading-6 text-slate-600">${escapeHtml(item.summary)}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">${escapeHtml(item.count)}x</p>
                    <p class="mt-1 text-xs text-slate-500">${escapeHtml(formatCompactDate(item.time))}</p>
                  </div>
                </div>
                <details class="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <summary class="cursor-pointer text-sm font-semibold text-slate-700">Ver detalhes tecnicos</summary>
                  <div class="mt-3 grid gap-2 text-sm text-slate-500">
                    <p>Classe de erro: ${escapeHtml(item.error_class || '-')}</p>
                    <p>Status HTTP: ${escapeHtml(item.http_status || '-')}</p>
                  </div>
                </details>
              </article>
            `,
          )
          .join('')
      : `
          <div class="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
            Nenhum incidente agrupado para exibir.
          </div>
        `;
  }

  function setButtonLoading(button, label, active) {
    if (!button) return;
    if (active) {
      if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent || '';
      button.disabled = true;
      button.innerHTML = `<span class="button-spinner" aria-hidden="true"></span><span>${label}</span>`;
      return;
    }
    button.textContent = button.dataset.originalLabel || button.textContent || '';
    button.disabled = false;
  }

  function setManualContactVisibility(visible) {
    if (!manualContactForm) return;
    manualContactForm.classList.toggle('hidden', !visible);
    if (visible) {
      const firstInput = manualContactForm.querySelector('input[name="name"]');
      firstInput?.focus();
    }
  }

  function openConfirm(config) {
    confirmTitle.textContent = config.title;
    confirmMessage.textContent = config.message;
    confirmHandler = config.onConfirm;
    confirmSubmit.textContent = config.submitLabel || 'Confirmar';
    confirmModal?.showModal();
    if (config.focusCancel) {
      window.setTimeout(() => confirmCancel?.focus(), 0);
    }
  }

  async function fetchBridgeState() {
    try {
      const response = await fetch('/bridge/session');
      const data = await response.json();
      if (response.ok && data.ok) {
        bridgeState = data.session;
      }
    } catch (_) {
      bridgeState = bridgeState || null;
    }
  }

  function updatePrimaryButtons(uiState, currentStats) {
    const primary = getPrimaryAction(uiState);
    currentPrimaryAction = primary.key;
    primaryTitle.textContent = primary.label;
    primaryDescription.textContent = primary.description;
    primaryRule.textContent = 'A tela mostra apenas a proxima acao dominante.';
    actionInsightText.textContent = getNarrativeStatus(uiState, currentStats, bridgeState);
    primaryButton.textContent = primary.label;

    secondaryActions.innerHTML = '';
    getSecondaryActionConfigs(uiState, currentStats).forEach((action) => {
      if (action.href) {
        const link = document.createElement('a');
        link.className = 'secondary-button';
        link.href = action.href;
        link.textContent = action.label;
        secondaryActions.appendChild(link);
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary-button';
      button.dataset.actionKey = action.key;
      button.textContent = action.label;
      secondaryActions.appendChild(button);
    });

    destructiveActions.innerHTML = '';
    getDestructiveActions(uiState).forEach((action) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'danger-button';
      button.dataset.actionKey = action.key;
      button.textContent = action.label;
      destructiveActions.appendChild(button);
    });
  }

  function renderContactsTable(payload) {
    const items = payload.items || [];
    const pagination = payload.pagination || {};
    contactsMeta.textContent = `Total exibido: ${items.length} de ${pagination.total || 0} registros. Pagina ${pagination.page || 1} de ${pagination.total_pages || 1}.`;
    contactsPage = Number(pagination.page || 1);
    contactsPerPage = Number(pagination.page_size || contactsPerPage || 25);
    if (contactsPerPageSelect) contactsPerPageSelect.value = String(contactsPerPage);
    if (contactsPageIndicator) {
      contactsPageIndicator.textContent = `Pagina ${pagination.page || 1} de ${pagination.total_pages || 1}`;
    }
    if (contactsPrevPage) contactsPrevPage.disabled = (pagination.page || 1) <= 1;
    if (contactsNextPage) contactsNextPage.disabled = (pagination.page || 1) >= (pagination.total_pages || 1);
    syncContactsUrl();
    const canDeleteContacts = ['draft', 'ready', 'paused'].includes(String(stats.status || '').toLowerCase());

    if (!items.length) {
      contactsBody.innerHTML = '<tr><td colspan="8" class="px-4 py-10 text-center text-sm text-slate-500">Nenhum contato para este filtro.</td></tr>';
      return;
    }

    contactsBody.innerHTML = items
      .map(
        (c) => `
          <tr>
            <td class="px-4 py-3">${escapeHtml(c.id)}</td>
            <td class="px-4 py-3">${escapeHtml(c.name)}</td>
            <td class="px-4 py-3">${escapeHtml(c.phone_raw)}</td>
            <td class="px-4 py-3">${escapeHtml(c.phone_e164 || '-')}</td>
            <td class="px-4 py-3">${escapeHtml(c.email)}</td>
            <td class="px-4 py-3">${escapeHtml(c.status)}</td>
            <td class="px-4 py-3">${escapeHtml(c.error_message || '-')}</td>
            <td class="px-4 py-3">
              ${
                canDeleteContacts
                  ? `<button type="button" class="table-action-button table-action-button--danger" data-contact-action="delete" data-contact-id="${escapeHtml(c.id)}" data-contact-name="${escapeHtml(c.name || 'Contato sem nome')}">Excluir</button>`
                  : '<span class="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Bloqueado durante envio</span>'
              }
            </td>
          </tr>
        `,
      )
      .join('');
  }

  async function deleteContactFromCampaign(contactId, button) {
    setButtonLoading(button, 'Removendo...', true);
    try {
      const response = await fetch(`/campaigns/${campaignId}/contacts/${contactId}/delete`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.message || data.detail || 'Nao foi possivel remover o contato.');
      }
      showToast('success', 'Contato removido da campanha.');
      await pollAll();
    } catch (error) {
      showToast('error', String(error.message || error));
    } finally {
      setButtonLoading(button, 'Removendo...', false);
    }
  }

  function renderUi() {
    const uiState = deriveCampaignUiState(stats, bridgeState);
    setStatusBadge(stats.status);
    setBridgeBadge(bridgeState);
    statusNarrative.textContent = getNarrativeStatus(uiState, stats, bridgeState);
    lastUpdated.textContent = formatRelativeTime(stats.updated_at);
    renderStepper(uiState, stats, bridgeState);
    renderProgress(stats);
    renderExecutionBar(stats);
    renderUploadSummary(stats);
    const safeResults = overview?.results || deriveFallbackResultsFromStats(stats);
    const safeActivity = overview?.activity || deriveFallbackActivityFromStats(stats);
    renderResults(stats, safeResults);
    renderActivity(safeActivity);
    updatePrimaryButtons(uiState, stats);
  }

  async function fetchOverview() {
    try {
      const response = await fetch(`/campaigns/${campaignId}/overview`);
      if (!response.ok) {
        overview = { results: null, activity: null };
        overviewFailureReason = response.status === 404 ? 'not_found' : 'http_error';
        return;
      }
      overview = await response.json();
      overviewFailureReason = null;
    } catch (_) {
      overview = { results: null, activity: null };
      overviewFailureReason = 'network_error';
    }
  }

  async function pollContacts() {
    try {
      const params = new URLSearchParams();
      params.set('page', String(contactsPage));
      params.set('per_page', String(contactsPerPage));
      if (contactsFilter) params.set('status', contactsFilter);
      const response = await fetch(`/campaigns/${campaignId}/contacts?${params.toString()}`);
      if (!response.ok) return;
      const data = await response.json();
      renderContactsTable(data);
    } catch (_) {
      showToast('warn', 'Nao foi possivel atualizar a lista de contatos agora.');
    }
  }

  async function pollAll() {
    pollingLabel.textContent = 'Atualizando dados...';
    await fetchBridgeState();
    try {
      const [statsResponse] = await Promise.all([
        fetch(`/campaigns/${campaignId}/stats`),
        fetchOverview(),
      ]);
      if (!statsResponse.ok) throw new Error('Falha ao consultar stats');
      stats = await statsResponse.json();
      renderUi();
      await pollContacts();
      if (overviewFailureReason && !overviewFailureWarned) {
        const message =
          overviewFailureReason === 'not_found'
            ? 'Visao detalhada indisponivel no backend atual. Reinicie o servidor da aplicacao.'
            : 'Falha temporaria ao carregar resultados e atividade detalhados.';
        showToast('warn', message);
        overviewFailureWarned = true;
      }
      if (!overviewFailureReason) overviewFailureWarned = false;
    } catch (_) {
      showToast('warn', 'Falha temporaria ao atualizar os dados da campanha.');
    } finally {
      pollingLabel.textContent = 'Atualizacao automatica';
    }
  }

  async function runCampaignAction(actionKey, button) {
    const configs = {
      dryRun: { url: `/campaigns/${campaignId}/dry-run`, method: 'POST', loading: 'Simulando...', success: 'Simulacao concluida.' },
      testRun: { url: `/campaigns/${campaignId}/test-run`, method: 'POST', loading: 'Enviando teste...', success: 'Amostra enviada para confirmacao.' },
      start: { url: `/campaigns/${campaignId}/start`, method: 'POST', loading: 'Iniciando...', success: 'Campanha iniciada.' },
      pause: { url: `/campaigns/${campaignId}/pause`, method: 'POST', loading: 'Pausando...', success: 'Campanha pausada.' },
      resume: { url: `/campaigns/${campaignId}/resume`, method: 'POST', loading: 'Retomando...', success: 'Campanha retomada.' },
      cancel: { url: `/campaigns/${campaignId}/cancel`, method: 'POST', loading: 'Cancelando...', success: 'Campanha cancelada.' },
      restart: { url: `/campaigns/${campaignId}/restart`, method: 'POST', body: new URLSearchParams({ mode: 'failed' }), loading: 'Reiniciando...', success: 'Fila recriada para uma nova tentativa.' },
    };

    if (actionKey === 'viewResults') {
      resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => resultsSection?.focus(), 180);
      return;
    }

    if (actionKey === 'showLogs') {
      logsPanel?.classList.remove('hidden');
      logsToggle.textContent = 'Ocultar atividade tecnica';
      logsPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (actionKey === 'refresh') {
      await pollAll();
      return;
    }

    const config = configs[actionKey];
    if (!config) return;

    setButtonLoading(button, config.loading, true);
    try {
      const response = await fetch(config.url, {
        method: config.method,
        body: config.body,
        headers: config.body instanceof URLSearchParams ? { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' } : undefined,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.message || 'Falha na acao');
      }
      showToast('success', config.success);
      await pollAll();
    } catch (error) {
      showToast('error', String(error.message || error));
    } finally {
      setButtonLoading(button, config.loading, false);
    }
  }

  templateForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(templateForm);
    setButtonLoading(saveTemplateButton, 'Salvando...', true);
    try {
      const response = await fetch(templateForm.action, { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Falha ao salvar mensagem');
      showToast('success', 'Mensagem salva.');
      await pollAll();
    } catch (_) {
      showToast('error', 'Nao foi possivel salvar a mensagem agora.');
    } finally {
      setButtonLoading(saveTemplateButton, 'Salvando...', false);
    }
  });

  uploadForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(uploadForm);
    setButtonLoading(uploadSubmitButton, 'Enviando arquivo...', true);
    try {
      const response = await fetch(`/campaigns/${campaignId}/contacts/upload`, { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error('Falha no upload do CSV');
      showToast('success', 'Upload concluido com sucesso.');
      uploadSummary.innerHTML = `
        <p class="text-sm font-semibold text-ink">${data.summary.valid || 0} contato${Number(data.summary.valid || 0) > 1 ? 's' : ''} pronto${Number(data.summary.valid || 0) > 1 ? 's' : ''} para envio</p>
        <p class="mt-2 text-sm leading-6 text-slate-500">Resumo: ${data.summary.valid || 0} validos, ${data.summary.invalid || 0} invalidos e ${data.summary.inserted || 0} inseridos.</p>
      `;
      await pollAll();
    } catch (_) {
      showToast('error', 'Nao foi possivel importar o CSV agora.');
    } finally {
      setButtonLoading(uploadSubmitButton, 'Enviando arquivo...', false);
    }
  });

  manualContactToggle?.addEventListener('click', () => {
    const isHidden = manualContactForm?.classList.contains('hidden');
    setManualContactVisibility(Boolean(isHidden));
  });

  manualContactCancel?.addEventListener('click', () => {
    setManualContactVisibility(false);
  });

  manualContactForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(manualContactForm);
    const payload = new URLSearchParams({
      name: String(formData.get('name') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      email: String(formData.get('email') || '').trim(),
    });

    if (!payload.get('name')) {
      if (manualContactFeedback) {
        manualContactFeedback.textContent = 'Informe o nome do cliente.';
        manualContactFeedback.className = 'text-sm text-red-600';
      }
      return;
    }
    if (!payload.get('phone')) {
      if (manualContactFeedback) {
        manualContactFeedback.textContent = 'Informe o telefone do cliente.';
        manualContactFeedback.className = 'text-sm text-red-600';
      }
      return;
    }

    setButtonLoading(manualContactSubmit, 'Salvando...', true);
    if (manualContactFeedback) {
      manualContactFeedback.textContent = 'Validando telefone e salvando contato...';
      manualContactFeedback.className = 'text-sm text-slate-500';
    }
    try {
      const response = await fetch(`/campaigns/${campaignId}/contacts/manual`, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        if (response.status === 404) {
          throw new Error('Cadastro manual indisponivel no backend atual. Reinicie o servidor da aplicacao e tente novamente.');
        }
        throw new Error(data.message || data.detail || 'Nao foi possivel cadastrar o cliente.');
      }
      manualContactForm.reset();
      if (manualContactFeedback) {
        manualContactFeedback.textContent = 'Cliente adicionado com sucesso.';
        manualContactFeedback.className = 'text-sm text-emerald-700';
      }
      showToast('success', 'Cliente adicionado manualmente.');
      await pollAll();
    } catch (error) {
      if (manualContactFeedback) {
        manualContactFeedback.textContent = String(error.message || 'Falha ao adicionar cliente.');
        manualContactFeedback.className = 'text-sm text-red-600';
      }
      showToast('error', String(error.message || error));
    } finally {
      setButtonLoading(manualContactSubmit, 'Salvando...', false);
    }
  });

  contactsBody?.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-contact-action="delete"]');
    if (!target) return;

    const allowed = ['draft', 'ready', 'paused'].includes(String(stats.status || '').toLowerCase());
    if (!allowed) {
      showToast('warn', 'Exclusao bloqueada durante envio ou apos finalizacao da campanha.');
      return;
    }

    const contactId = target.dataset.contactId;
    const contactName = target.dataset.contactName || 'este contato';
    if (!contactId) return;

    openConfirm({
      title: 'Excluir contato da campanha',
      message: `O contato "${contactName}" sera removido desta campanha imediatamente.`,
      onConfirm: async () => {
        await deleteContactFromCampaign(contactId, target);
        confirmModal?.close();
      },
    });
  });

  primaryButton?.addEventListener('click', async () => {
    if (currentPrimaryAction === 'cancel') {
      openConfirm({
        title: 'Cancelar campanha',
        message: 'A fila atual sera interrompida e a campanha nao continuara ate uma nova decisao.',
        onConfirm: async () => {
          await runCampaignAction('cancel', primaryButton);
          confirmModal?.close();
        },
      });
      return;
    }
    if (currentPrimaryAction === 'restart') {
      openConfirm({
        title: 'Reiniciar campanha',
        message: 'Os contatos com falha ou processamento interrompido voltarao para a fila da campanha.',
        onConfirm: async () => {
          await runCampaignAction('restart', primaryButton);
          confirmModal?.close();
        },
      });
      return;
    }
    await runCampaignAction(currentPrimaryAction, primaryButton);
  });

  secondaryActions?.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action-key]');
    if (!target) return;
    await runCampaignAction(target.dataset.actionKey, target);
  });

  destructiveActions?.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action-key]');
    if (!target) return;
    const actionKey = target.dataset.actionKey;
    if (actionKey === 'cancel') {
      openConfirm({
        title: 'Cancelar campanha',
        message: 'O envio para imediatamente e o operador precisara decidir os proximos passos manualmente.',
        onConfirm: async () => {
          await runCampaignAction('cancel', target);
          confirmModal?.close();
        },
      });
      return;
    }
    if (actionKey === 'restart') {
      openConfirm({
        title: 'Reiniciar campanha',
        message: 'A fila sera recriada para permitir uma nova execucao da campanha.',
        onConfirm: async () => {
          await runCampaignAction('restart', target);
          confirmModal?.close();
        },
      });
    }
  });

  logsToggle?.addEventListener('click', () => {
    const hidden = logsPanel.classList.contains('hidden');
    logsPanel.classList.toggle('hidden');
    logsToggle.textContent = hidden ? 'Ocultar atividade tecnica' : 'Mostrar atividade tecnica';
  });

  executionRefreshButton?.addEventListener('click', async () => {
    await pollAll();
  });

  contactsPerPageSelect?.addEventListener('change', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    contactsPerPage = Number(target.value || '25');
    contactsPage = 1;
    await pollContacts();
  });

  contactsPrevPage?.addEventListener('click', async () => {
    if (contactsPage <= 1) return;
    contactsPage -= 1;
    await pollContacts();
  });

  contactsNextPage?.addEventListener('click', async () => {
    contactsPage += 1;
    await pollContacts();
  });

  executionAbortButton?.addEventListener('click', () => {
    openConfirm({
      title: 'Abortar envio da campanha',
      message: 'Os disparos em andamento serao interrompidos. Confirme apenas se voce realmente quiser parar a operacao.',
      submitLabel: 'Abortar agora',
      focusCancel: true,
      onConfirm: async () => {
        await runCampaignAction('cancel', executionAbortButton);
        confirmModal?.close();
      },
    });
  });

  confirmSubmit?.addEventListener('click', async () => {
    if (confirmHandler) await confirmHandler();
  });

  confirmCancel?.addEventListener('click', () => {
    confirmModal?.close();
  });

  renderUi();
  bindStatusFilter();
  pollAll();
  window.setInterval(pollAll, 5000);
})();
