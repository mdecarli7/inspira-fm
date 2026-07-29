'use strict';
/* =====================================================================
 * comercial-contratos.js — Contratos do comercial (view #contratos, gate com)
 * O pós-venda do funil: o que está fechado, quanto entra por mês e o que
 * está chegando na janela de renovação (COM_CFG.regras.avisoPrevioDias).
 * Carrega depois de base-org.js e comercial-core.js; usa os globais deles
 * (col, canCom, comCfgCarregar/COM_CFG, comProduto, comDiasAte, comHoje,
 * comRotulo) e os do runtime (escHtml, btnBusy, flashMsg, fmtBRL, auditar,
 * UNSUB, canRe, ME).
 * Preço/produto NUNCA em código: tudo vem de config/comercial (Firestore).
 * ===================================================================== */

registrarModulo({ id: 'contratos', need: 'com', init: ctrInit });

var ctrBound = false, CTR_TAB = 'ativos', CTR = [], CTR_OK = false, CTR_EDIT = null;

var CTR_MODELOS = [
  ['patrocinio', 'Patrocínio'],
  ['permuta', 'Permuta'],
  ['outro', 'Outro']
];
var CTR_STATUS = [
  ['ativo', 'Ativo'],
  ['encerrado', 'Encerrado'],
  ['cancelado', 'Cancelado']
];

/* ---- entrada ---- */
function ctrInit(){
  if(!canCom()) return;
  if(!ctrBound){
    ctrBound = true;
    ctrMarkup();
    ctrBind();
  }
  /* a config traz a tabela de produtos (form) e o aviso prévio (aba A renovar) */
  comCfgCarregar().then(function(){
    ctrProdutoSelect();
    ctrRender();
  });
  ctrListen();
  ctrTabSet(CTR_TAB);
}

/* ---- markup (injetado no 1º acesso; a section no index é casca vazia) ---- */
function ctrMarkup(){
  document.getElementById('view-contratos').innerHTML =
    '<div class="page-hero">' +
      '<svg class="waves" viewBox="0 0 1440 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<path class="wave-drift" d="M-80,110 C320,30 620,200 980,120 C1220,68 1380,140 1520,90 L1520,-60 L-80,-60 Z" fill="var(--teal-800)"/>' +
        '<path class="wave-drift w2" d="M-100,560 C300,480 660,640 1040,550 C1260,500 1420,570 1540,530 L1540,720 L-100,720 Z" fill="var(--teal-950)"/>' +
      '</svg>' +
      '<div class="wrap">' +
        '<p class="crumb">Comercial · Contratos</p>' +
        '<h1 id="ctr-title">Contratos ativos</h1>' +
        '<p class="sub">O que está fechado, quanto entra por mês e o que precisa de atenção na renovação.</p>' +
      '</div>' +
    '</div>' +
    '<div class="section"><div class="wrap">' +
      '<div class="adm-kpis" id="ctrKpis"><div class="load-note">Carregando…</div></div>' +
      '<div class="camp-tabs" id="ctrTabs">' +
        '<button type="button" data-ctrtab="ativos" class="on">Ativos</button>' +
        '<button type="button" data-ctrtab="renovar">A renovar</button>' +
        '<button type="button" data-ctrtab="encerrados">Encerrados</button>' +
        '<button type="button" data-ctrtab="todos">Todos</button>' +
      '</div>' +
      '<p class="chart-note" style="margin-top:.8rem">' +
        '<button type="button" class="mini" id="ctrNovo">Novo contrato</button> ' +
        '<span id="ctrMsg"></span>' +
      '</p>' +
      ctrFormHtml() +
      '<div class="tbl-scroll"><table class="users-table"><thead><tr>' +
        '<th scope="col">Cliente</th><th scope="col">Produto</th><th scope="col">Valor/mês</th>' +
        '<th scope="col">Início</th><th scope="col">Fim</th><th scope="col">Status</th>' +
        '<th scope="col">Doc</th><th scope="col"></th>' +
      '</tr></thead><tbody id="ctrRows"><tr><td colspan="8" class="load-note">Carregando…</td></tr></tbody></table></div>' +
    '</div></div>';
}

