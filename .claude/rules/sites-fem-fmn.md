# Padrões de Desenvolvimento — Sites FeM e FMN

> Regras técnicas e de design acordadas para os sites da FeM (`fem-site`) e da FMN (`fmn-site`).
> Atualizar sempre que um padrão for aprovado em sessão.

---

## Projetos e deploys

| Projeto | Pasta local | Cloudflare Pages | Domínio |
|---------|------------|-------------------|---------|
| Site público FeM | `~/Documents/fem-site` | `fem-site` | `site.ferreiraemaciel.com.br` |
| Admin FeM | `~/Documents/fem-site` | `fem-admin` | `admin.ferreiraemaciel.com.br` |
| Site público FMN | `~/Documents/fmn-site` | `fmn-site` | (domínio definitivo pendente) |

**Deploy nunca é automático via git push.** Sempre rodar:
```bash
# Site público FeM
npx wrangler pages deploy . --project-name fem-site

# Admin FeM — SEMPRE via script (nunca deploy direto de .)
bash scripts/deploy-admin.sh

# Worker de upload (fem-upload)
cd ~/Documents/fem-site/scripts
npx wrangler deploy worker-upload.js --name fem-upload
```

**Por que o admin usa script separado:** `fem-site` e `fem-admin` deployam da mesma pasta local. O Cloudflare Pages serve `index.html` por padrão na raiz — que é o site público. O script `deploy-admin.sh` copia `admin.html` → `.admin-deploy/index.html` e deploya `fem-admin` a partir dessa pasta isolada. Sem isso, `admin.ferreiraemaciel.com.br/` abre o site público em vez do painel.

> `scripts/` e `.admin-deploy/` estão no `.gitignore` do fem-site propositalmente.

---

## Grid de fotos — galerias e posts

> Aprovado em 2026-07-20. Aplica-se a qualquer grid de fotos nos sites FeM e FMN: galerias públicas, posts (Histórias) e visualização de fotos no admin.

### Proporção obrigatória

- **Foto horizontal (landscape):** ocupa 1 linha do grid → proporção 3:2 (largura:altura)
- **Foto vertical (portrait):** ocupa 2 linhas do grid → mesma altura que duas horizontais empilhadas
- A detecção é automática via `naturalHeight > naturalWidth` no `onload` da `<img>`

### CSS

```css
.fotos-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  /* grid-auto-rows é definido via JS conforme largura da coluna */
}
.foto-item {
  position: relative;
  overflow: hidden;
  cursor: pointer;
  border-radius: 2px;
  background: #1a1a1a;
}
.foto-item img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Mobile */
@media (max-width: 768px) { .fotos-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .fotos-grid { grid-template-columns: repeat(1, 1fr); } }
```

### JS — altura das linhas e detecção de orientação

```js
function calcGridRows() {
  const grid = document.getElementById('fotosGrid');
  if (!grid) return;
  const cols = window.innerWidth <= 480 ? 1 : window.innerWidth <= 768 ? 2 : 3;
  const gap = 3;
  const colW = (grid.clientWidth - (cols - 1) * gap) / cols;
  // 1 linha = altura de uma foto landscape 3:2
  grid.style.gridAutoRows = Math.round(colW * 2 / 3) + 'px';
}
window.addEventListener('resize', calcGridRows);
```

Orientação detectada via `onload` em cada `<img>`:

```html
<img src="..." loading="lazy"
  onload="(function(img){
    img.parentElement.style.gridRow = img.naturalHeight > img.naturalWidth ? 'span 2' : 'span 1';
  })(this)">
```

### Onde está implementado hoje

| Local | Elemento | Função JS |
|-------|----------|-----------|
| `galeria.html` (FeM público) | `#fotosGrid .foto-item` | `renderGaleria()` + `calcGridRows()` |
| `admin.html` (FeM admin — Galerias) | `#galFotosGrid .gev-item` | `renderGalFotosGrid()` + `calcGevGridRows()` |

Quando implementar em outros grids (FMN, admin FMN, Khronus), seguir exatamente este mesmo padrão.

---

## Ordenação padrão de fotos

Sempre A→Z pelo nome do arquivo, sem extensão, case-insensitive:

```js
fotos.sort((a, b) => {
  const nA = a.split('/').pop().split('?')[0].toLowerCase();
  const nB = b.split('/').pop().split('?')[0].toLowerCase();
  return nA.localeCompare(nB);
});
```

---

## Identidade visual — número da foto

O número da foto no canto superior esquerdo **não deve ser exibido** ao passar o mouse. O elemento `.foto-num` existe no HTML mas fica sempre oculto:

```css
.foto-num { display: none; }
```

Nunca reativar via hover (`.foto-item:hover .foto-num { opacity: 1 }` é proibido).

---

## Identidade visual — gap entre fotos

Gap fixo de **3px** em todos os grids de fotos. Nunca usar 2px, 4px ou outro valor.

---

## R2 — nomenclatura de arquivos (nome original preservado)

> Aprovado em 2026-07-20. Aplica-se a qualquer upload para o R2 via worker `fem-upload`.

**Regra:** ao subir uma foto para o R2, o nome original do arquivo deve ser preservado. Nunca renomear com timestamp ou random. Isso garante que a ordenação A→Z no grid reflita a numeração real das fotos (ex: `DSC_0001.jpg`, `DSC_0002.jpg`...).

**Implementação no worker** (`~/Documents/fem-site/scripts/worker-upload.js`):

```js
const prefix = (formData.get('prefix') || 'posts').replace(/[^a-z0-9_-]/g, '').slice(0, 40) || 'posts';
// Preserva nome original, sanitiza caracteres problemáticos
const rawName = (file.name || 'img').replace(/\\/g, '/').split('/').pop();
const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_');
// Evita sobrescrever arquivo existente com o mesmo nome
const existing = await env.BUCKET.head(`${prefix}/${safeName}`);
const key = existing
  ? `${prefix}/${safeName.replace(/(\.[^.]+)?$/, `_${Math.random().toString(36).slice(2,6)}$1`)}`
  : `${prefix}/${safeName}`;
```

**Nunca usar** `Date.now()` ou `Math.random()` como base do nome — isso quebra a ordem das fotos.

---

## Capa da galeria — definida pela estrela, sem upload separado

A foto de capa de um evento é sempre uma das fotos já enviadas para a galeria. O admin **não tem campo de upload de capa** — a capa é definida passando o mouse sobre qualquer foto e clicando em ★.

- Capa definida: exibe thumbnail pequeno (80×54px, borda dourada) + botão "Remover"
- Sem capa: exibe instrução "Passe o mouse sobre uma foto e clique em ★"
- Nunca reintroduzir botão "Enviar capa" ou "Trocar foto" com upload separado

A `galCapaUrl` continua sendo salva normalmente no campo `capa_url` do Supabase via `salvarEvento()`.

---

## R2 — exclusão ao remover foto pelo admin

Quando o usuário deleta uma foto pelo painel admin (qualquer site: FeM, FMN), a imagem deve ser excluída do R2 imediatamente via `DELETE` no worker de upload:

```js
const key = new URL(url).pathname.slice(1);
fetch(`https://fem-upload.blindagem-fmn.workers.dev/?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
```

Isso vale para exclusão individual e exclusão em lote (selecionadas). Ainda não implementado em todos os painéis — backlog no Lembretes.
