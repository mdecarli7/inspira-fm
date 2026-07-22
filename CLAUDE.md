# CLAUDE.md — Rádio Inspira FM

@../../_padroes/PADRAO-AGENCIA.md

## Este projeto

- **Cliente:** Rádio Inspira FM (Inspira FM 97.7)
- **Grupo:** —
- **O que é:** plataforma web interna da **Diretoria de Marketing** da Inspira FM —
  relatórios, análises, gestão de conteúdo, processos e financeiro num só lugar.
  Uso interno da equipe, acesso restrito.
- **URL:** https://mdecarli7.github.io/inspira-fm/ (Firebase Auth — login Google
  ou e-mail/senha, acesso por papel; **não** é senha compartilhada)
- **Repositório:** este (`inspira-fm`), publicado via GitHub Pages.
- **Design System:** `assets/design-system/` (tokens + fontes + logos). Ver README de lá.
  Paleta do site conciliada com a oficial em 22/07/2026 — desvios conscientes
  documentados lá (`--muted` e `--paper` ficam fora do padrão por contraste).
- **⚠️ Dívida aberta:** o HTML de `content/base` e `content/financeiro` no Firestore
  não tem backup versionado (só o `seed.html` local, gitignored). Use
  `scripts/export-conteudo.html` pra baixar o backup — servir em `localhost`
  (`npx serve scripts`), entrar com Google e exportar. **O JSON gerado tem a folha
  salarial: guardar fora do repositório** (já coberto pelo `.gitignore`).
- **⚠️ Pendências que dependem do Console do Firebase** (não dá pra resolver em código):
  publicar o `firestore.rules`, ligar *email enumeration protection*, bloquear
  auto-cadastro (hoje qualquer pessoa da internet vira `request.auth != null`),
  conferir que o provedor *Anonymous* está desligado e ativar *point-in-time recovery*.
- **⚠️ Pendência de performance:** a Home baixa todas as campanhas e ideias, cada uma
  com até 6 fotos base64 de ~130 KB. `.limit()` **não** resolve (quebra filtros e
  contadores que rodam sobre a lista inteira no cliente). O conserto é tirar as fotos
  do documento de lista — Storage + URL, ou subdocumento sob demanda.

## Armadilhas conhecidas (aprendidas na auditoria de 22/07/2026)

- **`firestore.rules`: nunca chamar `userData()` sem `hasProfile()` antes.** `get()` num
  doc inexistente devolve `null`, e `null.data` é **erro de avaliação** — que nega o
  request inteiro em vez de valer `false`. Em regra de `create` isso trava o cadastro
  de todo mundo. Pelo mesmo motivo, o ramo do próprio usuário vem antes de `isAdmin()`.
- **Cores:** `--lime`, `--lime-bright` e `--orange` só funcionam sobre fundo escuro
  (sobre `--paper` dão 1,65:1). `--dv-*` são dataviz, não texto.
- **`fin/folha` × `fin/equipe`:** a folha completa (com nascimento) é `canFin()`; o
  espelho sem nascimento é o que o diretor lê na Estruturação. `finSave()` grava os
  dois num batch — ao mexer num, mexer no outro.
- **`CL` é global compartilhada** entre o form de colunista dos Quadros (`cl`) e o do
  Radar (`rc`). Sempre checar `CL.pfx` antes de zerar.
- **`escAttr()` reintroduz `<b>`/`<br>` de propósito** e o destino é `tip.innerHTML`.
  Só usar com texto constante do código — nunca com dado do Firestore.

## O que a plataforma cobre (mapa de seções)

- **Início** — painel do dia: campanhas ativas, eventos da semana, "fique de olho"
  (assuntos), músicas em alta (nacionais/internacionais — adulto contemporâneo),
  Brainstorm (últimas ideias). Destaques editáveis pela diretoria.
- **Minha conta** — perfil do usuário (nome, apelido, nascimento, setor).
- **Análises** — Análise Dial · Análise Redes Sociais · Análise Site · Análise MobRadio.
- **Conteúdo:**
  - **Nossa Programação** — grade por canal (rádio, Instagram, YouTube): o que vai ao ar, quando, proposta.
  - **Quadros da Inspira** — quadros de conteúdo, subabas por canal (rádio / redes / site).
  - **Radar** — embaixadores/colunistas em planilha: perfil, frequência de publicação, busca.
  - **Campanhas** — ciclo rascunho → ativa → comercializar → encerrada; editor, fotos, brainstorm.
