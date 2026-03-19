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

Este guia foi escrito para operadores do sistema, não para manutenção técnica.

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
- abrir logs
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

## Reabrir Campanha com Novos Contatos

Se uma campanha já teve envio real e você adicionar novos contatos depois:

- a campanha volta para `Pronta`
- o histórico anterior é preservado
- os contatos já enviados continuam marcados como enviados
- os novos contatos entram na fila pendente
- se a campanha já teve envio real antes, o sistema libera novo início sem exigir um novo teste apenas por causa dessa reabertura

## 11. Pausar a Campanha

Se precisar interromper a operação:

1. Clique em `Pausar campanha`

Resultado esperado:

- o status muda para `Pausada`
- a narrativa informa que nenhum envio acontecerá até retomada
- a ação principal muda para `Retomar campanha`

## 12. Retomar a Campanha

Para continuar:

1. Clique em `Retomar campanha`

Resultado esperado:

- a campanha volta ao fluxo de envio

## 13. Cancelar a Campanha

Se precisar encerrar a operação atual:

1. Clique em `Cancelar campanha`
2. Leia o impacto no modal
3. Clique em `Confirmar` apenas se tiver certeza

Resultado esperado:

- a campanha muda para `Cancelada`
- o sistema interrompe a operação atual
- a ação principal muda para `Reiniciar campanha`

## 14. Reiniciar a Campanha

Use esta opção quando quiser montar uma nova tentativa após falhas ou cancelamento.

1. Clique em `Reiniciar campanha`
2. Confirme no modal

Resultado esperado:

- a fila é recriada
- a campanha volta para `Pronta`
- o fluxo volta para teste e nova execução

## 15. Ler os Logs

Na área `Logs inteligentes`:

1. Clique em `Mostrar logs`

Você verá:

- cartões resumidos por evento
- linguagem mais amigável
- botão `Ver detalhes técnicos` quando necessário

Use logs para:

- entender falhas
- revisar mudanças de estado
- apoiar diagnóstico operacional

## 16. Exportar Falhas

Quando houver falhas e a campanha chegar a um estado apropriado:

1. Clique em `Exportar falhas`

O sistema baixa um CSV com os contatos problemáticos para análise ou nova tratativa.

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
2. Abra os logs
3. Verifique se o WhatsApp continua conectado
4. Tente novamente

## O upload não refletiu na tela

Verifique:

- se o arquivo realmente foi enviado
- se o CSV está em um formato aceito
- se o resumo de válidos e inválidos apareceu

## A campanha terminou com falhas

Faça nesta ordem:

1. Clique em `Ver resultados`
2. Abra `Logs inteligentes`
3. Clique em `Exportar falhas`
4. Se necessário, use `Reiniciar campanha`

## Boas Práticas de Operação

- conecte o WhatsApp antes de abrir uma campanha crítica
- sempre revise a mensagem antes de subir a base
- sempre faça a simulação
- sempre envie uma amostra antes do disparo real
- acompanhe a área de progresso durante o envio
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
11. Exportar falhas se necessário