function ctrFormHtml(){
  function ops(lista){
    return lista.map(function(x){ return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join('');
  }
  return '<div id="ctrForm" hidden style="border:1px solid var(--line);border-radius:.9rem;background:var(--surface);padding:1rem 1.3rem;margin:0 0 1rem">' +
    '<h3 id="ctrFTitulo" style="margin-top:0">Novo contrato</h3>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.6rem">' +
      '<label>Cliente*<input class="fin-input" id="ctrFCliente" maxlength="120"></label>' +
      '<label>Modelo jurídico<select class="fin-input" id="ctrFModelo">' + ops(CTR_MODELOS) + '</select></label>' +
      /* o select só aparece se config/comercial tiver produtos; senão vale o campo livre */
      '<label id="ctrFProdutoBox" hidden>Produto / quadro (tabela)<select class="fin-input" id="ctrFProduto"><option value="">—</option></select></label>' +
      '<label>Nome do produto<input class="fin-input" id="ctrFProdutoNome" maxlength="120"></label>' +
      '<label>Valor mensal (R$)<input class="fin-input" id="ctrFValor" type="number" min="0" step="0.01"></label>' +
      '<label>Início*<input class="fin-input" id="ctrFInicio" type="date"></label>' +
      '<label>Fim*<input class="fin-input" id="ctrFFim" type="date"></label>' +
      '<label>Status<select class="fin-input" id="ctrFStatus">' + ops(CTR_STATUS) + '</select></label>' +
      '<label>Doc assinado (link https)<input class="fin-input" id="ctrFLink" type="url" placeholder="https://…"></label>' +
      '<label>Id do cliente (opcional)<input class="fin-input" id="ctrFClienteId"></label>' +
      '<label>Id do negócio (opcional)<input class="fin-input" id="ctrFNegocioId"></label>' +
      '<label>Id da campanha (opcional)<input class="fin-input" id="ctrFCampanhaId"></label>' +
    '</div>' +
    '<label style="display:block;margin:.6rem 0 0">Observações<textarea class="fin-input" id="ctrFObs" rows="2" style="width:100%"></textarea></label>' +
    '<label style="display:block;margin:.5rem 0"><input type="checkbox" id="ctrFRenova"> Renovação automática</label>' +
    '<p style="margin:.6rem 0 0">' +
      '<button type="button" class="mini" id="ctrFSalvar">Salvar</button> ' +
      '<button type="button" class="mini" id="ctrFCancelar">Cancelar</button> ' +
      '<button type="button" class="mini" id="ctrFJur" hidden>Gerar contrato no Jurídico</button> ' +
      '<button type="button" class="mini" id="ctrFExcluir" hidden>Excluir</button>' +
    '</p>' +
  '</div>';
}

/* select de produtos alimentado por config/comercial (nunca hardcode) */
function ctrProdutoSelect(){
  var box = document.getElementById('ctrFProdutoBox');
  var sel = document.getElementById('ctrFProduto');
  if(!box || !sel) return;
  var ps = (COM_CFG && COM_CFG.produtos) || [];
  if(!ps.length){ box.hidden = true; return; }
  box.hidden = false;
  sel.innerHTML = '<option value="">— escolher da tabela —</option>' + ps.map(function(p){
    return '<option value="' + escHtml(p.id || '') + '">' + escHtml(p.nome || p.id || '') + '</option>';
  }).join('');
}

/* ---- eventos ---- */
function ctrBind(){
  document.getElementById('ctrTabs').addEventListener('click', function(ev){
    var b = ev.target.closest('[data-ctrtab]'); if(!b) return;
    ctrTabSet(b.dataset.ctrtab);
  });
  document.getElementById('ctrNovo').addEventListener('click', function(){ ctrFormAbrir(null); });
  document.getElementById('ctrRows').addEventListener('click', function(ev){
    var b = ev.target.closest('[data-edit]'); if(!b) return;
    ctrFormAbrir(b.dataset.edit);
  });
  document.getElementById('ctrFProduto').addEventListener('change', ctrProdutoEscolhido);
  document.getElementById('ctrFSalvar').addEventListener('click', ctrSalvar);
  document.getElementById('ctrFCancelar').addEventListener('click', ctrFormFechar);
  document.getElementById('ctrFExcluir').addEventListener('click', ctrExcluir);
  document.getElementById('ctrFJur').addEventListener('click', ctrGerarJuridico);
}
function ctrTabSet(t){
  CTR_TAB = t;
  document.querySelectorAll('#ctrTabs [data-ctrtab]').forEach(function(b){
    b.classList.toggle('on', b.dataset.ctrtab === t);
  });
  ctrRender();
}

/* ---- stream ---- */
function ctrListen(){
  if(UNSUB.ctr) return;
  UNSUB.ctr = col('contratos').orderBy('fim').onSnapshot(function(qs){
    CTR = [];
    qs.forEach(function(doc){ CTR.push({ id: doc.id, d: doc.data() }); });
    CTR_OK = true;
    ctrRender();
  }, function(){
    var host = document.getElementById('ctrRows');
    if(host) host.innerHTML = '<tr><td colspan="8" class="load-note">Sem acesso — flag verComercial liberada e regras publicadas?</td></tr>';
    var k = document.getElementById('ctrKpis');
    if(k) k.innerHTML = '';
  });
}

/* ---- helpers ---- */
function ctrAviso(){
  return (COM_CFG && COM_CFG.regras && COM_CFG.regras.avisoPrevioDias) || 30;
}
/* "a renovar" = ativo dentro da janela de aviso prévio (inclui já vencido) */
function ctrRenovar(d){
  if((d.status || '') !== 'ativo') return false;
  var dias = comDiasAte(d.fim);
  return dias !== null && dias <= ctrAviso();
}
function ctrData(iso){
  if(!iso) return '—';
  var p = String(iso).split('-');
  return p.length === 3 ? escHtml(p[2] + '/' + p[1] + '/' + p[0]) : escHtml(iso);
}

/* ---- render ---- */
function ctrKpisRender(){
  var host = document.getElementById('ctrKpis'); if(!host) return;
  var hoje = comHoje(), ativos = 0, soma = 0, renovar = 0, vencidos = 0;
  CTR.forEach(function(c){
    var d = c.d;
    if((d.status || '') !== 'ativo') return;
    ativos++;
    soma += Number(d.valorMensal) || 0;
    if(ctrRenovar(d)) renovar++;
    if(d.fim && d.fim < hoje) vencidos++;
  });
  function kpi(n, rot){ return '<div class="adm-kpi"><b>' + n + '</b><span>' + rot + '</span></div>'; }
  host.innerHTML =
    kpi(ativos, 'contratos ativos') +
    kpi('R$ ' + fmtBRL(soma), 'receita mensal contratada') +
    kpi(renovar, 'a renovar (aviso de ' + ctrAviso() + ' dias)') +
    kpi(vencidos, 'vencidos');
}
function ctrRender(){
  if(!CTR_OK) return; /* 1º snapshot ainda não veio: mantém o "Carregando…" */
  ctrKpisRender();
  var host = document.getElementById('ctrRows'); if(!host) return;
  var vis = CTR.filter(function(c){
    var st = c.d.status || '';
    if(CTR_TAB === 'ativos') return st === 'ativo';
    if(CTR_TAB === 'renovar') return ctrRenovar(c.d);
    if(CTR_TAB === 'encerrados') return st === 'encerrado' || st === 'cancelado';
    return true;
  });
  if(!vis.length){
    host.innerHTML = '<tr><td colspan="8" class="load-note">' +
      (CTR.length ? 'Nada nesta aba.' : 'Nenhum contrato ainda — registre o primeiro pelo botão acima.') +
      '</td></tr>';
    return;
  }
  host.innerHTML = vis.map(ctrLinha).join('');
}
function ctrLinha(c){
  var d = c.d;
  var dias = comDiasAte(d.fim);
  var vencido = dias !== null && dias < 0 && (d.status || '') === 'ativo';
  var fimNota = '';
  if(ctrRenovar(d)){
    fimNota = dias < 0
      ? '<br><span style="color:var(--al-alto);font-weight:700">venceu há ' + Math.abs(dias) + ' dia' + (Math.abs(dias) === 1 ? '' : 's') + '</span>'
      : '<br><span style="color:var(--al-medioalto);font-weight:700">vence em ' + dias + ' dia' + (dias === 1 ? '' : 's') + '</span>';
  }
  var stCls = d.status === 'ativo' ? 'baixo' : (d.status === 'cancelado' ? 'alto' : 'sd');
  var doc = /^https:\/\//.test(d.linkDocAssinado || '')
    ? '<a href="' + escHtml(d.linkDocAssinado) + '" target="_blank" rel="noopener">abrir</a>'
    : '—';
  return '<tr>' +
    '<td>' + escHtml(d.clienteNome || '') + '</td>' +
    '<td>' + escHtml(d.produtoNome || '') + '</td>' +
    '<td style="text-align:right">R$ ' + fmtBRL(Number(d.valorMensal) || 0) + '</td>' +
    '<td>' + ctrData(d.inicio) + '</td>' +
    '<td' + (vencido ? ' style="background:var(--al-alto-bg)"' : '') + '>' + ctrData(d.fim) +
      (d.renovacaoAuto ? ' <span class="pill sd" title="Renovação automática">auto</span>' : '') +
      fimNota + '</td>' +
    '<td><span class="pill ' + stCls + '">' + escHtml(comRotulo(CTR_STATUS, d.status || '')) + '</span></td>' +
    '<td>' + doc + '</td>' +
    '<td><button type="button" class="mini" data-edit="' + escHtml(c.id) + '">editar</button></td>' +
  '</tr>';
}

/* ---- form ---- */
function ctrFormAbrir(id){
  CTR_EDIT = id || null;
  var c = null, i;
  if(id){ for(i = 0; i < CTR.length; i++) if(CTR[i].id === id){ c = CTR[i].d; break; } }
  document.getElementById('ctrFTitulo').textContent = c ? 'Editar contrato' : 'Novo contrato';
  document.getElementById('ctrFCliente').value = c ? (c.clienteNome || '') : '';
  document.getElementById('ctrFClienteId').value = c ? (c.clienteId || '') : '';
  document.getElementById('ctrFNegocioId').value = c ? (c.negocioId || '') : '';
  document.getElementById('ctrFCampanhaId').value = c ? (c.campanhaId || '') : '';
  document.getElementById('ctrFModelo').value = c ? (c.modeloJuridico || 'patrocinio') : 'patrocinio';
  document.getElementById('ctrFProduto').value = c ? (c.produtoId || '') : '';
  document.getElementById('ctrFProdutoNome').value = c ? (c.produtoNome || '') : '';
  document.getElementById('ctrFValor').value = c && c.valorMensal != null ? c.valorMensal : '';
  document.getElementById('ctrFInicio').value = c ? (c.inicio || '') : '';
  document.getElementById('ctrFFim').value = c ? (c.fim || '') : '';
  document.getElementById('ctrFStatus').value = c ? (c.status || 'ativo') : 'ativo';
  document.getElementById('ctrFRenova').checked = !!(c && c.renovacaoAuto);
  document.getElementById('ctrFLink').value = c ? (c.linkDocAssinado || '') : '';
  document.getElementById('ctrFObs').value = c ? (c.obs || '') : '';
  document.getElementById('ctrFExcluir').hidden = !(id && canRe());
  document.getElementById('ctrFJur').hidden = !canRe();
  document.getElementById('ctrForm').hidden = false;
  document.getElementById('ctrFCliente').focus();
}
function ctrFormFechar(){
  CTR_EDIT = null;
  document.getElementById('ctrForm').hidden = true;
}
/* produto da tabela escolhido: pré-preenche nome e valor (editáveis) */
function ctrProdutoEscolhido(){
  var p = comProduto(document.getElementById('ctrFProduto').value);
  if(!p) return;
  document.getElementById('ctrFProdutoNome').value = p.nome || '';
  if(p.valorMensal != null && p.valorMensal !== '') document.getElementById('ctrFValor').value = p.valorMensal;
}

/* coleta + validação; null = inválido (flashMsg já avisou) */
function ctrColeta(){
  var nome = document.getElementById('ctrFCliente').value.trim();
  if(!nome){ flashMsg('ctrMsg', 'Informe o cliente.'); return null; }
  var inicio = document.getElementById('ctrFInicio').value;
  var fim = document.getElementById('ctrFFim').value;
  if(!inicio || !fim){ flashMsg('ctrMsg', 'Informe início e fim.'); return null; }
  if(fim <= inicio){ flashMsg('ctrMsg', 'O fim precisa ser depois do início.'); return null; }
  var link = document.getElementById('ctrFLink').value.trim();
  if(link && !/^https:\/\//.test(link)){ flashMsg('ctrMsg', 'Doc assinado: só link https://.'); return null; }
  return {
    clienteId: document.getElementById('ctrFClienteId').value.trim(),
    clienteNome: nome,
    negocioId: document.getElementById('ctrFNegocioId').value.trim(),
    modeloJuridico: document.getElementById('ctrFModelo').value,
    produtoId: document.getElementById('ctrFProduto').value,
    produtoNome: document.getElementById('ctrFProdutoNome').value.trim(),
    valorMensal: parseFloat(document.getElementById('ctrFValor').value) || 0,
    inicio: inicio,
    fim: fim,
    renovacaoAuto: document.getElementById('ctrFRenova').checked,
    status: document.getElementById('ctrFStatus').value,
    linkDocAssinado: link,
    campanhaId: document.getElementById('ctrFCampanhaId').value.trim(),
    obs: document.getElementById('ctrFObs').value.trim(),
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    atualizadoPor: ME.nome || ME.email
  };
}

/* exclusividade: outro contrato ATIVO de OUTRO cliente no mesmo produto */
function ctrConflito(doc){
  if(doc.status !== 'ativo' || !doc.produtoId) return null;
  var p = comProduto(doc.produtoId);
  if(!p || !p.exclusividadeCategoria) return null;
  for(var i = 0; i < CTR.length; i++){
    if(CTR[i].id === CTR_EDIT) continue;
    var d = CTR[i].d;
    if((d.status || '') !== 'ativo' || d.produtoId !== doc.produtoId) continue;
    var mesmoCliente = (doc.clienteId && doc.clienteId === d.clienteId) ||
      (d.clienteNome || '') === doc.clienteNome;
    if(!mesmoCliente) return d.clienteNome || '(sem nome)';
  }
  return null;
}

function ctrSalvar(){
  var doc = ctrColeta(); if(!doc) return;
  var outro = ctrConflito(doc);
  if(outro && !confirm('Atenção: este quadro/produto já tem contrato ativo (cliente ' + outro + '). Regra: 1 patrocinador por quadro. Salvar mesmo assim?')) return;
  var btn = document.getElementById('ctrFSalvar');
  btnBusy(btn, true);
  var rot = doc.clienteNome + (doc.produtoNome ? ' — ' + doc.produtoNome : '');
  var p = CTR_EDIT
    ? col('contratos').doc(CTR_EDIT).update(doc).then(function(){ auditar('editar', 'contratos', CTR_EDIT, rot); })
    : col('contratos').add(Object.assign({ criadoEm: firebase.firestore.FieldValue.serverTimestamp() }, doc))
        .then(function(ref){ auditar('criar', 'contratos', ref.id, rot); });
  p.then(function(){
    btnBusy(btn, false);
    ctrFormFechar();
    flashMsg('ctrMsg', 'Contrato salvo.');
  }).catch(function(){
    btnBusy(btn, false);
    flashMsg('ctrMsg', 'Não foi possível salvar — sem permissão?');
  });
}

function ctrExcluir(){
  if(!CTR_EDIT || !canRe()) return;
  var nome = document.getElementById('ctrFCliente').value.trim() || CTR_EDIT;
  if(!confirm('Excluir o contrato de "' + nome + '"? Não dá pra desfazer.')) return;
  var id = CTR_EDIT;
  col('contratos').doc(id).delete().then(function(){
    auditar('apagar', 'contratos', id, nome);
    ctrFormFechar();
    flashMsg('ctrMsg', 'Contrato excluído.');
  }).catch(function(){ flashMsg('ctrMsg', 'Não foi possível excluir.'); });
}

/* manda o contrato pro papel timbrado do Jurídico (quem lê o jrPrefill é lá) */
function ctrGerarJuridico(){
  if(!canRe()) return;
  var modelo = document.getElementById('ctrFModelo').value === 'permuta' ? 'permuta' : 'patrocinio';
  try{
    sessionStorage.setItem('jrPrefill', JSON.stringify({
      modelo: modelo,
      clienteNome: document.getElementById('ctrFCliente').value.trim(),
      valorMensal: parseFloat(document.getElementById('ctrFValor').value) || 0,
      meses: '',
      inicio: document.getElementById('ctrFInicio').value,
      fim: document.getElementById('ctrFFim').value
    }));
  }catch(e){ /* sessionStorage indisponível: segue sem prefill */ }
  location.hash = '#juridico';
}
