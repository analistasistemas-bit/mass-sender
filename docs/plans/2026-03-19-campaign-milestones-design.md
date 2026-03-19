# Campaign Milestones Design

## Goal

Redefinir a secao `Marcos recentes` para exibir apenas eventos de controle e marcos agregados da campanha, sem listar eventos por contato.

## Scope

- Mostrar apenas marcos de sistema/campanha.
- Limitar a exibicao a um conjunto curto e legivel.
- Incluir patamares agregados de processamento.
- Incluir evento de pico de falhas somente quando relevante.

## Decisions

### Marcos permitidos

- campanha iniciada
- campanha pausada
- campanha retomada
- campanha cancelada
- campanha concluida
- lote processado em patamares (`500`, `1000`, `2000`, ...)
- pico de falhas detectado

### Regras de exibicao

- maximo de `6` marcos visiveis
- ordem cronologica reversa
- nao repetir eventos identicos consecutivos
- nao exibir eventos por contato
- nao usar feed de logs brutos

### Derivacao

- eventos de estado continuam vindo de `campaign_state_change`
- marcos de lote sao derivados dos contadores da campanha
- pico de falhas e derivado de total de falhas acumuladas, usando limiar simples para primeira versao

## UX

- a secao deve parecer uma trilha curta de controle operacional
- cada item precisa ter: titulo, resumo curto e horario
- quando nao houver marcos relevantes, mostrar estado vazio explicito

## Testing

- teste de backend para garantir que `build_activity_payload()` gera marcos agregados sem inflar volume
- teste E2E para confirmar que a UI renderiza marcos de campanha, nao eventos por contato
