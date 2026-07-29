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
- **`fin/folha` × `fin/equipe` × `fin/folha_anterior`:** a folha completa (com nascimento)
  é `canFin()` — desde 29/07/2026 inclui a diretoria inteira, além da flag
  `verFinanceiro`; o espelho sem nascimento segue sendo o que a Estruturação importa; o
  `folha_anterior` guarda a versão substituída no último save. `finSave()` grava os três
  num batch — ao mexer num, mexer nos outros.
  **Desfazer a folha:** Console do Firestore → `fin/folha_anterior` → copiar `rows` para
  `fin/folha`. É um passo atrás só. O projeto está no **plano Spark**, que não tem
  point-in-time recovery; se um dia migrar para Blaze, ligue o PITR e este documento
  vira redundante.
- **`CL` é global compartilhada** entre o form de colunista dos Quadros (`cl`) e o do
  Radar (`rc`). Sempre checar `CL.pfx` antes de zerar.
- **`escAttr()` reintroduz `<b>`/`<br>` de propósito** e o destino é `tip.innerHTML`.
  Só usar com texto constante do código — nunca com dado do Firestore.

## O que a plataforma cobre (mapa de seções)

- **Início** — painel do dia: campanhas ativas, eventos da semana, "fique de olho"
  (assuntos), músicas em alta (nacionais/internacionais — adulto contemporâneo),
  Brainstorm (últimas ideias). Destaques editáveis pela diretoria.
- **Minha conta** — perfil do usuário (nome, apelido, nascimento, setor).
- **Análises** (todos) — Site · Dial · MobRadio · Redes Sociais, nesta ordem no menu.
- **Comercial** (menu reorganizado em 29/07/2026):
  - **Painel · Nossos Produtos · Agenda · Clientes · Contratos** — gate `com` (diretoria
    ou flag `verComercial`).
  - **Nossos Produtos** (`js/comercial-produtos.js`) — catálogo por canal de divulgação
    (radio / redes / youtube / siteapp) com valor de tabela e `descontoMax` (%). Edita o
    MESMO array `config/comercial.produtos` da aba "Produtos e tabela" do Painel — a aba
    do Painel preserva `canal`/`descontoMax` no save (campos que só a página nova edita).
    Escrita só diretoria (rules de `config/comercial`); flag `verComercial` lê.
  - **Materiais** — gate `matcom` (= `com` **ou** setor Marketing): o Marketing consome
    mídia kit e apresentações. Leitura de `documentos` aberta a todo aprovado nas rules.
- **Marketing** (visibilidade por setor — ver "gates de menu" na Stack; título usa `mktcap`):
  - **Radar** — gate `mkt` (setor Marketing + diretoria).
  - **Planejamento** — gate `plan` (Marketing, Agência Externa + diretoria).
  - **Campanhas** e **Quadros** — gate `mktcom` (Marketing, Comercial + diretoria).
  - **Programação** — gate `prog` (= `mktcom` + Rádio Ao Vivo — a grade do ar é deles).
    Grade por canal (rádio, Instagram, YouTube). Quadros: subabas por canal. Radar:
    embaixadores/colunistas em planilha. Campanhas: ciclo rascunho → ativa →
    comercializar → encerrada.
- **Administração** (título sempre visível — Processos é de todos):
  - **Painel** (gate `admin`) — auditoria, fila de aprovação, métricas, saúde.
  - **Jurídico** (gate `re`) — modelos de contrato em papel timbrado: embaixador, colunista,
    influenciador, equipe, patrocínio, permuta, imagem, NDA.
  - **Usuários** (gate `re` desde 29/07/2026) — diretoria gerencia acessos, papéis e as
    flags Balanço/Comercial. Diretor **não** mexe em conta admin nem promove a admin
    (a UI esconde a opção e as rules negam).
  - **Organograma** (gate `re`) — estrutura da empresa.
  - **Estruturação** (gate `re`) — simulador de equipe/custo; "publicar processo" vira
    o processo oficial do setor.
  - **Processos** (todos) — processo de trabalho ativo por setor.
  - **Equipe** (`view-financeiro`, gate `fin` = diretoria **ou** `verFinanceiro`) — folha
    e custo da equipe. Internamente ainda se chama `financeiro`; HTML vem de
    `content/financeiro`, dados de `fin/folha`. Não existe view "Balanço Financeiro"
    separada: é esta.

## Stack específica

- HTML/CSS/JS estático: **`index.html`** (casca: menu, login e as 16 views) +
  **`runtime.js`** (o app inteiro, ~172 KB). Fontes em `fonts/*.woff2` — externas,
  com `@font-face` inline no `<style>` do index (não são embutidas em base64).
