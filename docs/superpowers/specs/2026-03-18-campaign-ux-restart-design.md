# Campaign UX Restart Design

## Goal
Melhorar a tela da campanha para evitar ambiguidade operacional: `Dry Run` vira `Simular envio`, resultados ficam legíveis para usuário final e a campanha pode ser reiniciada sem criar outra, com opções `reenviar tudo` e `reenviar só falhas`.

## Decisions
- `Simular envio` nunca envia mensagens; mostra resumo, tempo estimado, mensagem explicativa e prévia legível.
- `Enviar amostra para meu WhatsApp` e `Iniciar` exibem mensagens amigáveis quando não há contatos pendentes.
- Novo fluxo `Reiniciar campanha` na mesma `campaign_id` com modal de escolha:
  - `Reenviar só falhas`
  - `Reenviar tudo`
- Reinício preserva histórico e apenas recria a fila conforme o modo escolhido.
- Ao reiniciar, a campanha volta para `ready`, `finished_at` e `test_completed_at` são limpos.

## Backend
- Adicionar `restart_campaign(db, campaign_id, mode)` em `services/campaign_service.py`.
- Adicionar `POST /campaigns/{campaign_id}/restart` em `main.py`.
- Melhorar payload do `dry_run` com `ok`, `message`, `pending_count`, `summary`, `preview`, `estimated_seconds`, `empty_reason`.

## Frontend
- Renomear botão para `Simular envio`.
- Substituir JSON cru por cards/textos amigáveis no resultado.
- Adicionar modal simples de reinício com seleção de modo e confirmação.
- Desabilitar `Enviar amostra para meu WhatsApp` e `Iniciar` quando não houver pendentes; manter `Simular envio` ativo.

## Tests
- Backend: restart all/failed, dry run amigável e mensagens sem pendentes.
- Frontend: botão renomeado, modal de reinício e chamada correta, resultado amigável.
- E2E: campanha abre, modal aparece, simulação mostra texto amigável.
