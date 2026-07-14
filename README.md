# Inspira FM 97.7 — Relatórios da Diretoria

Site interno de apresentação dos relatórios da Diretoria de Marketing da Inspira FM 97.7.

- **Acesso:** https://mdecarli7.github.io/inspira-fm/ (protegido por senha)
- Todo o conteúdo (relatórios, organograma e balanço financeiro) está **criptografado com AES-256-GCM** dentro do `index.html`. Sem a senha, o conteúdo não pode ser lido — nem inspecionando o código-fonte.
- O Balanço Financeiro tem uma segunda senha própria, pedida a cada acesso.

## Estrutura

- `index.html` — site completo (arquivo único, conteúdo criptografado, fontes embutidas).

O arquivo-fonte em texto plano e o script de build **não** ficam neste repositório.

## Como atualizar

O site é gerado a partir de um arquivo-fonte local por um script de build que criptografa o conteúdo. Para alterar qualquer coisa (textos, tabelas, organograma, senhas), edite o fonte local, rode o build e faça push do novo `index.html`. O link não muda.