- **`bloom.js`** — fundo animado "Grid Bloom" (shader WebGL puro, sem three.js/React).
  Adota qualquer `<canvas class="bloom">` da página; hoje há quatro: login (`#gate`),
  barra do topo, menu lateral e rodapé. Tudo se ajusta por `data-*` no próprio canvas —
  ver cabeçalho do arquivo. Dois detalhes que não são óbvios:
  **`data-cell`** é o tamanho da célula em pixels (a malha não é "células por altura",
  senão painéis de alturas diferentes rendem texturas diferentes); e **`data-link`**
  faz o painel desenhar a malha a partir do centro da *janela*, não do próprio canvas —
  é o que costura barra + menu + rodapé sem degrau na emenda. Painéis com `data-link`
  precisam dos **mesmos** parâmetros de movimento entre si, ou descolam com o tempo. Pausa via IntersectionObserver
  quando a view está escondida e desenha um quadro estático em `prefers-reduced-motion`.
  Sem WebGL, o canvas fica invisível e sobra o gradiente do container.
- **Firebase Auth** (login Google + e-mail/senha) + **Firestore**. Coleções reais:
  `users`, `content`, `fin`, `projetos`, `processos`, `campanhas`, `brainstorm`,
  `analises`, `juridico`, `programacao`, `quadros`, `colunistas`, `embaixadores`,
  `destaques`, `planejamento` — e, desde 29/07/2026: `auditoria`, `config`
  (docs nomeados: `org`, `comercial`, `backups`, `checklistSeguranca`), `clientes`,
  `negocios`, `contratos`, `agenda_comercial`, `documentos`.
- **Kernel de extensão (29/07/2026):** o `runtime.js` está **congelado** — módulo novo
  vive em `js/*.js`, carregado depois dele no `index.html`, e se registra com
  `registrarModulo({id, need, init, extensaoDe})`; gates viraram a tabela `GATES`
  (módulo adiciona a própria chave, ex. `GATES.com`). Section da view nova é casca
  vazia no index — o markup é injetado pelo módulo no 1º init. Módulos atuais:
  `base-org` (config/org + `col()`), `admin` (Painel do administrador),
  `comercial-core/painel/clientes/agenda/contratos/docs` (módulo comercial, gate
  `com` = diretoria ou flag `verComercial`), `home-setor` (card "Seu dia" no Início),
  `analises-mensais` (histórico manual de Site/MobRadio), `nav-setores` (gates de menu
  por setor). **A tabela de preços do comercial vive SÓ em `config/comercial`**
  (repo é público — preço nunca em código).
- **⚠️ Três views não têm markup no `index.html`** — o HTML delas vem do Firestore
  via `innerHTML`: `view-analise` ← `content/base.analise`, `view-organograma` ←
  `content/base.organograma`, `view-financeiro` ← `content/financeiro.html`.
  Editar essas três = editar o documento no Firestore, não o arquivo.
- **Papéis:** pendente → colaborador → diretor → admin. Páginas restritas por papel
  (gates `data-need` = re / fin / admin / com). Flags por usuário: `verFinanceiro` e
  `verComercial` (diretoria concede em Usuários). Cadastro novo entra como *pendente* até
  liberação — fila de aprovação com badge no **Painel** do admin. Todo save/delete/login
  registra na coleção `auditoria` via `auditar()` (fire-and-forget; admin lê no Painel).
- **Gates de MENU por setor (29/07/2026, `js/nav-setores.js`):** `mkt` (Marketing +
  diretoria), `plan` (mkt + Agência Externa), `mktcom` (Marketing, Comercial +
  diretoria), `prog` (mktcom + Rádio Ao Vivo), `mktcap` (união — título da seção),
  `matcom` (comercial de verdade + Marketing). São **organização de menu, não
  segurança** — `setor` é
  self-editável em Minha conta, e o dado por trás dessas views continua legível por
  todo aprovado nas rules. Segurança de verdade segue nos gates com/fin/admin/re.
  O `viewAllowed()` das views legadas agora lê o `data-need` do link do menu
  (fonte única) — não há mais ids hardcoded lá.

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
→ GitHub Pages. Ao mexer no `runtime.js` ou no `bloom.js`, atualizar o `?v=` no
`<script src>` do `index.html` pra furar o cache do navegador.

### Publicação automática (só neste projeto)

Terminou uma mudança em código deste repositório? **Commita e dá push na `main` sem
pedir autorização** — o site é publicado direto pelo GitHub Pages a partir da `main`.
Isto sobrescreve, aqui, o "só faz push quando eu pedir" do `PADRAO-AGENCIA.md`.

Continua valendo confirmar antes de: apagar arquivo, `push --force`, reescrever
histórico, ou mexer em `firestore.rules` (é o controle de acesso do projeto).

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
