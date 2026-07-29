'use strict';
/* =====================================================================
 * comercial-clientes.js — Carteira de clientes + negócios (view #clientes)
 * CRM da área comercial: quem é o cliente, em que pé está a relação, e os
 * negócios (pipeline) de cada um. Carrega DEPOIS de runtime.js, base-org.js
 * e comercial-core.js — usa os globais deles (col, canCom, COM_ETAPAS,
 * CLI_STATUS, COM_CFG, escHtml, btnBusy, flashMsg, fmtBRL, auditar...).
 * Nada de preço, produto ou empresa em código: tudo vem de config/comercial
 * e dos docs do Firestore (o repositório é público).
 * ===================================================================== */

registrarModulo({ id: 'clientes', need: 'com', init: cliInit });

/* ---- estado ---- */
var cliBound = false;
var CLI_ROWS = [], NEG_ROWS = [];
var CLI_TAB = 'todos', CLI_Q = '';
var CLI_SEL = null;    // id do cliente com a ficha aberta
var CLI_EDIT = null;   // { id, d } no form de cliente (id null = novo)
var NEG_EDIT = null;   // { id, d } no form de negócio (id null = novo)

/* abas → conjunto de status do cliente que cada uma mostra (null = todos) */
var CLI_ABAS = [
  ['todos', 'Todos', null],
  ['prospeccao', 'Prospecção', ['prospecto', 'contato']],
  ['proposta', 'Em proposta', ['proposta', 'negociacao']],
  ['ativos', 'Ativos', ['ativo']],
  ['parados', 'Parados', ['pausado', 'perdido']]
];

/* ---- entrada ---- */
function cliInit(){
  if(!canCom()) return;
  if(!cliBound){
    cliBound = true;
    cliMarkup();
    cliBind();
  }
  /* selects de categoria/produto dependem do config/comercial */
  comCfgCarregar().then(function(){ cliSelectsRender(); cliRender(); });
  cliListen();
  negListen();
  cliRender();
}

