# Opção 3. Anotações de inteligência

O objetivo é o Felipe ficar mais esperto a cada reunião. Guardar o que serve para melhorar tarefas, programas, atividades e estratégia, na vida profissional, pessoal e familiar, sem virar arquivo morto.

Uma reunião gera pouca coisa que vale guardar. Cinco linhas boas valem mais que uma ata inteira. O resumo da reunião já mora no Drive, e ele só precisa do que **muda alguma coisa depois**.

## 1. Extrair

Do estudo da reunião, separe em quatro tipos e descarte o resto:

| Tipo | O que é | Exemplo |
|---|---|---|
| **Decisão** | Algo acordado que muda o rumo, com o número quando houver | "Afiliado recebe 20% de comissão" |
| **Aprendizado** | Algo que o Felipe percebeu, ouviu ou testou e que serve de regra daqui para frente | "Quem instala no Mac trava no aviso de segurança, o passo a passo precisa vir antes" |
| **Compromisso** | Tarefa com responsável e, se houver, prazo | "Felipe: criar o link de afiliado" |
| **Pergunta em aberto** | O que ficou sem resposta e precisa voltar | "Qual meio de pagamento integrar" |

**Teste de utilidade.** Cada item precisa responder: *o que eu faço diferente por causa disso?* Sem resposta, descarte.

Para cada item de decisão ou aprendizado, ligue a onde ele se aplica: um produto (Khronus, Blindagem, MCV), um processo, o conteúdo, a agenda, ou a casa. Se o número de uma decisão conflita com o que está registrado no projeto (preço, comissão, prazo), aponte o conflito em vez de sobrescrever.

## 2. Classificar

Cada item vai para um destes três destinos:

- **Profissional:** negócio, produtos, parcerias, preço, processo, clientes, conteúdo, equipe
- **Pessoal:** saúde, finanças pessoais, rotina, aprendizado próprio, decisões de vida
- **Família:** Amanda, filhos, casa, viagens, combinados familiares

Reunião de negócio quase sempre só tem item profissional. Não force conteúdo pessoal ou familiar onde ele não existe. Se surgir um item que atravessa dois destinos, guarde no mais restrito (família antes de pessoal, pessoal antes de profissional).

## 3. Onde guardar

**Decisão do Felipe em 19/09/2026:** o profissional fica no projeto, versionado no GitHub. Pessoal e família ficam **só nas Notas do Apple**, nunca em arquivo do projeto, porque a Amanda usa o mesmo login do GitHub e enxergaria esses arquivos.

### Profissional: arquivo no projeto

Caminho: `inteligencia/reunioes/AAAA-MM-DD-tema-curto.md` (slug ASCII, sem acento).

Antes de criar, leia `inteligencia/INDICE.md` (se existir) para não duplicar e para ligar a reuniões anteriores sobre o mesmo assunto.

Estrutura do arquivo:

```markdown
---
data: AAAA-MM-DD
horario: HH:MM
participantes: [Felipe, Lucas]
temas: [khronus, afiliados]
fonte: URL_DO_DOCUMENTO_NO_DRIVE
---

# Tema da reunião

**Em uma frase:** o que a reunião foi e onde chegou.

## Decisões
- ...

## Aprendizados
- Regra ou percepção. **Aplica em:** onde.

## Compromissos
- [Responsável] tarefa (prazo)

## Perguntas em aberto
- ...

## Relacionadas
- [[AAAA-MM-DD-outra-reuniao]] quando houver
```

Depois, acrescente uma linha ao `inteligencia/INDICE.md` (crie o arquivo na primeira vez, com o cabeçalho `# Índice de reuniões`): `- AAAA-MM-DD · Tema · temas · [arquivo](reunioes/AAAA-MM-DD-tema.md)`, da mais recente para a mais antiga.

**Sem dado de terceiro que não precise estar lá.** Sem telefone, e-mail, endereço ou valor pessoal de quem participou. O nome do participante entra, o resto não. Menção a concorrente entra só se for análise interna, e nunca vai para conteúdo público a partir daqui.

### Pessoal e família: Notas do Apple

Use `add_note` do conector de Notas. Título: `Reunião AAAA-MM-DD · tema`. Corpo: os itens, no mesmo formato de lista, sem cabeçalho técnico. Diga ao Felipe onde a nota ficou.

**Nunca** grave esses itens em arquivo dentro de `fluxo-criativo`, nem em outro repositório, nem na memória do projeto.

## 4. Aprovar antes de salvar

Mostre os itens agrupados por destino, e pergunte:

```
1. Aprovar e salvar
2. Quero ajustar algo
```

Se houver item pessoal ou familiar, diga explicitamente que ele vai para as Notas do Apple e não para o GitHub.

## 5. Salvar e sincronizar

Depois da aprovação:

1. Grave o arquivo profissional e atualize o índice.
2. Grave a nota pessoal ou familiar, se houver.
3. Sincronização com o GitHub, seguindo a regra global do `CLAUDE.md`: **commit só dos arquivos de `inteligencia/`**, com mensagem curta, e `git push origin`. **Nunca** para o remote `mentoria`. Não use `git add -A`, o repositório costuma ter outras alterações do Felipe em andamento.

```bash
git add inteligencia/
git commit -m "docs(inteligencia): reunião AAAA-MM-DD, tema"
git push origin main
```

Termine a mensagem de commit com a linha de atribuição indicada nas instruções da sessão.

4. Mostre o caminho absoluto do arquivo e o local da nota.

## 6. Ofertas, sem executar

Ao final, ofereça em uma frase cada, sem fazer por conta própria:

- **Regra permanente.** Se um aprendizado for do tipo "sempre faça X" ou "nunca faça Y" e mudar a forma como o Claude trabalha com o Felipe, ofereça registrar na memória do projeto. Só grave se ele disser sim.
- **Compromissos do Felipe.** Ofereça lançar como tarefa no Lembretes ou no Trello. Só crie se ele pedir.
- **Conteúdo.** Se algum aprendizado parece bom ideia de post, ofereça a opção 1 (`references/conteudo.md`).
