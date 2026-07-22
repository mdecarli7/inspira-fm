# CLAUDE.md — Rádio Inspira FM

@../../_padroes/PADRAO-AGENCIA.md

## Este projeto

- **Cliente:** Rádio Inspira FM (Inspira FM 97.7)
- **Grupo:** —
- **O que é:** plataforma web interna da **Diretoria de Marketing** da Inspira FM —
  relatórios, análises, gestão de conteúdo, processos e financeiro num só lugar.
  Uso interno da equipe, acesso restrito.
- **URL:** https://mdecarli7.github.io/inspira-fm/ (protegido por senha)
- **Repositório:** este (`inspira-fm`), publicado via GitHub Pages.
- **Design System:** `assets/design-system/` (tokens + fontes + logos). Ver README de lá.

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
  - **Equipe** — dados da equipe.
- **Administração** (acesso restrito):
  - **Jurídico** — modelos de contrato em papel timbrado: embaixador, colunista, influenciador,
    equipe, patrocínio, permuta, imagem, NDA.
  - **Usuários** — gestão de acessos e papéis.
- **Balanço Financeiro** — página protegida por **segunda senha** própria.

## Stack específica

- HTML/CSS/JS estático, arquivo único (`index.html`), fontes embutidas.
- **Firebase Auth** (login Google + e-mail/senha) + **Firestore** para dados dinâmicos
  (campanhas, destaques, projetos de estruturação, processos, usuários, radar, quadros, programação).
- **Papéis:** pendente → colaborador → diretor → admin. Páginas restritas por papel
  (gates `data-need` = re / fin / admin). Cadastro novo entra como *pendente* até liberação.

## Segurança do conteúdo (versão publicada)

- `build.js` lê o **fonte em texto plano**, criptografa o conteúdo com **AES-256-GCM**
  (chave PBKDF2) e gera o `index.html` publicado — o conteúdo não é legível nem no source.
- Dois payloads: **APP** (senha de acesso) e **Balanço Financeiro** (2ª senha, separada).
- As **senhas ficam só no `build.js` local** (gitignored). Nunca commitar senha, nunca
  colocar senha/conteúdo financeiro em `.md`, README ou Obsidian.
- O default do fonte no `build.js` foi corrigido pra `Desktop/Aprovado.ai/inspira-fm-relatorios.html`
  (era `Claude 1.0`, pasta renomeada). ⚠️ **O arquivo-fonte não está mais em disco** nesta máquina —
  repor em `Aprovado.ai/` (ou passar o caminho como argumento: `node build.js <fonte>`) antes de buildar.

## Fluxo de atualização

1. Editar o fonte plaintext local. 2. `node build.js [fonte] [fonts-inline.css]` →
   gera `index.html` (criptografa + embute fontes). 3. `git push` → GitHub Pages. Link não muda.

- **Não sobem** (`.gitignore`): `build.js`, `fonts-inline.css`, `*.local.html`, `seed.html`,
  `site-src/`, `firestore.rules`, `build-firebase.js`.
- Track paralelo/legado (versão Firebase-seed da grade da rádio): `seed.html` +
  `build-firebase.js` + `site-src/`. Não é a versão publicada atual.

## Ligado ao Obsidian

- Dashboard: `Matheus 1.0 obsidian → 01 - Clientes → Radio Inspira FM` → [[_Rádio Inspira FM]]
- Design System: [[_Rádio Inspira FM — Design System]]
- Plataforma interna: [[Rádio Inspira FM — Plataforma Interna]]