/* ---- markup (injetado no 1º acesso; a section no index é casca vazia) ---- */
function cliOpts(lista){
  return lista.map(function(par){ return '<option value="' + par[0] + '">' + par[1] + '</option>'; }).join('');
}
function cliMarkup(){
  var abas = CLI_ABAS.map(function(a, i){
    return '<button type="button" data-clitab="' + a[0] + '"' + (i === 0 ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' +
      a[1] + ' <span class="radar-count" id="cliN-' + a[0] + '"></span></button>';
  }).join('');
  document.getElementById('view-clientes').innerHTML =
    '<div class="page-hero">' +
      '<svg class="waves" viewBox="0 0 1440 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<path class="wave-drift" d="M-80,110 C320,30 620,200 980,120 C1220,68 1380,140 1520,90 L1520,-60 L-80,-60 Z" fill="var(--teal-800)"/>' +
        '<path class="wave-drift w2" d="M-100,560 C300,480 660,640 1040,550 C1260,500 1420,570 1540,530 L1540,720 L-100,720 Z" fill="var(--teal-950)"/>' +
      '</svg>' +
      '<div class="wrap">' +
        '<p class="crumb">Comercial · Carteira</p>' +
        '<h1 id="cli-title">Clientes</h1>' +
        '<p class="sub">Carteira de clientes e pipeline de negócios — do primeiro contato ao contrato fechado.</p>' +
      '</div>' +
    '</div>' +
    '<div class="section"><div class="wrap">' +
      '<div class="camp-tabs" id="cliTabs">' + abas + '</div>' +
      '<div class="proj-toolbar">' +
        '<h3 style="margin:0">Carteira</h3>' +
        '<button type="button" class="btn primary" id="cliNovo">+ Adicionar cliente</button>' +
      '</div>' +
      '<div class="radar-busca">' +
        '<label for="cliBusca" class="sr-only">Buscar na carteira</label>' +
        '<input id="cliBusca" class="fin-input" type="search" autocomplete="off" placeholder="Buscar por nome, contato, categoria ou cidade">' +
        '<span class="radar-count" id="cliCount"></span>' +
      '</div>' +
      cliFormHtml() +
      cliFichaHtml() +
      '<div class="tbl-scroll" id="cliTable"><div class="load-note">Carregando…</div></div>' +
    '</div></div>';
}
function cliFormHtml(){
  return '<div id="cliForm" hidden style="margin-bottom:1.6rem">' +
    '<div class="cp-row">' +
      '<div class="field"><label for="cliFNome">Nome / razão social</label><input id="cliFNome" class="fin-input"></div>' +
      '<div class="field"><label for="cliFFantasia">Nome fantasia</label><input id="cliFFantasia" class="fin-input"></div>' +
      '<div class="field"><label for="cliFCnpj">CNPJ</label><input id="cliFCnpj" class="fin-input" placeholder="00.000.000/0000-00"></div>' +
    '</div>' +
    '<div class="cp-row">' +
      '<div class="field"><label for="cliFCat">Categoria</label><select id="cliFCat" class="fin-input"><option value="">— sem categoria —</option><option value="__outra__">Outra…</option></select></div>' +
      '<div class="field" id="cliFCatOutraField" hidden><label for="cliFCatOutra">Qual categoria?</label><input id="cliFCatOutra" class="fin-input" placeholder="ex.: imobiliária"></div>' +
      '<div class="field"><label for="cliFCidade">Cidade</label><input id="cliFCidade" class="fin-input"></div>' +
      '<div class="field"><label for="cliFInsta">Instagram</label><input id="cliFInsta" class="fin-input" placeholder="@perfil"></div>' +
    '</div>' +
    '<div class="cp-row">' +
      '<div class="field"><label for="cliFContato">Contato (nome)</label><input id="cliFContato" class="fin-input"></div>' +
      '<div class="field"><label for="cliFCargo">Cargo do contato</label><input id="cliFCargo" class="fin-input" placeholder="ex.: sócio, marketing"></div>' +
      '<div class="field"><label for="cliFTel">Telefone / WhatsApp</label><input id="cliFTel" class="fin-input"></div>' +
      '<div class="field"><label for="cliFEmail">E-mail</label><input id="cliFEmail" class="fin-input" type="email"></div>' +
    '</div>' +
    '<div class="cp-row">' +
      '<div class="field"><label for="cliFOrigem">Origem</label><select id="cliFOrigem" class="fin-input">' + cliOpts(CLI_ORIGENS) + '</select></div>' +
      '<div class="field"><label for="cliFStatus">Status</label><select id="cliFStatus" class="fin-input">' + cliOpts(CLI_STATUS) + '</select></div>' +
      '<div class="field"><label for="cliFResp">Responsável</label><input id="cliFResp" class="fin-input"></div>' +
    '</div>' +
    '<div class="field"><label for="cliFObs">Observações</label><textarea id="cliFObs" class="fin-input" rows="3" style="resize:vertical"></textarea></div>' +
    '<div class="proj-actions">' +
      '<button type="button" class="btn primary" id="cliSalvar">Salvar cliente</button>' +
      '<button type="button" class="btn ghost" id="cliCancelar">Cancelar</button>' +
      '<button type="button" class="btn ghost danger" id="cliExcluir" hidden>Excluir</button>' +
      '<span class="fin-msg" id="cliMsg" role="status" aria-live="polite"></span>' +
    '</div>' +
  '</div>';
}
function cliFichaHtml(){
  return '<div id="cliFicha" hidden style="margin-bottom:1.6rem">' +
    '<div class="proj-toolbar">' +
      '<h3 style="margin:0" id="cliFichaNome">—</h3>' +
      '<span>' +
        '<button type="button" class="btn ghost" id="cliFichaEditar">Editar</button> ' +
        '<button type="button" class="btn ghost" id="cliFichaFechar">Fechar</button>' +
      '</span>' +
    '</div>' +
    '<div class="tbl-scroll"><table class="users-table"><tbody id="cliFichaDados"></tbody></table></div>' +
    '<div class="proj-toolbar" style="margin-top:1.2rem">' +
      '<h3 style="margin:0">Negócios <span class="radar-count" id="negCount"></span></h3>' +
      '<button type="button" class="btn primary" id="negNovo">+ Novo negócio</button>' +
    '</div>' +
    negFormHtml() +
    '<div class="tbl-scroll" id="negLista"><div class="load-note">Carregando…</div></div>' +
  '</div>';
}
function negFormHtml(){
  return '<div id="negForm" hidden style="margin:1rem 0 1.6rem">' +
    '<div class="cp-row">' +
      '<div class="field"><label for="negFEtapa">Etapa</label><select id="negFEtapa" class="fin-input">' + cliOpts(COM_ETAPAS) + '</select></div>' +
      '<div class="field" id="negFProdutoField"><label for="negFProduto">Produto</label><select id="negFProduto" class="fin-input"></select></div>' +
      '<div class="field" id="negFProdutoNomeField" hidden><label for="negFProdutoNome">Nome do produto</label><input id="negFProdutoNome" class="fin-input" placeholder="ex.: patrocínio de quadro"></div>' +
    '</div>' +
    '<div class="cp-row">' +
      '<div class="field"><label for="negFValor">Valor mensal (R$)</label><input id="negFValor" class="fin-input" type="number" min="0" step="0.01"></div>' +
      '<div class="field"><label for="negFMeses">Meses de contrato</label><input id="negFMeses" class="fin-input" type="number" min="1" step="1"><span class="radar-count" id="negFMesesAviso"></span></div>' +
      '<div class="field"><label for="negFTotal">Total do contrato</label><b id="negFTotal" style="padding:.55rem 0">R$ 0,00</b></div>' +
    '</div>' +
    '<div class="cp-row">' +
      '<div class="field"><label for="negFPasso">Próximo passo</label><input id="negFPasso" class="fin-input" placeholder="ex.: enviar proposta revisada"></div>' +
      '<div class="field"><label for="negFPassoData">Data do próximo passo</label><input id="negFPassoData" class="fin-input" type="date"></div>' +
      '<div class="field"><label for="negFCamp">Campanha ligada (id)</label><input id="negFCamp" class="fin-input" placeholder="opcional"></div>' +
    '</div>' +
    '<div class="cp-row" id="negFMotivoRow" hidden>' +
      '<div class="field" style="flex:1"><label for="negFMotivo">Motivo da perda</label><input id="negFMotivo" class="fin-input" placeholder="ex.: fechou com concorrente, orçamento"></div>' +
    '</div>' +
    '<div class="proj-actions">' +
      '<button type="button" class="btn primary" id="negSalvar">Salvar negócio</button>' +
      '<button type="button" class="btn ghost" id="negCancelar">Cancelar</button>' +
      '<button type="button" class="btn ghost danger" id="negExcluir" hidden>Excluir</button>' +
      '<span class="fin-msg" id="negMsg" role="status" aria-live="polite"></span>' +
    '</div>' +
  '</div>';
}

/* ---- eventos (uma vez; todo o esqueleto é estático) ---- */
function cliBind(){
  document.getElementById('cliTabs').addEventListener('click', function(ev){
    var b = ev.target.closest('[data-clitab]'); if(!b) return;
    cliTabSet(b.dataset.clitab);
  });
  document.getElementById('cliBusca').addEventListener('input', function(){ CLI_Q = this.value; cliRender(); });
  document.getElementById('cliNovo').addEventListener('click', function(){ cliOpen(null, {}); });
  document.getElementById('cliSalvar').addEventListener('click', cliSave);
  document.getElementById('cliCancelar').addEventListener('click', function(){
    CLI_EDIT = null;
    document.getElementById('cliForm').hidden = true;
  });
  document.getElementById('cliExcluir').addEventListener('click', cliDelete);
  document.getElementById('cliFCat').addEventListener('change', cliCatToggle);
  document.getElementById('cliTable').addEventListener('click', function(ev){
    var tr = ev.target.closest('[data-cliid]'); if(!tr) return;
    cliFichaAbrir(tr.getAttribute('data-cliid'));
  });
  document.getElementById('cliFichaFechar').addEventListener('click', cliFichaFechar);
  document.getElementById('cliFichaEditar').addEventListener('click', function(){
    var r = cliPorId(CLI_SEL);
    if(r) cliOpen(r.id, r.d);
  });
  document.getElementById('negNovo').addEventListener('click', function(){
    if(CLI_SEL) negOpen(null, {});
  });
  document.getElementById('negSalvar').addEventListener('click', negSave);
  document.getElementById('negCancelar').addEventListener('click', function(){
    NEG_EDIT = null;
    document.getElementById('negForm').hidden = true;
  });
  document.getElementById('negExcluir').addEventListener('click', negDelete);
  document.getElementById('negLista').addEventListener('click', function(ev){
    var b = ev.target.closest('[data-negedit]'); if(!b) return;
    var row = null;
    NEG_ROWS.forEach(function(r){ if(r.id === b.dataset.negedit) row = r; });
    if(row) negOpen(row.id, row.d);
  });
  document.getElementById('negFEtapa').addEventListener('change', negMotivoToggle);
  document.getElementById('negFProduto').addEventListener('change', negProdutoChange);
  document.getElementById('negFValor').addEventListener('input', negTotalAtualizar);
  document.getElementById('negFMeses').addEventListener('input', function(){ negMesesAviso(); negTotalAtualizar(); });
}
function cliTabSet(t){
  CLI_TAB = t;
  document.querySelectorAll('[data-clitab]').forEach(function(b){
    b.classList.toggle('on', b.dataset.clitab === t);
    b.setAttribute('aria-pressed', b.dataset.clitab === t ? 'true' : 'false');
  });
  cliRender();
}

/* ---- streams ---- */
function cliListen(){
  if(UNSUB.cli) return;
  UNSUB.cli = col('clientes').orderBy('atualizadoEm', 'desc').onSnapshot(function(qs){
    CLI_ROWS = [];
    qs.forEach(function(doc){ CLI_ROWS.push({ id: doc.id, d: doc.data() }); });
    cliRender();
    /* ficha aberta acompanha o dado vivo; cliente sumiu = fecha */
    if(CLI_SEL){
      if(cliPorId(CLI_SEL)) cliFichaRender();
      else cliFichaFechar();
    }
  }, function(){
    var host = document.getElementById('cliTable');
    if(host) host.innerHTML = '<div class="load-note">Sem acesso — a flag verComercial foi liberada e as regras publicadas?</div>';
  });
}
function negListen(){
  if(UNSUB.neg) return;
  UNSUB.neg = col('negocios').orderBy('atualizadoEm', 'desc').onSnapshot(function(qs){
    NEG_ROWS = [];
    qs.forEach(function(doc){ NEG_ROWS.push({ id: doc.id, d: doc.data() }); });
    if(CLI_SEL) negRender();
  }, function(){
    var host = document.getElementById('negLista');
    if(host) host.innerHTML = '<div class="load-note">Sem acesso — a flag verComercial foi liberada e as regras publicadas?</div>';
  });
}

/* ---- utilidades ---- */
function cliPorId(id){
  for(var i = 0; i < CLI_ROWS.length; i++) if(CLI_ROWS[i].id === id) return CLI_ROWS[i];
  return null;
}
function cliAbaStatus(t){
  for(var i = 0; i < CLI_ABAS.length; i++) if(CLI_ABAS[i][0] === t) return CLI_ABAS[i][2];
  return null;
}
function cliDataBr(iso){
  if(!iso) return '';
  var p = String(iso).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso);
}
function cliQuando(ts){
  return ts && ts.toDate ? ts.toDate().toLocaleDateString('pt-BR') : '—';
}
function negDoCliente(id){
  return NEG_ROWS.filter(function(r){ return r.d.clienteId === id; });
}

