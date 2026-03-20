# Guia de Uso do Aplicativo

## Objetivo

Este documento explica, passo a passo, como usar o aplicativo para:

- conectar o WhatsApp
- criar uma campanha
- importar contatos por CSV
- validar a base
- enviar uma amostra
- iniciar o disparo real
- acompanhar o progresso
- pausar, retomar, cancelar e reiniciar campanhas
- revisar resultados e exportar falhas
- consultar atividade operacional resumida

Este guia foi escrito para operadores do sistema, não para manutenção técnica.

Se você quiser a explicação detalhada da ultima implementação de controle operacional, inclusive comportamento com grandes bases, veja:

- [OPERATIONAL_CONTROLS.md](/Users/mac/Desktop/IA/mass-sender/docs/OPERATIONAL_CONTROLS.md)

## Antes de Começar

Você precisa ter o sistema já ligado:

- `wa-bridge` rodando
- backend FastAPI rodando
- número do WhatsApp disponível para conexão

Se ainda não subiu os serviços, use primeiro o guia técnico:

- [OPERATIONS.md](/Users/mac/Desktop/IA/mass-sender/docs/OPERATIONS.md)

## Acesso

1. Abra o navegador em `http://127.0.0.1:8000/login`
2. Informe a senha administrativa
3. Clique em `Entrar`

Você verá a tela inicial do console operacional.

## Visão Geral da Interface

A interface tem duas áreas principais:

1. Home operacional
Use para:
- verificar o estado do WhatsApp
- gerar QR
- trocar número
- criar uma nova campanha
- abrir campanhas existentes

2. Tela da campanha
Use para:
- escrever a mensagem
- enviar o CSV
- validar a base
- mandar teste
- iniciar o envio real
- acompanhar o progresso
- abrir a leitura de resultados
- consultar a atividade operacional
- exportar falhas

## Passo a Passo Completo

## 1. Conectar o WhatsApp

Na home:

1. Localize o bloco `Canal WhatsApp`
2. Verifique a narrativa do sistema

Estados comuns:

- `Conectado`
O número está pronto para uso

- `Aguardando QR`
O sistema está pronto para uma nova conexão

- `Erro`
O bridge ou a sessão não puderam ser consultados

Se o número ainda não estiver conectado:

1. Clique em `Gerar QR para conectar`
2. Escaneie o QR no WhatsApp do celular
3. Aguarde a atualização automática do painel

Quando tudo estiver correto, a home mostrará algo como:

- `Número conectado e pronto para envio`

## 2. Criar uma Nova Campanha

Na home:

1. Preencha `Nome da campanha`
2. Clique em `Criar campanha`

Você será levado automaticamente para a tela operacional da campanha.

## 3. Entender a Tela da Campanha

Na parte superior da tela existem três elementos centrais:

1. Barra de status
Mostra:
- nome da campanha
- status da campanha
- estado do WhatsApp
- narrativa humana do que está acontecendo
- atualização automática

Essa narrativa muda imediatamente quando você dispara ações críticas. Por exemplo:

- `Processando reabertura da campanha...`
- `Processando inicio de teste...`
- `Processando inicio da campanha...`

2. Stepper
Mostra o fluxo:
- Conectar WhatsApp
- Upload CSV
- Validar
- Testar
- Enviar
- Concluído

3. Ação principal
Mostra apenas o próximo passo dominante para o estado atual.

Regra prática:

- se você estiver em dúvida, use primeiro o botão principal
- toda ação crítica mostra uma narrativa de processamento enquanto a requisição está em andamento
- exemplos: `Processando reabertura da campanha...`, `Processando inicio de teste...`, `Processando inicio da campanha...`
- isso evita a sensação de clique sem resposta e deixa claro o que o sistema está fazendo

## 4. Escrever ou Ajustar a Mensagem

Na área `Mensagem e validação`:

1. Edite o texto da campanha
2. Use `{{nome}}` para personalizar a mensagem com o nome do contato
3. Clique em `Salvar mensagem`

Exemplo:

```text
Oi, {{nome}}! Estamos entrando em contato para confirmar seu convite.
```

Se o contato não tiver nome, o sistema usa um fallback equivalente a `cliente`.

Durante o envio real, o sistema adiciona automaticamente uma saudação no início da mensagem:

- `Ola`
- `Oi`
- `Bom dia`

O restante do template permanece igual. Exemplo:

```text
Oi, Maria!

Temos uma novidade para voce.
```

Essa saudação é escolhida automaticamente pelo sistema e permanece consistente para o mesmo contato, inclusive em nova tentativa.

