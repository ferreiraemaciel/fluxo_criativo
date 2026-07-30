# Relatório de feedbacks em aberto — Blindagem (30/07/2026)

> Levantamento direto no banco de produção (tabela `feedbacks`, Supabase, projeto Blindagem). 23 feedbacks em aberto (status `analisar` ou `em_andamento`), nenhum finalizado. Datas convertidas para horário de Brasília.
>
> **Nota sobre os prints:** 8 feedbacks têm print anexado. Tentei renderizá-los aqui, mas o ambiente desta sessão bloqueia a rede para o host do Supabase (tanto por chamada direta quanto pela ferramenta de busca web), e a alternativa de baixar o arquivo em base64 e reconstruir localmente se mostrou pouco confiável para imagens grandes (risco de corromper o arquivo). Por isso a análise abaixo usa o texto de cada feedback, que na maioria dos casos já descreve bem o problema. Marquei com 📷 os que têm print e indiquei quando vale a pena abrir a aba Feedbacks do admin do Blindagem para conferir visualmente.

---

## 1. Já corrigido em produção — só falta responder (2)

Confirmado na triagem de 27/07 (Amanda + Claude, ver `TRIAGEM-FEEDBACKS-2026-07-27.md` no repo Blindagem), mas a resposta ainda não foi enviada no sistema (`resposta` continua vazio). Não depende de você.

| Feedback | Autor / data | Situação |
|---|---|---|
| "Dias corridos" ignorando configuração de dias úteis | Natália, 01/07 18:52 | Corrigido no commit `021acaa` (10/07), testado ao vivo. Falta responder e marcar como finalizado. |
| Selo "preenchido pelo cliente" quando a fotógrafa preencheu | Natália, 07/07 02:21 | Corrigido no commit `021acaa`, verificado ao vivo no contrato "Smash Juliana 1 Ano". Falta responder e marcar como finalizado. |

**Ação:** enviar as duas respostas e marcar como finalizado.

---

## 2. Bug crítico fora da tabela de feedbacks (herdado da triagem de 27/07)

Não veio pelo formulário de feedback (a cliente reportou por vídeo), mas continua pendente e é o item de maior risco:

**Contrato órfão de template (Romy Tanaka, 23/07).** Quando o modelo de um contrato é excluído, os contratos gerados a partir dele ficam sem template em silêncio. O link público trava numa tela vazia com "Contrato sem template" e o cliente não consegue assinar. Plano já aprovado pela Amanda: (1) mensagem clara no link público em vez de tela vazia, (2) aviso no detalhe do contrato pro fotógrafo, (3) confirmação obrigatória ao excluir um modelo com contratos vinculados. **Não depende de você** — falta só implementar.

---

## 3. Bugs técnicos claros — não dependem de você, é só eu corrigir (6)

Comportamento visivelmente errado, sem decisão de produto envolvida.

| Feedback | Autor / data | Problema |
|---|---|---|
| 📷 Nome da criança obrigatório trava a assinatura | Natália, 27/07 17:37 e 29/07 15:19 (2 relatos do mesmo bug) | Quando o cliente NÃO autoriza uso de imagem, o campo "nome da criança" continua obrigatório e impede seguir para a assinatura, mesmo sem filhos e sem autorização marcada. Bug de validação condicional. |
| 📷 Assistente não consegue baixar o PDF assinado | Natália, 29/07 17:06 | Erro aparece no canto inferior direito ao tentar baixar. Precisa reproduzir com o e-mail da assistente para achar a causa (provável problema de permissão/RLS no storage de contratos). |
| Reenviar link não reabre o formulário | Casal Boeira, 22/07 21:45 | Um dos contratantes errou um campo; ao gerar link novo, o formulário não volta em branco pra preencher de novo. |
| Notificação de feedback respondido fica "sempre ativa" | Casal Boeira, 28/07 16:37 | O sininho de notificação de resposta não some depois de lida, mesmo já tendo sido resolvida. |
| Dúvida simples: contrato não vai por e-mail automático | Natália, 01/07 20:05 | Não é bug, é falta de clareza na UI. Responder explicando e considerar deixar isso explícito na tela de envio. |