/* ---- selects que dependem do config/comercial ---- */
function cliSelectsRender(){
  var cats = (COM_CFG && COM_CFG.categorias) || [];
  var sel = document.getElementById('cliFCat');
  if(sel){
    var atual = sel.value;
    sel.innerHTML = '<option value="">— sem categoria —</option>' +
      cats.map(function(c){
        var n = typeof c === 'string' ? c : ((c && c.nome) || '');
        return n ? '<option value="' + escHtml(n) + '">' + escHtml(n) + '</option>' : '';
      }).join('') +
      '<option value="__outra__">Outra…</option>';
    if(atual) sel.value = atual;
  }
  var prods = (COM_CFG && COM_CFG.produtos) || [];
  var ps = document.getElementById('negFProduto');
  if(ps){
    var pAtual = ps.value;
    ps.innerHTML = prods.map(function(p){
      return '<option value="' + escHtml(p.id || '') + '">' + escHtml(p.nome || p.id || '') + '</option>';
    }).join('') + '<option value="">Outro produto…</option>';
    if(pAtual) ps.value = pAtual;
    /* sem produtos configurados: só o input livre faz sentido */
    document.getElementById('negFProdutoField').hidden = !prods.length;
  }
}
function cliCatToggle(){
  document.getElementById('cliFCatOutraField').hidden =
    document.getElementById('cliFCat').value !== '__outra__';
}