## 4.1 Configuracoes Operacionais

Ainda na área `Mensagem e validação`, existe o bloco `Configuracoes operacionais`.

Nele você pode definir:

- `Atraso minimo (segundos)`
- `Atraso maximo (segundos)`
- `Maximo de envios por dia`

Regras:

- o sistema sorteia um atraso entre o minimo e o maximo antes de cada envio
- use `0` em `Maximo de envios por dia` para deixar sem limite diario
- a janela operacional fixa do sistema é `08h-20h`

Exemplo de configuração conservadora:

- minimo: `15`
- maximo: `45`
- maximo por dia: `250`

Depois de ajustar:

1. Clique em `Salvar configuracoes`
2. Aguarde o toast `Configuracoes operacionais salvas.`

## 5. Preparar o CSV

Formato padrão aceito:

```csv
nome,telefone,email
Maria,11999998888,maria@email.com
Joao,21999997777,joao@email.com
```

Formato legado também aceito:

```csv
,"NOME_CLIENTE","TELEFONE","E_MAIL"
1,"MARIA","5511999998888","maria@email.com"
```

### Regras práticas do CSV

- inclua cabeçalho
- mantenha `telefone` com DDD
- o e-mail pode ficar vazio
- não coloque colunas fora dos formatos aceitos

## 6. Enviar o CSV

Na área `Mensagem e validação`:

1. Clique em `Arquivo CSV`
2. Escolha o arquivo
3. Clique em `Enviar arquivo CSV`

Depois do upload, a tela atualiza:

- resumo de válidos e inválidos
- contagem de pendentes
- tabela de contatos
- stepper

Na tabela de contatos:

- a paginação padrão mostra `25` contatos por vez
- você pode trocar para `10`, `25` ou `50` por página
- use `Pagina anterior` e `Proxima pagina` para navegar
- o filtro de status continua valendo junto com a paginação

Se o upload der certo, você verá um toast como:

- `Upload concluído com sucesso.`

## 7. Validar a Campanha

Quando houver contatos carregados, o sistema libera:

- `Simular campanha`

Clique em `Simular campanha` para:

- confirmar quantos contatos estão aptos
- verificar o tempo estimado
- validar a lógica antes do envio real

Importante:

- a simulação não envia mensagens reais

## Cadastro Manual de Cliente

Além do CSV, você pode cadastrar um contato individualmente dentro da campanha.

Na área `Mensagem e validação`:

1. Clique em `Adicionar cliente manualmente` (ao lado de `Enviar arquivo CSV`)
2. Preencha:
- `Nome` (obrigatório)
- `Telefone` (obrigatório)
- `E-mail` (opcional)
3. Clique em `Salvar cliente`

Regra de telefone:

- use formato brasileiro com `+55`
- exemplo: `+55 81999999999`

Se o telefone estiver fora do formato válido, o sistema bloqueia o cadastro e mostra erro.

## 8. Enviar Teste

Quando a campanha estiver pronta, a ação principal passa a ser:

- `Enviar teste`

Use este passo para confirmar:

- mensagem final
- conexão do número
- comportamento do envio

Depois do teste bem-sucedido:

- o CTA principal muda para `Iniciar campanha`

Se o teste falhar:

- a tela mostra feedback imediato
- você pode corrigir o problema e tentar novamente

## 9. Iniciar a Campanha

Quando o sistema indicar que a validação foi concluída:

1. Clique em `Iniciar campanha`

O status muda para `Em envio` e a tela passa a destacar:

- narrativa do envio
- progresso
- ação principal `Pausar campanha`
- resumo do dia com a linha `Hoje: X / Y envios`

## 10. Acompanhar o Progresso

Na área `Progresso`, acompanhe:

- enviados
- falhas
- pendentes
- total
- tempo estimado
- resultado atual

Durante o envio, a narrativa pode mostrar algo como:

- `Enviando mensagens...`

O sistema também passa a respeitar automaticamente:

- janela de envio entre `08h` e `20h`
- limite diario configurado para a campanha
- pausa automatica se houver `5` falhas consecutivas

Quando a campanha estiver em envio ativo, uma barra fixa de execução aparece na tela.

Essa barra mostra:

- progresso da fila atual
- quantidade processada
- quantos contatos ainda faltam
- botão `Atualizar agora`
- botão `Abortar`

Importante:

- o envio continua mesmo se você sair da página
- o envio só para se você confirmar `Abortar`
- ao clicar em `Abortar`, o sistema pede uma segunda confirmação
- se a tela mostrar um aviso temporário de atualização de resultados logo após iniciar ou reabrir a campanha, aguarde a próxima atualização automática; o console prioriza primeiro o estado da ação crítica que você acabou de disparar