**Ação:** dá pra entrar nesses sem precisar de nada seu, só avisar quando cada um estiver corrigido.

---

## 4. Pedidos que precisam da sua decisão antes de implementar (12)

Aqui a implementação técnica é direta, mas cada um esbarra numa decisão de produto, arquitetura ou risco legal que só você pode bater o martelo.

### Tema mais pedido: editar contrato sem perder os dados já preenchidos (5 feedbacks)
Natália (03/07, 02:22 07/07), Júlia (13/07), Casal Boeira (20:45 e 21:45 22/07). Hoje, qualquer edição depois de gerado obriga a refazer o contrato do zero. É o pedido que mais se repete na fila. **Decisão:** priorizar isso agora (é trabalho grande, reescreve o fluxo de edição) ou deixar pra depois?

### Conflitos com regras de arquitetura já definidas
- **Rescisão e multas diferentes por tipo de serviço** (Casal Boeira, 28/07 16:41, 📷) e **prazo de entrega personalizado por tipo de trabalho** (Casal Boeira, 28/07 16:09) — ambos esbarram na regra "sem lógica de tipo de evento" do projeto (cláusulas são universais, quem decide o que aparece é o usuário por contrato). Pra atender, seria preciso abrir uma exceção nessa regra. **Decisão:** vale abrir essa exceção ou existe outro jeito de resolver dentro do modelo atual (ex: cláusula condicional configurável, não automática por tipo)?
- **Campo de número de convidados na festa infantil** (Luciana, 29/06 08:46) — mesmo conflito: campo específico de um tipo de evento.

### Risco legal (ECA/LGPD)
- **Deixar as cláusulas de uso de imagem pré-marcadas** em vez do cliente preencher (Natália, 07/07 02:12) — a própria Natália reconhece que isso reduz a chance do cliente recusar. Como envolve autorização de uso de imagem de criança, é uma decisão que precisa passar por você antes de tocar no código.
- **Autorização de uso de imagem retroativa** (Ferreira e Maciel, 17/07 15:59) — feedback registrado pelo próprio Felipe, sobre conversa com a Paula Nakamo. Fica registrado aqui pra decidir se quer que se verifique a viabilidade técnica.

### Decisões de produto
- **Fotógrafo preencher tudo e cliente só assinar** (Natália, 07/07 01:46) — conflita com a mudança recente que tornou as cláusulas de imagem preenchidas pelo cliente. Precisa decidir se volta a permitir isso como opção.
- **Editar subtítulos das cláusulas** (Casal Boeira, 26/06 18:55) — hoje só dá pra ocultar/criar cláusula, não renomear subtítulo. Decisão de quanto expor de edição no banco universal.
- **Contrato único de NASCIMENTO (parto ou cesárea)** (Luciana, 25/06 15:16) — mudança de modelagem dos contratos mãe existentes.
- **Preview do link no WhatsApp com foto de capa e nome customizado** (Casal Boeira, 22/07 20:19, 📷) — pedido de branding (trocar "Blindagem para fotógrafos" pelo nome do tipo de evento). Baixo risco técnico, mas muda algo visível pro cliente final.
- **Parcelas mostrando data quando pagamento é cartão/link** (Casal Boeira, 22/07 20:21, 📷) — pedido pra esconder a data de parcela quando quem processa o pagamento é a operadora, não o fotógrafo. Precisa definir a regra de quando mostrar.
- **Permitir 2ª forma de pagamento** (Casal Boeira, 22/07 20:22) — feature nova, maior escopo.

---

## Resumo rápido

- **2** só precisam de resposta (já corrigidos).
- **1** bug crítico herdado da triagem anterior, plano aprovado, falta só construir.
- **6** bugs técnicos que resolvem sem consulta adicional.
- **12** esperando uma decisão (a maioria é conflito com regra de arquitetura já combinada, risco legal, ou prioridade de escopo grande).

**Sugestão de próximo passo:** começar já pelas seções 1, 2 e 3 (nada disso depende de decisão) enquanto os itens da seção 4 são avaliados com calma.