/* ---- tabela da carteira ---- */
function cliRender(){
  var host = document.getElementById('cliTable');
  if(!host) return;
  /* contadores por aba (sempre sobre a carteira inteira, sem a busca) */
  CLI_ABAS.forEach(function(a){
    var n = a[2]
      ? CLI_ROWS.filter(function(r){ return a[2].indexOf(r.d.status || 'prospecto') > -1; }).length
      : CLI_ROWS.length;
    var el = document.getElementById('cliN-' + a[0]);
    if(el) el.textContent = n;
  });
  var st = cliAbaStatus(CLI_TAB);
  var base = st ? CLI_ROWS.filter(function(r){ return st.indexOf(r.d.status || 'prospecto') > -1; }) : CLI_ROWS;
  var q = (CLI_Q || '').trim().toLowerCase();
  var rows = base.filter(function(r){
    var d = r.d;
    return embHit(q, [d.nome, d.nomeFantasia, d.contatoNome, d.categoria, d.cidade]);
  });
  var count = document.getElementById('cliCount');
  if(count) count.textContent = q
    ? rows.length + ' de ' + base.length + (base.length === 1 ? ' resultado' : ' resultados')
    : base.length + (base.length === 1 ? ' cliente' : ' clientes');
  if(!rows.length){
    host.innerHTML = q
      ? '<div class="proj-empty">Nenhum cliente encontrado para “' + escHtml(CLI_Q) + '”.</div>'
      : '<div class="proj-empty">Nenhum cliente aqui ainda. Clique em <b>+ Adicionar cliente</b>.</div>';
    return;
  }
  host.innerHTML = '<table class="users-table"><thead><tr>' +
    '<th scope="col">Nome</th><th scope="col">Categoria</th><th scope="col">Contato</th>' +
    '<th scope="col">Status</th><th scope="col">Responsável</th><th scope="col">Atualizado</th>' +
    '</tr></thead><tbody>' +
    rows.map(function(r){
      var d = r.d;
      return '<tr data-cliid="' + escHtml(r.id) + '" style="cursor:pointer">' +
        '<td><b>' + escHtml(d.nome || '—') + '</b>' +
          (d.nomeFantasia ? '<br><small style="color:var(--muted)">' + escHtml(d.nomeFantasia) + '</small>' : '') + '</td>' +
        '<td>' + escHtml(d.categoria || '—') + '</td>' +
        '<td>' + escHtml(d.contatoNome || '—') +
          (d.telefone ? '<br><small style="color:var(--muted)">' + escHtml(d.telefone) + '</small>' : '') + '</td>' +
        '<td><span class="pill">' + escHtml(comRotulo(CLI_STATUS, d.status || 'prospecto')) + '</span></td>' +
        '<td>' + escHtml(d.responsavelNome || '—') + '</td>' +
        '<td>' + cliQuando(d.atualizadoEm) + '</td></tr>';
    }).join('') + '</tbody></table>';
}