## Remover Contato Importado

Na tabela `Contatos importados`, cada linha possui o botão `Excluir` quando a campanha estiver em estado seguro:

- `draft`
- `ready`
- `paused`

Como remover:

1. Clique em `Excluir` no contato desejado
2. Confirme no modal de segurança
3. Aguarde o toast de sucesso e a atualização da tabela

Regras:

- durante `running` a exclusão fica bloqueada
- em campanhas `completed` ou `cancelled` a exclusão também não é permitida

## Limpar Base Importada

Quando precisar substituir toda a base de CSV de uma campanha, use o botão `Limpar base importada` no topo direito do card `Contatos importados`.

Como funciona:

1. Clique em `Limpar base importada`
2. Confirme no modal de segurança
3. Aguarde a atualização da tabela e dos contadores

O que a ação faz:

- remove todos os contatos que vieram de importações CSV anteriores
- preserva os contatos adicionados manualmente
- atualiza resumo, paginação, progresso e fila da campanha

Regras:

- a limpeza em massa só fica disponível em `draft`, `ready` e `paused`
- durante `running`, `completed` e `cancelled` a ação fica bloqueada
- se não houver contatos de CSV para limpar, o sistema informa isso sem apagar contatos manuais

## Reabrir Campanha com Novos Contatos

Se uma campanha já teve envio real e você adicionar novos contatos depois:

- a campanha volta para `Pronta`
- o histórico anterior é preservado
- os contatos já enviados continuam marcados como enviados
- os novos contatos entram na fila pendente
- se a campanha já teve envio real antes, o sistema libera novo início sem exigir um novo teste apenas por causa dessa reabertura

## Excluir Campanha

Você pode excluir uma campanha de duas formas:

- pela home, no card da campanha
- pela própria tela da campanha, no topo

Como funciona:

1. Abra a campanha que deseja remover
2. Clique em `Excluir campanha`
3. Revise a confirmação crítica
4. Clique em `Confirmar`

O que acontece:

- a campanha é removida permanentemente
- os contatos vinculados à campanha são removidos junto
- o histórico operacional dessa campanha também é removido
- após o sucesso, o sistema redireciona você para a home

Regra de segurança:

- campanhas em `running` não podem ser excluídas
- para excluir uma campanha em envio ativo, primeiro pause ou cancele o envio

## 12. Pausar a Campanha

Se precisar interromper a operação:

1. Clique em `Pausar campanha`

Resultado esperado:

- o status muda para `Pausada`
- a narrativa informa que nenhum envio acontecerá até retomada
- a ação principal muda para `Retomar campanha`

Existem dois tipos de pausa:

- `Pausa manual`
Quando o operador clicou em `Pausar campanha`

- `Pausa automatica`
Quando o sistema precisou interromper por proteção operacional

## 13. Retomar a Campanha

Para continuar:

1. Clique em `Retomar campanha`

Resultado esperado:

- a campanha volta ao fluxo de envio

Se a pausa tiver acontecido por `limite diario atingido`, a retomada deve ser feita manualmente no dia seguinte.

Se a pausa tiver acontecido por `5 falhas consecutivas`, revise a situação antes de retomar.

## 13.1 Pausas Automáticas

O sistema pode pausar a campanha sem ação do operador em dois casos:

1. `Limite diario atingido`
O envio para automaticamente quando a campanha alcança o máximo de envios configurado para o dia.

2. `5 falhas consecutivas`
Se cinco envios seguidos falharem, a campanha entra em pausa para evitar continuidade cega da operação.

Como isso aparece na tela:

- `Campanha pausada: limite diario atingido`
- `Campanha pausada: 5 falhas consecutivas detectadas`

Essas mensagens aparecem na narrativa principal da campanha.

## 14. Cancelar a Campanha

Se precisar encerrar a operação atual:

1. Clique em `Cancelar campanha`
2. Leia o impacto no modal
3. Clique em `Confirmar` apenas se tiver certeza

Resultado esperado:

- a campanha muda para `Cancelada`
- o sistema interrompe a operação atual
- a ação principal muda para `Reiniciar campanha`

## 15. Reiniciar a Campanha

Use esta opção quando quiser montar uma nova tentativa após falhas ou cancelamento.

1. Clique em `Reiniciar campanha`
2. Confirme no modal

Resultado esperado:

- a fila é recriada
- a campanha volta para `Pronta`
- o fluxo volta para teste e nova execução