- **Gestão:**
  - **Organograma** — estrutura da empresa.
  - **Processos** — processo de trabalho ativo por setor, publicado a partir da Estruturação.
  - **Estruturação** (diretoria) — simulador de equipe/custo: antes vs depois, KPIs de custo
    fixo, etapas do processo; "publicar processo" vira o processo oficial do setor.
  - **Equipe** (`view-financeiro`, gate `fin`) — folha e custo da equipe. Rotulada
    "Equipe" no menu; internamente ainda se chama `financeiro`. HTML vem de
    `content/financeiro`, os dados da folha de `fin/folha`. **Não tem senha própria** —
    o acesso é por permissão (`role: admin` ou `verFinanceiro: true`). Não existe
    view "Balanço Financeiro" separada: é esta.
- **Administração** (gate `re` — diretoria, não admin):
  - **Jurídico** — modelos de contrato em papel timbrado: embaixador, colunista, influenciador,
    equipe, patrocínio, permuta, imagem, NDA.
  - **Usuários** (gate `admin`) — gestão de acessos e papéis.

## Stack específica

- HTML/CSS/JS estático: **`index.html`** (casca: menu, login e as 16 views) +
  **`runtime.js`** (o app inteiro, ~172 KB). Fontes em `fonts/*.woff2` — externas,
  com `@font-face` inline no `<style>` do index (não são embutidas em base64).
- **Firebase Auth** (login Google + e-mail/senha) + **Firestore**. Coleções reais:
  `users`, `content`, `fin`, `projetos`, `processos`, `campanhas`, `brainstorm`,
  `analises`, `juridico`, `programacao`, `quadros`, `colunistas`, `embaixadores`,
  `destaques`.
- **⚠️ Três views não têm markup no `index.html`** — o HTML delas vem do Firestore
  via `innerHTML`: `view-analise` ← `content/base.analise`, `view-organograma` ←
  `content/base.organograma`, `view-financeiro` ← `content/financeiro.html`.
  Editar essas três = editar o documento no Firestore, não o arquivo.
- **Papéis:** pendente → colaborador → diretor → admin. Páginas restritas por papel
  (gates `data-need` = re / fin / admin). Cadastro novo entra como *pendente* até liberação.

## Segurança do conteúdo (versão publicada)

- **Não há criptografia no `index.html`.** O modelo AES-256-GCM do `build.js` foi
  abandonado na migração para Firebase. O que está publicado é casca pública, sem
  conteúdo sensível.
- A proteção real é **Firebase Auth + `firestore.rules`**. É o `firestore.rules` que
  decide quem lê `content/financeiro` e `fin/folha` — é o arquivo mais crítico do
  projeto. Ele **é versionado** (é infraestrutura, não segredo).
- A `apiKey` do Firebase em `runtime.js` é pública por natureza (identificador, não
  credencial). Consequência: qualquer furo nas regras é explorável direto pelo SDK,
  ignorando a UI. Esconder botão nunca é controle de acesso.
- **Nunca commitar:** `seed.html` (folha salarial, nomes), senhas, o fonte plaintext.

## Fluxo de atualização

**Não há build.** Editar `index.html` e/ou `runtime.js` direto na raiz e `git push`
→ GitHub Pages. Ao mexer no `runtime.js`, atualizar o `?v=` no `<script src>` do
`index.html` pra furar o cache do navegador.

Conteúdo do dia a dia (campanhas, quadros, radar, processos, jurídico, programação)
é editado **dentro do próprio app** e vive no Firestore — não no repositório.

### Histórico do build (contexto)

- `build-firebase.js` foi o pipeline de migração: fatiava um HTML-fonte plaintext
  (`inspira-fm-relatorios.html`) pra gerar o `index.html` (via `site-src/template.html`
  + `{{CSS}}` + `{{FONTS}}`) e o `seed.html` que populou o Firestore. Rodou uma vez.
- ⚠️ **O HTML-fonte não existe mais em disco** e `build-firebase.js` ainda aponta pra
  pasta renomeada `Desktop/Claude 1.0/`. O pipeline **não roda**.
- Isso não bloqueia manutenção: o CSS está íntegro no `index.html` e todo o markup
  das views já está lá. Só o conteúdo das 3 views do Firestore não tem backup versionado.
- `build.js` (versão AES) está **morto e é perigoso** — se rodado, sobrescreve o
  `index.html` publicado com um artefato incompatível.
- **Não sobem** (`.gitignore`): `build.js`, `fonts-inline.css`, `*.local.html`,
  `seed.html`, `site-src/`, `build-firebase.js`.

## Ligado ao Obsidian

- Dashboard: `Matheus 1.0 obsidian → 01 - Clientes → Radio Inspira FM` → [[_Rádio Inspira FM]]
- Design System: [[_Rádio Inspira FM — Design System]]
- Plataforma interna: [[Rádio Inspira FM — Plataforma Interna]]
