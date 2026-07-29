'use strict';
/* =====================================================================
 * comercial-docs.js — Materiais comerciais (view #docs-comerciais, gate com)
 * Biblioteca de links aprovados: mídia kit, apresentações, propostas,
 * tabelas, contratos assinados. O arquivo em si vive no Drive/Canva —
 * plano Spark não tem Storage, então aqui entra SEMPRE o link https.
 * Carrega depois de base-org.js e comercial-core.js; usa os globais deles
 * (col, canCom, comRotulo) e os do runtime (escHtml, btnBusy, flashMsg,
 * auditar, UNSUB, canRe, ME).
 * ===================================================================== */

registrarModulo({ id: 'docs-comerciais', need: 'com', init: docrInit });

var docrBound = false, DOCR = [], DOCR_OK = false, DOCR_EDIT = null;

var DOCR_TIPOS = [
  ['midiakit', 'Mídia kit'],
  ['apresentacao', 'Apresentação'],
  ['proposta', 'Proposta'],
  ['tabela', 'Tabela'],
  ['contrato_assinado', 'Contrato assinado'],
  ['outro', 'Outro']
];

/* ---- entrada ---- */
function docrInit(){
  if(!canCom()) return;
  if(!docrBound){
    docrBound = true;
    docrMarkup();
    docrBind();
  }
  docrListen();
}