## 16. Ler a Atividade Operacional

Na área `Atividade operacional`:

1. Clique em `Mostrar atividade tecnica`

Você verá:

- cards de resumo com contagem consolidada
- marcos recentes do sistema e da campanha
- incidentes agrupados por tipo
- botão `Ver detalhes técnicos` quando necessário

Use essa área para:

- entender falhas
- revisar mudanças de estado
- apoiar diagnóstico operacional
- evitar abrir centenas de cards repetidos em campanhas grandes

Os `Marcos recentes` mostram apenas sinais de controle da campanha, como:

- campanha iniciada
- campanha pausada
- campanha retomada
- campanha concluída
- pico de falhas
- lote processado em patamares relevantes

Agora a atividade operacional também pode registrar eventos como:

- espera pela janela operacional
- pausa automática por limite diario
- pausa automática por falhas consecutivas

## 17. Exportar Falhas

Quando houver falhas e a campanha chegar a um estado apropriado:

1. Clique em `Exportar falhas`

O sistema baixa um CSV com os contatos problemáticos para análise ou nova tratativa.

## 18. Ver Resultados

Quando a campanha estiver concluída, a ação principal passa a ser `Ver resultados`.

Use essa seção para revisar:

- taxa de entrega
- cobertura processada
- duração da execução
- janela de início e fim
- distribuição final de enviados, falhas, pendentes e inválidos
- principais tipos de falha que merecem revisão

Importante:

- essa seção fica na própria página da campanha
- ela foi criada para reunir o que importa no fechamento da operação
- ela não repete a tabela de contatos nem os eventos técnicos brutos
- ela funciona melhor como leitura final, não como histórico detalhado

## Como Interpretar os Status da Campanha

- `Rascunho`
A campanha ainda está sendo preparada

- `Pronta`
A base foi carregada e a campanha está pronta para teste ou envio

- `Em envio`
O disparo real está acontecendo

- `Pausada`
O envio foi interrompido temporariamente

- `Cancelada`
O fluxo foi encerrado antes da conclusão

- `Concluída`
O envio terminou

## Como Interpretar os Status dos Contatos

- `pending`
Contato pronto para envio

- `processing`
Contato em processamento

- `sent`
Mensagem enviada

- `failed`
Tentativa falhou

- `invalid`
Contato inválido ou fora do padrão esperado

## Situações Comuns

## O WhatsApp não conecta

Verifique:

- se o `wa-bridge` está rodando
- se o QR foi gerado
- se o celular concluiu a leitura

Se necessário:

- use `Trocar número`
- gere um novo QR

## O teste falhou

Faça nesta ordem:

1. Leia o toast e a narrativa
2. Abra a atividade operacional
3. Verifique se o WhatsApp continua conectado
4. Tente novamente

## O upload não refletiu na tela

Verifique:

- se o arquivo realmente foi enviado
- se o CSV está em um formato aceito
- se o resumo de válidos e inválidos apareceu

## A campanha foi iniciada, mas a leitura de resultados demorou a atualizar

Isso pode acontecer logo após ações como:

- `Iniciar campanha`
- `Enviar teste`
- `Reiniciar campanha`
- `Retomar campanha`

Nesses casos:

1. Aguarde a atualização automática do console
2. Confira a narrativa principal, que deve mostrar o processamento da ação
3. Se necessário, abra `Atividade operacional` depois da atualização

O sistema usa essa prioridade para evitar avisos falsos enquanto a ação principal ainda está sendo confirmada.

## A campanha terminou com falhas

Faça nesta ordem:

1. Clique em `Ver resultados`
2. Abra `Atividade operacional`
3. Clique em `Exportar falhas`
4. Se necessário, use `Reiniciar campanha`

## Boas Práticas de Operação

- conecte o WhatsApp antes de abrir uma campanha crítica
- sempre revise a mensagem antes de subir a base
- revise as `Configuracoes operacionais` antes de iniciar o envio
- sempre faça a simulação
- sempre envie uma amostra antes do disparo real
- acompanhe a área de progresso durante o envio
- acompanhe a linha `Hoje: X / Y envios` para não perder o controle do limite do dia
- exporte falhas ao final

## Resumo Rápido

Fluxo recomendado:

1. Login
2. Conectar WhatsApp
3. Criar campanha
4. Escrever mensagem
5. Enviar CSV
6. Simular campanha
7. Enviar teste
8. Iniciar campanha
9. Acompanhar progresso
10. Ver resultados
11. Consultar atividade operacional se precisar de diagnostico
12. Exportar falhas se necessário