/* ---- ficha do cliente ---- */
function cliFichaAbrir(id){
  CLI_SEL = id;
  /* troca de cliente derruba forms abertos pra não salvar no lugar errado */
  CLI_EDIT = null;
  document.getElementById('cliForm').hidden = true;
  NEG_EDIT = null;
  document.getElementById('negForm').hidden = true;
  cliFichaRender();
  negRender();
  var f = document.getElementById('cliFicha');
  f.hidden = false;
  f.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}
function cliFichaFechar(){
  CLI_SEL = null;
  NEG_EDIT = null;
  document.getElementById('negForm').hidden = true;
  document.getElementById('cliFicha').hidden = true;
}
function cliFichaRender(){
  var r = cliPorId(CLI_SEL);
  if(!r){ cliFichaFechar(); return; }
  var d = r.d;
  document.getElementById('cliFichaNome').textContent =
    (d.nome || '—') + (d.nomeFantasia ? ' · ' + d.nomeFantasia : '');
  function linha(rot, val){
    return '<tr><th scope="row" style="text-align:left;white-space:nowrap">' + rot + '</th><td>' + (val || '—') + '</td></tr>';
  }
  document.getElementById('cliFichaDados').innerHTML =
    linha('Status', '<span class="pill">' + escHtml(comRotulo(CLI_STATUS, d.status || 'prospecto')) + '</span>') +
    linha('Categoria', escHtml(d.categoria || '')) +
    linha('Contato', escHtml(d.contatoNome || '') + (d.contatoCargo ? ' <small style="color:var(--muted)">(' + escHtml(d.contatoCargo) + ')</small>' : '')) +
    linha('Telefone', escHtml(d.telefone || '')) +
    linha('E-mail', escHtml(d.email || '')) +
    linha('Instagram', escHtml(d.instagram || '')) +
    linha('Cidade', escHtml(d.cidade || '')) +
    linha('CNPJ', escHtml(d.cnpj || '')) +
    linha('Origem', escHtml(comRotulo(CLI_ORIGENS, d.origem || ''))) +
    linha('Responsável', escHtml(d.responsavelNome || '')) +
    linha('Observações', d.obs ? escHtml(d.obs).replace(/\n/g, '<br>') : '') +
    linha('Atualizado', cliQuando(d.atualizadoEm) + (d.atualizadoPor ? ' por ' + escHtml(d.atualizadoPor) : ''));
}