/* ---- markup (injetado no 1º acesso; a section no index é casca vazia) ---- */
function docrMarkup(){
  function ops(){
    return DOCR_TIPOS.map(function(t){ return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('');
  }
  document.getElementById('view-docs-comerciais').innerHTML =
    '<div class="page-hero">' +
      '<svg class="waves" viewBox="0 0 1440 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<path class="wave-drift" d="M-80,110 C320,30 620,200 980,120 C1220,68 1380,140 1520,90 L1520,-60 L-80,-60 Z" fill="var(--teal-800)"/>' +
        '<path class="wave-drift w2" d="M-100,560 C300,480 660,640 1040,550 C1260,500 1420,570 1540,530 L1540,720 L-100,720 Z" fill="var(--teal-950)"/>' +
      '</svg>' +
      '<div class="wrap">' +
        '<p class="crumb">Comercial · Materiais</p>' +
        '<h1 id="docr-title">Documentos aprovados</h1>' +
        '<p class="sub">Uma fonte só pro material que vai pra rua: mídia kit, apresentações, propostas e tabelas — sempre na versão aprovada.</p>' +
      '</div>' +
    '</div>' +
    '<div class="section"><div class="wrap">' +
      '<div class="adm-filtros">' +
        '<select class="fin-input" id="docrFTipo"><option value="">Todos os tipos</option>' + ops() + '</select>' +
        '<input class="fin-input" id="docrBusca" placeholder="Buscar por nome…">' +
      '</div>' +
      '<p class="chart-note" style="margin-top:.8rem">' +
        '<button type="button" class="mini" id="docrNovo">Novo material</button> ' +
        '<span id="docrMsg"></span>' +
      '</p>' +
      '<div id="docrForm" hidden style="border:1px solid var(--line);border-radius:.9rem;background:var(--surface);padding:1rem 1.3rem;margin:0 0 1rem">' +
        '<h3 id="docrFTitulo" style="margin-top:0">Novo material</h3>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.6rem">' +
          '<label>Nome*<input class="fin-input" id="docrFNome" maxlength="120"></label>' +
          '<label>Tipo<select class="fin-input" id="docrFTipoSel">' + ops() + '</select></label>' +
          '<label>Link (https)*<input class="fin-input" id="docrFLink" type="url" placeholder="https://…"></label>' +
          '<label>Versão<input class="fin-input" id="docrFVersao" maxlength="40" placeholder="ex.: 2026-07, v2"></label>' +
          '<label>Cliente (opcional)<input class="fin-input" id="docrFClienteNome" maxlength="120"></label>' +
          '<label>Id do cliente (opcional)<input class="fin-input" id="docrFClienteId"></label>' +
        '</div>' +
        '<label style="display:block;margin:.6rem 0 0">Observações<textarea class="fin-input" id="docrFObs" rows="2" style="width:100%"></textarea></label>' +
        '<label style="display:block;margin:.5rem 0"><input type="checkbox" id="docrFAprovado"> Material aprovado pra uso</label>' +
        '<p style="margin:.6rem 0 0">' +
          '<button type="button" class="mini" id="docrFSalvar">Salvar</button> ' +
          '<button type="button" class="mini" id="docrFCancelar">Cancelar</button> ' +
          '<button type="button" class="mini" id="docrFExcluir" hidden>Excluir</button>' +
        '</p>' +
      '</div>' +
      '<div id="docrLista" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1rem;align-items:start">' +
        '<div class="load-note">Carregando…</div>' +
      '</div>' +
    '</div></div>';
}

/* ---- eventos ---- */
function docrBind(){
  document.getElementById('docrFTipo').addEventListener('input', docrRender);
  document.getElementById('docrBusca').addEventListener('input', docrRender);
  document.getElementById('docrNovo').addEventListener('click', function(){ docrFormAbrir(null); });
  document.getElementById('docrLista').addEventListener('click', function(ev){
    var b = ev.target.closest('[data-edit]'); if(!b) return;
    docrFormAbrir(b.dataset.edit);
  });
  document.getElementById('docrFSalvar').addEventListener('click', docrSalvar);
  document.getElementById('docrFCancelar').addEventListener('click', docrFormFechar);
  document.getElementById('docrFExcluir').addEventListener('click', docrExcluir);
}

/* ---- stream ---- */
function docrListen(){
  if(UNSUB.docr) return;
  UNSUB.docr = col('documentos').orderBy('atualizadoEm', 'desc').onSnapshot(function(qs){
    DOCR = [];
    qs.forEach(function(doc){ DOCR.push({ id: doc.id, d: doc.data() }); });
    DOCR_OK = true;
    docrRender();
  }, function(){
    var host = document.getElementById('docrLista');
    if(host) host.innerHTML = '<p class="load-note">Sem acesso — flag verComercial liberada e regras publicadas?</p>';
  });
}

/* ---- render ---- */
function docrRender(){
  if(!DOCR_OK) return; /* 1º snapshot ainda não veio: mantém o "Carregando…" */
  var host = document.getElementById('docrLista'); if(!host) return;
  var fT = document.getElementById('docrFTipo').value;
  var fQ = document.getElementById('docrBusca').value.trim().toLowerCase();
  var vis = DOCR.filter(function(c){
    if(fT && (c.d.tipo || 'outro') !== fT) return false;
    if(fQ && String(c.d.nome || '').toLowerCase().indexOf(fQ) < 0) return false;
    return true;
  });
  if(!vis.length){
    host.innerHTML = '<p class="load-note">' + (DOCR.length
      ? 'Nenhum material com esse filtro.'
      : 'Nenhum material ainda — cadastre o mídia kit, apresentações e propostas aprovadas; o arquivo em si fica no Drive/Canva e aqui entra o link.') + '</p>';
    return;
  }
  host.innerHTML = vis.map(docrCard).join('');
}
function docrCard(c){
  var d = c.d;
  /* selo verde de aprovado: pill.baixo é a variante verde do design system */
  var aprovado = d.aprovado
    ? ' <span class="pill baixo" title="' + escHtml('Aprovado' + (d.aprovadoPorNome ? ' por ' + d.aprovadoPorNome : '')) + '">APROVADO</span>'
    : '';
  var obs = String(d.obs || '');
  if(obs.length > 140) obs = obs.slice(0, 140) + '…';
  var abrir = /^https:\/\//.test(d.link || '')
    ? '<a href="' + escHtml(d.link) + '" target="_blank" rel="noopener">Abrir</a> '
    : '';
  return '<div class="bs-card" style="margin-bottom:0">' +
    '<h4 style="margin:0 0 .3rem">' + escHtml(d.nome || '(sem nome)') + '</h4>' +
    '<p style="margin:.2rem 0">' +
      '<span class="pill sd">' + escHtml(comRotulo(DOCR_TIPOS, d.tipo || 'outro')) + '</span>' + aprovado +
      (d.versao ? ' <span class="pill sd">' + escHtml(d.versao) + '</span>' : '') +
    '</p>' +
    (d.clienteNome ? '<p style="margin:.2rem 0">Cliente: <b>' + escHtml(d.clienteNome) + '</b></p>' : '') +
    (obs ? '<p class="tx" style="margin:.3rem 0">' + escHtml(obs) + '</p>' : '') +
    '<p style="margin:.5rem 0 0">' + abrir +
      '<button type="button" class="mini" data-edit="' + escHtml(c.id) + '">editar</button>' +
    '</p>' +
  '</div>';
}

/* ---- form ---- */
function docrFormAbrir(id){
  DOCR_EDIT = id || null;
  var c = null, i;
  if(id){ for(i = 0; i < DOCR.length; i++) if(DOCR[i].id === id){ c = DOCR[i].d; break; } }
  document.getElementById('docrFTitulo').textContent = c ? 'Editar material' : 'Novo material';
  document.getElementById('docrFNome').value = c ? (c.nome || '') : '';
  document.getElementById('docrFTipoSel').value = c ? (c.tipo || 'outro') : 'midiakit';
  document.getElementById('docrFLink').value = c ? (c.link || '') : '';
  document.getElementById('docrFVersao').value = c ? (c.versao || '') : '';
  document.getElementById('docrFClienteNome').value = c ? (c.clienteNome || '') : '';
  document.getElementById('docrFClienteId').value = c ? (c.clienteId || '') : '';
  document.getElementById('docrFObs').value = c ? (c.obs || '') : '';
  document.getElementById('docrFAprovado').checked = !!(c && c.aprovado);
  document.getElementById('docrFExcluir').hidden = !(id && canRe());
  document.getElementById('docrForm').hidden = false;
  document.getElementById('docrFNome').focus();
}
function docrFormFechar(){
  DOCR_EDIT = null;
  document.getElementById('docrForm').hidden = true;
}

function docrSalvar(){
  var nome = document.getElementById('docrFNome').value.trim();
  if(!nome){ flashMsg('docrMsg', 'Informe o nome do material.'); return; }
  var link = document.getElementById('docrFLink').value.trim();
  if(!/^https:\/\//.test(link)){ flashMsg('docrMsg', 'O link é obrigatório e só vale endereço https://.'); return; }
  var chk = document.getElementById('docrFAprovado').checked;
  /* quem aprovou: carimba quem marcou o checkbox; edição que já estava
     aprovada preserva o carimbo original */
  var antes = null, i;
  if(DOCR_EDIT){ for(i = 0; i < DOCR.length; i++) if(DOCR[i].id === DOCR_EDIT){ antes = DOCR[i].d; break; } }
  var doc = {
    nome: nome,
    tipo: document.getElementById('docrFTipoSel').value,
    link: link,
    versao: document.getElementById('docrFVersao').value.trim(),
    aprovado: chk,
    aprovadoPorNome: chk
      ? ((antes && antes.aprovado && antes.aprovadoPorNome) || (ME.nome || ME.email))
      : '',
    clienteId: document.getElementById('docrFClienteId').value.trim(),
    clienteNome: document.getElementById('docrFClienteNome').value.trim(),
    obs: document.getElementById('docrFObs').value.trim(),
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    atualizadoPor: ME.nome || ME.email
  };
  var btn = document.getElementById('docrFSalvar');
  btnBusy(btn, true);
  var p = DOCR_EDIT
    ? col('documentos').doc(DOCR_EDIT).update(doc).then(function(){ auditar('editar', 'documentos', DOCR_EDIT, nome); })
    : col('documentos').add(Object.assign({ criadoEm: firebase.firestore.FieldValue.serverTimestamp() }, doc))
        .then(function(ref){ auditar('criar', 'documentos', ref.id, nome); });
  p.then(function(){
    btnBusy(btn, false);
    docrFormFechar();
    flashMsg('docrMsg', 'Material salvo.');
  }).catch(function(){
    btnBusy(btn, false);
    flashMsg('docrMsg', 'Não foi possível salvar — sem permissão?');
  });
}

function docrExcluir(){
  if(!DOCR_EDIT || !canRe()) return;
  var nome = document.getElementById('docrFNome').value.trim() || DOCR_EDIT;
  if(!confirm('Excluir o material "' + nome + '"? O arquivo no Drive/Canva continua existindo; some só o registro daqui.')) return;
  var id = DOCR_EDIT;
  col('documentos').doc(id).delete().then(function(){
    auditar('apagar', 'documentos', id, nome);
    docrFormFechar();
    flashMsg('docrMsg', 'Material excluído.');
  }).catch(function(){ flashMsg('docrMsg', 'Não foi possível excluir.'); });
}
