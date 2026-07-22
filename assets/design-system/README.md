# Rádio Inspira FM — Design System

Tokens de marca da **Inspira FM 97.7** — "Sintonia que te inspira".
Marca de rádio/bem-estar multiplataforma (música, saúde, meio ambiente, propósito).

Fontes de verdade: `ID VISUAL INSPIRA FM.pdf` (22 p.), `PALETA DE CORES INSPIRA FM.pdf`
(2 p., RGB/CMYK/Pantone), `LOGO INSPIRA FM.pdf` (6 p.) — em `Documents/Inspira FM/`.

- Site: https://inspirafm.com.br/ · Instagram: https://www.instagram.com/inspirafm/

## Arquivos

| Arquivo | O que é |
|---|---|
| `design-tokens.json` | **Fonte única de verdade.** Cores, semântico, tipografia, logo. |
| `tokens.css` | Custom properties (`--inspira-*`, `--color-*`, `--font-*`). |
| `fonts.css` | `@font-face` da camada web (Baloo 2 + Nunito Sans). |
| `fonts/` | woff2 Baloo 2 (700/800) + Nunito Sans (400/600/700/800). |
| `logos/hq/` | Logos oficiais em alta resolução (variações do ID VISUAL). |
| `logos/` | Versões do site (menor resolução). |

## Uso no site (HTML/CSS puro)

> ⚠️ **O site publicado não consome estes arquivos.** O `index.html` embute as
> `@font-face` inline e carrega os woff2 de `fonts/` (raiz do repo), com nomes de
> token próprios (`--teal-950`, `--lime`, `--coral`, `--paper`, `--ink`).
> Os **valores** de marca já foram alinhados a este design system em 22/07/2026 —
> ver "Conciliação" no fim. Os nomes seguem diferentes.

```html
<link rel="stylesheet" href="/assets/design-system/fonts.css">
<link rel="stylesheet" href="/assets/design-system/tokens.css">
```

```css
body { background: var(--color-bg); color: var(--color-text); font-family: var(--font-body); }
h1, h2 { font-family: var(--font-display); font-weight: var(--fw-extrabold); }
.btn-primary { background: var(--color-primary); color: var(--color-on-primary); }
p { text-align: justify; hyphens: auto; }
```

## Cores

**Principais:** verde-lima `#82DD47` · teal profundo `#005650` (âncora) · coral `#F46C42`.
**Vibrantes:** teal `#00BAA8` · âmbar `#FBB83B` · roxo `#8965A9`.
**Neutros:** paper `#F0F2E4` · ink `#5B5E56`.
**Print (Pantone Uncoated):** 8 tons suaves em `--inspira-print-01..08` (ver JSON p/ CMYK+Pantone).

Logo usa teal `#005650` ("inspira"/"FM") + lima `#82DD47` ("97.7") + ondas coral/laranja.

## Tipografia — DUAS camadas

- **Marca (oficial, ID VISUAL):** **Kind Sans** (logo "FM"/"97.7" + institucional) + **Edu QLD** (cursiva de apoio, frases/assinaturas).
- **Web (site atual):** **Baloo 2** (display, substitui Kind Sans) + **Nunito Sans** (corpo).

`--font-display` / `--font-body` apontam pra camada web (o que renderiza hoje).
`--font-brand-display` / `--font-brand-script` guardam a canônica de marca.

## Conciliação com o site (22/07/2026)

O `:root` do site tinha sido derivado da **paleta impressa (Pantone Uncoated)**, não
da RGB de marca — `--lime` era `#9CD776` (= `--inspira-print-05 #9DD876`) e `--orange`
era `#EE9D67` (= `--inspira-print-04 #EF9E67`). Corrigido:

| Token do site | Era | Agora | Origem |
|---|---|---|---|
| `--teal-700` | `#056250` | `#005650` | `--inspira-teal` (âncora) |
| `--lime` | `#9CD776` | `#82DD47` | `--inspira-lime` |
| `--coral` | `#EF4D45` | `#F46C42` | `--inspira-coral` |
| `--orange` | `#EE9D67` | `#EF9E67` | `--inspira-print-04` |
| `--paper-2` | `#F1F5EC` | `#F0F2E4` | `--inspira-paper` |

**Desvios conscientes** (não mexer sem revalidar contraste):

- `--muted` fica `#3E5049`, não `--inspira-ink #5B5E56`: o token oficial cairia de
  8,33:1 para 6,41:1 sobre o fundo, em 46 usos de texto secundário.
- `--paper` fica `#FBFCF9`: aplicar `#F0F2E4` aqui colapsaria a hierarquia contra
  `--paper-2`. O token oficial entrou no `--paper-2`.
- A rampa escura (`--teal-950/900/800/600`) é extensão do site, sem par no design
  system. Re-derivá-la do âncora derrubaria `.gate-note` / `.page-hero .meta` para
  4,62:1.

**Regras de uso de cor** (aprendidas na auditoria de contraste):

- `--lime`, `--lime-bright` e `--orange` são para **fundo escuro ou decoração**.
  Como texto sobre `--paper` dão 1,65:1, 1,15:1 e 2,11:1 — reprovam de longe.
- `--dv-*` e `--dvd-*` são **dataviz**, não texto. Passam o 3:1 de elemento gráfico,
  mas `--dv-orange` como texto dá 4,28:1 e reprova AA.

## TODO

- Resolver licença/arquivo da **Kind Sans** (premium) pra aplicar na web, ou manter Baloo 2 como substituto oficial.
- Adicionar **Edu QLD** via Google Fonts onde a cursiva for usada.
- Extrair logo vetorial (SVG) do `LOGO INSPIRA FM.pdf` p/ uso web nítido.
- **Deduplicar as fontes:** os 6 woff2 estão versionados duas vezes (`fonts/` e
  `assets/design-system/fonts/`). O site consome os da raiz.
- **Trazer os PDFs de marca pra `assets/`** — hoje as fontes de verdade apontam pra
  `Documents/Inspira FM/`, fora do repositório. É a mesma dependência externa que já
  custou o HTML-fonte do site.

---
Resumo no Obsidian: `01 - Clientes/Radio Inspira FM/_Rádio Inspira FM — Design System.md`.
