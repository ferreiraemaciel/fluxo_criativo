# Configurar um computador novo (Amanda ou qualquer Mac adicional)

> Passo a passo pra deixar um Mac novo com acesso completo ao Fluxo Criativo e aos projetos do Felipe, usando o mesmo login do GitHub dele.

## 1. Instalar as ferramentas base

- **Git**: geralmente já vem no Mac. Testar no Terminal com `git --version`. Se pedir pra instalar as "Command Line Tools", aceitar.
- **Claude Code**: instalar conforme as instruções oficiais da Anthropic.
- **GitHub CLI**: instalar com `brew install gh`, depois `gh auth login` usando o login do Felipe.

## 2. Clonar os repositórios

Rodar no Terminal, dentro de `~/Documents`:

```bash
cd ~/Documents
git clone https://github.com/ferreiraemaciel/fluxo_criativo.git fluxo-criativo
git clone https://github.com/ferreiraemaciel/Projetos-FeM-FMN.git fluxo-criativo/meus-produtos
git clone https://github.com/ferreiraemaciel/khronus.git
git clone https://github.com/ferreiraemaciel/fmn-site.git
git clone https://github.com/ferreiraemaciel/fem-site.git
git clone https://github.com/ferreiraemaciel/Blindagem.git contratovisual
git clone https://github.com/rodrigo4635/mensagens-que-vendem.git
```

Atenção ao segundo comando: o `Projetos-FeM-FMN` precisa ser clonado exatamente dentro de `fluxo-criativo/meus-produtos`, porque as skills do sistema esperam esse caminho fixo.

`tracker-fmn` não precisa de clone separado, ele já vem junto dentro do `fluxo-criativo` (é uma pasta normal daquele repositório).

## 3. Copiar as credenciais (.env), por fora do Git

Esses arquivos nunca vão pro GitHub de propósito (são senhas e chaves de API). Precisam ser copiados manualmente, via **AirDrop direto do Mac do Felipe pro Mac de quem estiver configurando**. Nunca por e-mail, WhatsApp ou Drive.

Lista de arquivos (nem todos são necessários de cara, só os dos projetos que a pessoa for realmente mexer):

- `fluxo-criativo/.env`
- `fluxo-criativo/tracker-fmn/.env`
- `fluxo-criativo/tracker-fmn/google-credentials.json`
- `khronus/.env`
- `khronus/cozinha/google-credentials.json`
- `fem-site/.env`
- `mensagens-que-vendem/.env`

(`fmn-site` não tem `.env` local, as credenciais dele já estão configuradas direto no Cloudflare Pages.)

## 4. Testar se a sincronização automática está funcionando

Abrir o Claude Code dentro da pasta `fluxo-criativo`. No início da sessão deve aparecer uma mensagem parecida com:

```
git: 7 repositório(s) atualizado(s)
```

Isso confirma que o hook de sincronização automática (que já vem dentro do repositório clonado, não precisa configurar de novo) está funcionando.

## 5. Rotina do dia a dia

- **Início da sessão**: puxa sozinho, automático. Nada a fazer.
- **Depois de aprovar uma entrega**: sobe sozinho pro GitHub, automático. Nada a fazer.
- Se aparecer aviso de "conflito", parar e chamar o Felipe antes de decidir.

## Opcional: Trilha do Fotógrafo Protegido (Blindagem)

Só necessário se for mexer especificamente nessa feature. É uma branch separada (`feature/trilha-jornada`) do mesmo repositório Blindagem, usando um "git worktree" (uma segunda pasta de trabalho ligada ao mesmo repositório):

```bash
cd ~/Documents/contratovisual
git worktree add ../contratovisual-trilha feature/trilha-jornada
```
