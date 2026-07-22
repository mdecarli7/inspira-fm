# Inspira FM 97.7 — Plataforma interna da Diretoria

Plataforma web interna da Diretoria de Marketing da Inspira FM 97.7: análises,
gestão de conteúdo (programação, quadros, radar, campanhas), processos, jurídico
e equipe.

- **Acesso:** https://mdecarli7.github.io/inspira-fm/
- **Autenticação:** Firebase Auth (Google ou e-mail/senha). Cadastro novo entra
  como *pendente* até liberação por um admin.
- **Permissões por papel:** pendente → colaborador → diretor → admin. Páginas
  restritas via `data-need` (`re` / `fin` / `admin`).

## Estrutura

- `index.html` — casca do app: menu, tela de login e as 16 views.
- `runtime.js` — a aplicação (Firebase Auth + Firestore, CRUD de todas as seções).
- `firestore.rules` — as regras de autorização. **É aqui que mora a segurança do
  projeto**, não no HTML.
- `fonts/`, `img/` — fontes woff2 e logos consumidos pelo site.
- `assets/design-system/` — tokens de marca, fontes e logos oficiais.

O conteúdo dinâmico vive no Firestore, **não** no repositório. Três views
(`view-analise`, `view-organograma`, `view-financeiro`) têm o HTML servido dos
documentos `content/base` e `content/financeiro`.

## Segurança

O `index.html` publicado é casca pública, **sem conteúdo sensível e sem
criptografia**. Quem decide o que cada pessoa lê é o `firestore.rules`. A
`apiKey` do Firebase aparece em claro no `runtime.js` — isso é normal e esperado
num app web (é identificador, não credencial), mas significa que **qualquer furo
nas regras é um furo real**, alcançável direto pelo SDK, sem passar pela UI.

Nunca commitar: a folha salarial, o `seed.html`, senhas.

## Como atualizar

Não há build. Edite `index.html` / `runtime.js` e faça push — o GitHub Pages
publica. Ao alterar o `runtime.js`, atualize o `?v=` no
`<script src="runtime.js?v=…">` do `index.html` para invalidar o cache do
navegador. O link não muda.

Conteúdo (campanhas, quadros, radar, contratos, programação) é editado dentro do
próprio app.