/* ---- lista de negócios da ficha ---- */
function negRender(){
  var host = document.getElementById('negLista');
  if(!host || !CLI_SEL) return;
  var rows = negDoCliente(CLI_SEL);
  var count = document.getElementById('negCount');
  if(count) count.textContent = rows.length ? rows.length : '';
  if(!rows.length){
    host.innerHTML = '<div class="proj-empty">Nenhum negócio ainda. Clique em <b>+ Novo negócio</b>.</div>';
    return;
  }
  host.innerHTML = '<table class="users-table"><thead><tr>' +
    '<th scope="col">Etapa</th><th scope="col">Produto</th><th scope="col">Contrato</th><th scope="col">Próximo passo</th><th scope="col"></th>' +
    '</tr></thead><tbody>' +
    rows.map(function(r){
      var d = r.d;
      var v = +d.valorMensal || 0, m = +d.meses || 0, t = +d.valorTotal || 0;
      var dias = comDiasAte(d.proximoPassoData);
      var atrasado = dias !== null && dias < 0;
      var passo = escHtml(d.proximoPasso || '—') +
        (d.proximoPassoData
          ? '<br><small style="' + (atrasado ? 'color:#c62828;font-weight:700' : 'color:var(--muted)') + '">' +
            cliDataBr(d.proximoPassoData) + (atrasado ? ' — atrasado' : '') + '</small>'
          : '');
      if(d.etapa === 'perdido' && d.motivoPerda)
        passo += '<br><small style="color:var(--muted)">Perda: ' + escHtml(d.motivoPerda) + '</small>';
      return '<tr>' +
        '<td><span class="pill">' + escHtml(comRotulo(COM_ETAPAS, d.etapa || 'novo')) + '</span></td>' +
        '<td><b>' + escHtml(d.produtoNome || '—') + '</b></td>' +
        '<td style="white-space:nowrap">R$ ' + fmtBRL(v) + ' × ' + m + (m === 1 ? ' mês' : ' meses') + ' = <b>R$ ' + fmtBRL(t) + '</b></td>' +
        '<td>' + passo + '</td>' +
        '<td><button type="button" class="mini" data-negedit="' + escHtml(r.id) + '">Editar</button></td></tr>';
    }).join('') + '</tbody></table>';
}

/* ---- form de cliente ---- */
function cliOpen(id, d){
  CLI_EDIT = { id: id, d: d || {} };
  d = d || {};
  document.getElementById('cliFNome').value = d.nome || '';
  document.getElementById('cliFFantasia').value = d.nomeFantasia || '';
  document.getElementById('cliFCnpj').value = d.cnpj || '';
  var cat = document.getElementById('cliFCat');
  var catOutra = document.getElementById('cliFCatOutra');
  cat.value = d.categoria || '';
  catOutra.value = '';
  if(d.categoria && cat.value !== d.categoria){
    /* categoria fora da lista do config → cai no "Outra…" com input livre */
    cat.value = '__outra__';
    catOutra.value = d.categoria;
  }
  cliCatToggle();
  document.getElementById('cliFCidade').value = d.cidade || '';
  document.getElementById('cliFInsta').value = d.instagram || '';
  document.getElementById('cliFContato').value = d.contatoNome || '';
  document.getElementById('cliFCargo').value = d.contatoCargo || '';
  document.getElementById('cliFTel').value = d.telefone || '';
  document.getElementById('cliFEmail').value = d.email || '';
  document.getElementById('cliFOrigem').value = d.origem || 'prospeccao';
  document.getElementById('cliFStatus').value = d.status || 'prospecto';
  document.getElementById('cliFResp').value = d.responsavelNome || ME.nome || ME.email;
  document.getElementById('cliFObs').value = d.obs || '';
  document.getElementById('cliExcluir').hidden = !id || !canRe();
  var f = document.getElementById('cliForm');
  f.hidden = false;
  f.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  document.getElementById('cliFNome').focus();
}
function cliSave(){
  if(!CLI_EDIT) return;
  var nome = document.getElementById('cliFNome').value.trim();
  if(!nome){ flashMsg('cliMsg', 'Informe o nome do cliente.'); return; }
  var catSel = document.getElementById('cliFCat').value;
  var categoria = catSel === '__outra__' ? document.getElementById('cliFCatOutra').value.trim() : catSel;
  /* responsável: uid só quando dá pra afirmar quem é (eu, ou o que já estava) */
  var respNome = document.getElementById('cliFResp').value.trim() || ME.nome || ME.email;
  var respUid = '';
  if(CLI_EDIT.id && respNome === (CLI_EDIT.d.responsavelNome || '')) respUid = CLI_EDIT.d.responsavelUid || '';
  else if(respNome === (ME.nome || ME.email)) respUid = ME.uid;
  var doc = {
    nome: nome,
    nomeFantasia: document.getElementById('cliFFantasia').value.trim(),
    cnpj: document.getElementById('cliFCnpj').value.trim(),
    categoria: categoria,
    contatoNome: document.getElementById('cliFContato').value.trim(),
    contatoCargo: document.getElementById('cliFCargo').value.trim(),
    telefone: document.getElementById('cliFTel').value.trim(),
    email: document.getElementById('cliFEmail').value.trim(),
    instagram: document.getElementById('cliFInsta').value.trim(),
    cidade: document.getElementById('cliFCidade').value.trim(),
    origem: document.getElementById('cliFOrigem').value,
    status: document.getElementById('cliFStatus').value,
    responsavelUid: respUid,
    responsavelNome: respNome,
    obs: document.getElementById('cliFObs').value.trim(),
    atualizadoPor: ME.nome || ME.email,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  };
  var btn = document.getElementById('cliSalvar');
  btnBusy(btn, true);
  var novo = !CLI_EDIT.id;
  var op = CLI_EDIT.id
    ? col('clientes').doc(CLI_EDIT.id).set(doc, { merge: true })
    : col('clientes').add(Object.assign({ criadoEm: firebase.firestore.FieldValue.serverTimestamp() }, doc));
  op.then(function(ref){
    var id = (ref && ref.id) || (CLI_EDIT && CLI_EDIT.id) || '';
    auditar(novo ? 'criar' : 'editar', 'clientes', id, doc.nome);
    if(!novo) negSyncNome(id, doc.nome);
    CLI_EDIT = null;
    document.getElementById('cliForm').hidden = true;
    liveAnnounce('Cliente salvo.');
  }).catch(function(){ flashMsg('cliMsg', 'Sem permissão para salvar.'); })
    .finally(function(){ btnBusy(btn, false); });
}
/* clienteNome é denormalizado nos negócios: renomeou o cliente, corrige lá também */
function negSyncNome(id, nome){
  var alvo = NEG_ROWS.filter(function(r){ return r.d.clienteId === id && r.d.clienteNome !== nome; });
  if(!alvo.length) return;
  var b = db.batch();
  alvo.forEach(function(r){ b.update(col('negocios').doc(r.id), { clienteNome: nome }); });
  b.commit().catch(function(){ /* melhor esforço; o stream corrige a UI */ });
}
function cliDelete(){
  if(!CLI_EDIT || !CLI_EDIT.id || !canRe()) return;
  var id = CLI_EDIT.id;
  var nome = CLI_EDIT.d.nome || '';
  var negs = negDoCliente(id);
  if(!confirm('Excluir o cliente "' + nome + '"' +
    (negs.length ? ' e os ' + negs.length + ' negócios dele' : '') + '? Não dá pra desfazer.')) return;
  var b = db.batch();
  b.delete(col('clientes').doc(id));
  negs.forEach(function(r){ b.delete(col('negocios').doc(r.id)); });
  b.commit().then(function(){
    auditar('apagar', 'clientes', id, nome + (negs.length ? ' (+' + negs.length + ' negócios)' : ''));
    CLI_EDIT = null;
    document.getElementById('cliForm').hidden = true;
    if(CLI_SEL === id) cliFichaFechar();
  }).catch(function(){ flashMsg('cliMsg', 'Sem permissão para excluir.'); });
}

