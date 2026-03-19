# Prompt Final

## Papel

Aja como um engenheiro de software sênior especialista em MVPs rápidos, automação backend com Python, sistemas resilientes de mensageria e entrega de software sob prazo extremo.

Você deve agir com mentalidade de execução, simplicidade, robustez mínima e foco absoluto em resultado. Pense passo a passo antes de implementar. Priorize o que coloca o sistema de pé de forma confiável em até 24 horas. Use linguagem objetiva, decisões pragmáticas e arquitetura simples. Estruture o trabalho com clareza e siga exatamente os requisitos.

---

## Contexto do Projeto

Sua tarefa é construir um sistema simples, funcional e confiável para envio de mensagens personalizadas via WhatsApp a partir de um arquivo CSV.

O sistema será usado para comunicar uma lista grande de clientes sobre um evento da empresa.

### Restrições e contexto operacional

- Prazo máximo: 24 horas
- MVP real, não produto sofisticado
- Sem custo de uso
- Uso de número já existente
- Integração via Evolution API
- Execução local (Mac) primeiro
- Possibilidade de VPS depois
- CSV com:
  - nome
  - telefone
  - email

---

## Objetivo Principal

Construir uma aplicação com:

- Upload de CSV
- Validação de contatos
- Criação de campanhas
- Template com {{nome}}
- Modo teste
- Envio em fila
- Pausa / retomada / cancelamento
- Monitoramento simples
- Persistência SQLite
- Exportação de falhas

---

## Direção Obrigatória

### Prioridades

1. Funcionamento real
2. Entrega rápida
3. Simplicidade
4. Confiabilidade mínima

### Evitar

- React / Vue
- SSE / WebSockets
- Redis / Celery
- Frontend complexo
- Firulas visuais

---

## Stack

- Python
- FastAPI
- SQLite
- SQLAlchemy
- HTML + JS simples
- HTTPX ou Requests

---

## Funcionalidades

### 1. Campanhas

Status:
- draft
- ready
- running
- paused
- cancelled
- completed

---

### 2. Contatos

Campos:

- nome
- telefone original
- telefone normalizado
- email
- status
- erro
- tentativas
- timestamps

Status:

- pending
- processing
- sent
- failed
- invalid

---

### 3. CSV

- Validar UTF-8
- Validar colunas
- Normalizar telefone
- Ignorar inválidos
- Mostrar resumo

---

### 4. Dry Run

Mostrar:

- total válido
- inválidos
- preview de mensagens
- estimativa de duração

---

### 5. Template

Suporte a:

{{nome}}

Fallback: "cliente"

---

### 6. Enviar amostra para meu WhatsApp

- Enviar para poucos contatos
- Preview da mensagem
- Mostrar resultado

---

### 7. Motor de Envio

- Sequencial
- Persistente
- Baseado no banco
- Sem depender de memória

---

### 8. Idempotência

- Nunca enviar duplicado
- Controlar via banco
- Lock de campanha

---

### 9. Retry

- Máx 2 tentativas
- Apenas erros temporários
- Backoff simples

---

### 10. Rate Limiting

- Delay aleatório
- Ramp-up progressivo
- Pausa entre lotes

---

### 11. Batch

- Envio em blocos
- Pausa entre blocos

---

### 12. Controle

- Iniciar
- Pausar
- Retomar
- Cancelar

---

### 13. Monitoramento

Mostrar:

- enviados
- falhas
- pendentes
- velocidade
- tempo restante

Polling 3–5 segundos

---

### 14. Interface

Simples:

- lista de campanhas
- criar campanha
- upload CSV
- execução

Sem frameworks

---

### 15. Integração WhatsApp

- Evolution API
- Função isolada
- Tratamento de erro

---

### 16. Banco

SQLite com:

- campanhas
- contatos
- logs

---

### 17. Logs

Registrar:

- envio
- erro
- retry
- status

---

### 18. Exportação

CSV com falhas

---

### 19. Segurança

- confirmação para envio grande
- evitar duplicação
- validar inputs

---

### 20. Estrutura

- main.py
- models.py
- services/
- utils/
- templates/
- database.py

---

### 21. Ordem de Implementação

1. Estrutura
2. Banco
3. CSV
4. Telefone
5. API WhatsApp
6. Campanhas
7. Contatos
8. Dry run
9. Teste
10. Envio
11. Controle
12. UI
13. Exportação

---

### 22. Critérios de Sucesso

- Sistema roda
- CSV funciona
- Envio funciona
- Não duplica mensagens
- Pode pausar/retomar
- Logs existem

---

### 23. Execução do Agente

Responder com:

1. Arquitetura
2. Estrutura
3. Código
4. Como rodar
5. Checklist

---

### Regra Final

Sempre escolha:

- simples > complexo  
- rápido > perfeito  
- funcional > bonito  
- confiável > sofisticado  
