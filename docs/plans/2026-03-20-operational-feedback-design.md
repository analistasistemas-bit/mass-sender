# Operational Feedback Design

## Goal

Fazer a faixa principal e os toasts explicarem claramente quando uma acao operacional esta em processamento, quando concluiu com sucesso e quando falhou.

## Scope

- Reusar a faixa principal atual (`status-narrative`) como area de feedback transitivo.
- Reusar os toasts para sucesso e erro finais.
- Cobrir acoes principais e operacionais mais frequentes: simulacao, teste, inicio, pausa, retomada, cancelamento, upload CSV, salvar mensagem, salvar configuracoes, adicionar/remover contatos e limpar base.

## Approach

1. Centralizar copias de feedback por acao no frontend.
2. Trocar temporariamente a narrativa principal para um texto de processamento enquanto a request estiver ativa.
3. Limpar o override quando a request terminar e deixar o estado real da campanha voltar via `renderUi()`.
4. Exibir toast final com a mensagem especifica retornada pela acao, quando disponivel.

## UX Decision

- Sem novos componentes.
- Sem persistir mensagens intermediarias fora do tempo da request.
- O feedback principal fica na faixa de narrativa do topo.
- O resultado final fica no toast.

## Validation

- Regressao E2E cobrindo `Simular campanha` e `Enviar teste` com narrativa de processamento visivel antes da conclusao.
- Validacao manual do fluxo em campanha real para garantir que a faixa principal volta ao estado normal apos a request.
