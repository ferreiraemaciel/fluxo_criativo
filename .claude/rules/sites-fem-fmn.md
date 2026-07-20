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
npx wrangler pages deploy . --project-name <nome-do-projeto>
```

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

## Identidade visual — gap entre fotos

Gap fixo de **3px** em todos os grids de fotos. Nunca usar 2px, 4px ou outro valor.

---

## R2 — exclusão ao remover foto pelo admin

Quando o usuário deleta uma foto pelo painel admin (qualquer site: FeM, FMN), a imagem deve ser excluída do R2 imediatamente via `DELETE` no worker de upload:

```js
const key = new URL(url).pathname.slice(1);
fetch(`https://fem-upload.blindagem-fmn.workers.dev/?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
```

Isso vale para exclusão individual e exclusão em lote (selecionadas). Ainda não implementado em todos os painéis — backlog no Lembretes.