/* ---- form de negócio ---- */
function negOpen(id, d){
  NEG_EDIT = { id: id, d: d || {} };
  d = d || {};
  document.getElementById('negFEtapa').value = d.etapa || 'novo';
  var prods = (COM_CFG && COM_CFG.produtos) || [];
  var sel = document.getElementById('negFProduto');
  var livre = document.getElementById('negFProdutoNome');
  livre.value = d.produtoNome || '';
  if(prods.length){
    var alvo = d.produtoId || '';
    if(!id && !d.produtoNome) alvo = prods[0].id || '';
    sel.value = alvo;
    if(sel.value !== alvo) sel.value = '';  /* produtoId que saiu do config → "Outro" */
  }
  document.getElementById('negFValor').value = d.valorMensal != null && d.valorMensal !== '' ? d.valorMensal : '';
  var minM = (COM_CFG && COM_CFG.regras && COM_CFG.regras.contratoMinMeses) || 3;
  document.getElementById('negFMeses').value = d.meses || minM;
  document.getElementById('negFPasso').value = d.proximoPasso || '';
  document.getElementById('negFPassoData').value = d.proximoPassoData || '';
  document.getElementById('negFCamp').value = d.campanhaId || '';
  document.getElementById('negFMotivo').value = d.motivoPerda || '';
  document.getElementById('negExcluir').hidden = !id || !canRe();
  negProdutoToggle();
  if(!id && sel.value) negProdutoChange();  /* novo com produto default → puxa o preço da tabela */
  negMotivoToggle();
  negMesesAviso();
  negTotalAtualizar();
  var f = document.getElementById('negForm');
  f.hidden = false;
  f.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  document.getElementById('negFEtapa').focus();
}
function negProdutoToggle(){
  var prods = (COM_CFG && COM_CFG.produtos) || [];
  var sel = document.getElementById('negFProduto');
  document.getElementById('negFProdutoNomeField').hidden = !!(prods.length && sel.value);
}
function negProdutoChange(){
  negProdutoToggle();
  var p = comProduto(document.getElementById('negFProduto').value);
  if(p && p.valorMensal != null){
    document.getElementById('negFValor').value = p.valorMensal;
    negTotalAtualizar();
  }
}
function negMotivoToggle(){
  document.getElementById('negFMotivoRow').hidden =
    document.getElementById('negFEtapa').value !== 'perdido';
}
function negMesesAviso(){
  var m = parseInt(document.getElementById('negFMeses').value, 10) || 0;
  var minM = (COM_CFG && COM_CFG.regras && COM_CFG.regras.contratoMinMeses) || 3;
  document.getElementById('negFMesesAviso').textContent =
    m > 0 && m < minM ? 'abaixo do contrato mínimo (' + minM + ' meses)' : '';
}
function negTotalAtualizar(){
  var v = parseFloat(document.getElementById('negFValor').value) || 0;
  var m = parseInt(document.getElementById('negFMeses').value, 10) || 0;
  document.getElementById('negFTotal').textContent = 'R$ ' + fmtBRL(Math.round(v * m * 100) / 100);
}
function negSave(){
  if(!NEG_EDIT || !CLI_SEL) return;
  var cliRow = cliPorId(CLI_SEL);
  if(!cliRow){ flashMsg('negMsg', 'Cliente não encontrado.'); return; }
  var etapa = document.getElementById('negFEtapa').value;
  var prods = (COM_CFG && COM_CFG.produtos) || [];
  var produtoId = prods.length ? document.getElementById('negFProduto').value : '';
  var p = produtoId ? comProduto(produtoId) : null;
  var produtoNome = p ? (p.nome || p.id) : document.getElementById('negFProdutoNome').value.trim();
  if(!produtoNome){ flashMsg('negMsg', 'Informe o produto do negócio.'); return; }
  var valorMensal = parseFloat(document.getElementById('negFValor').value) || 0;
  var meses = parseInt(document.getElementById('negFMeses').value, 10) || 0;
  if(meses <= 0){ flashMsg('negMsg', 'Informe quantos meses de contrato.'); return; }
  /* exclusividade: 1 patrocinador por quadro — avisa, não bloqueia */
  if(etapa === 'ganho' && produtoId && p && p.exclusividadeCategoria){
    var outro = null;
    NEG_ROWS.forEach(function(r){
      if(!outro && r.id !== NEG_EDIT.id && r.d.etapa === 'ganho' &&
         r.d.produtoId === produtoId && r.d.clienteId !== CLI_SEL) outro = r;
    });
    if(outro && !confirm('Atenção: o quadro/produto "' + produtoNome + '" já tem patrocinador (' +
      (outro.d.clienteNome || 'outro cliente') + '). Regra: 1 patrocinador por quadro / exclusividade de categoria.\n\nSalvar mesmo assim?')) return;
  }
  var doc = {
    clienteId: CLI_SEL,
    clienteNome: cliRow.d.nome || '',
    etapa: etapa,
    produtoId: produtoId,
    produtoNome: produtoNome,
    valorMensal: valorMensal,
    meses: meses,
    valorTotal: Math.round(valorMensal * meses * 100) / 100,
    campanhaId: document.getElementById('negFCamp').value.trim(),
    responsavelUid: (NEG_EDIT.id && NEG_EDIT.d.responsavelUid) || ME.uid,
    responsavelNome: (NEG_EDIT.id && NEG_EDIT.d.responsavelNome) || ME.nome || ME.email,
    proximoPasso: document.getElementById('negFPasso').value.trim(),
    proximoPassoData: document.getElementById('negFPassoData').value,
    motivoPerda: etapa === 'perdido' ? document.getElementById('negFMotivo').value.trim() : '',
    atualizadoPor: ME.nome || ME.email,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  };
  var btn = document.getElementById('negSalvar');
  btnBusy(btn, true);
  var novo = !NEG_EDIT.id;
  var op = NEG_EDIT.id
    ? col('negocios').doc(NEG_EDIT.id).set(doc, { merge: true })
    : col('negocios').add(Object.assign({ criadoEm: firebase.firestore.FieldValue.serverTimestamp() }, doc));
  op.then(function(ref){
    auditar(novo ? 'criar' : 'editar', 'negocios', (ref && ref.id) || (NEG_EDIT && NEG_EDIT.id) || '',
      produtoNome + ' — ' + doc.clienteNome);
    NEG_EDIT = null;
    document.getElementById('negForm').hidden = true;
    liveAnnounce('Negócio salvo.');
  }).catch(function(){ flashMsg('negMsg', 'Sem permissão para salvar.'); })
    .finally(function(){ btnBusy(btn, false); });
}
function negDelete(){
  if(!NEG_EDIT || !NEG_EDIT.id || !canRe()) return;
  if(!confirm('Excluir este negócio para todos?')) return;
  var negId = NEG_EDIT.id;
  var rotulo = NEG_EDIT.d.produtoNome || '';
  col('negocios').doc(negId).delete().then(function(){
    auditar('apagar', 'negocios', negId, rotulo);
    NEG_EDIT = null;
    document.getElementById('negForm').hidden = true;
  }).catch(function(){ flashMsg('negMsg', 'Sem permissão para excluir.'); });
}
