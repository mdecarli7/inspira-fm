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

## TODO

- Resolver licença/arquivo da **Kind Sans** (premium) pra aplicar na web, ou manter Baloo 2 como substituto oficial.
- Adicionar **Edu QLD** via Google Fonts onde a cursiva for usada.
- Extrair logo vetorial (SVG) do `LOGO INSPIRA FM.pdf` p/ uso web nítido.

---
Resumo no Obsidian: `01 - Clientes/Radio Inspira FM/_Rádio Inspira FM — Design System.md`.
