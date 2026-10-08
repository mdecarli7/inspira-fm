'use strict';
/* =====================================================================
 * comercial-radar.js — Radar de clientes (view #radar-comercial, gate com)
 * Lista de TODO potencial anunciante da região, antes de virar prospecção:
 * por segmento, cidade, porte e prioridade. Quem o comercial decide
 * trabalhar é "movido pra carteira" e aparece em Clientes como prospecto.
 *
 * Dados: a MESMA coleção `clientes`, com o campo radar:true. Sem coleção
 * nova = sem mexer no firestore.rules (canComercial lê/cria/edita; apagar
 * só diretoria). comercial-clientes.js ignora docs com radar:true; mover
 * pra carteira é só radar:false + status:'prospecto' no mesmo doc — o
 * histórico (quem cadastrou, quando) vem junto.
 * Carrega depois de comercial-clientes.js; usa os globais dele e do core
 * (col, canCom, canRe, CLI_ORIGENS, COM_CFG, comCfgCarregar, comRotulo,
 * cliOpts, cliQuando, embHit, escHtml, btnBusy, flashMsg, auditar, UNSUB,
 * ME, liveAnnounce).
 * ===================================================================== */

registrarModulo({ id: 'radar-comercial', need: 'com', init: rdcInit });

var rdcBound = false, RDC_ROWS = [], RDC_OK = false, RDC_EDIT = null;
var RDC_GRUPO = 'categoria';   /* agrupar por: categoria | cidade | nenhum */

var RDC_PRIOR = [
  ['alta', 'Alta'],
  ['media', 'Média'],
  ['baixa', 'Baixa']
];
var RDC_PRIOR_PILL = { alta: 'alto', media: 'medioalto', baixa: 'sd' };
var RDC_PORTES = [
  ['', '—'],
  ['mei', 'MEI / autônomo'],
  ['pequena', 'Pequena'],
  ['media', 'Média'],
  ['grande', 'Grande'],
  ['rede', 'Rede / franquia']
];

/* ---- entrada ---- */
function rdcInit(){
  if(!canCom()) return;
  if(!rdcBound){
    rdcBound = true;
    rdcMarkup();
    rdcBind();
  }
  comCfgCarregar().then(rdcCatSelect);
  rdcListen();
}

/* ---- markup ---- */
function rdcMarkup(){
  document.getElementById('view-radar-comercial').innerHTML =
    '<div class="page-hero">' +
      '<svg class="waves" viewBox="0 0 1440 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<path class="wave-drift" d="M-80,110 C320,30 620,200 980,120 C1220,68 1380,140 1520,90 L1520,-60 L-80,-60 Z" fill="var(--teal-800)"/>' +
        '<path class="wave-drift w2" d="M-100,560 C300,480 660,640 1040,550 C1260,500 1420,570 1540,530 L1540,720 L-100,720 Z" fill="var(--teal-950)"/>' +
      '</svg>' +
      '<div class="wrap">' +
        '<p class="crumb">Comercial · Radar</p>' +
        '<h1 id="rdc-title">Radar de clientes</h1>' +
        '<p class="sub">Todo potencial anunciante da região num lugar só, por segmento e cidade. Daqui a empresa vai pra carteira quando o comercial começa a trabalhar o contato.</p>' +
      '</div>' +
    '</div>' +
    '<div class="section"><div class="wrap">' +
      '<div class="adm-kpis" id="rdcKpis"><div class="load-note">Carregando…</div></div>' +
      '<div class="proj-toolbar">' +
        '<h3 style="margin:0">No radar <span class="radar-count" id="rdcCount"></span></h3>' +
        '<span><a class="btn ghost" href="#clientes" style="margin-right:.4rem">Carteira de clientes</a>' +
        '<button type="button" class="btn primary" id="rdcNovo">+ Adicionar ao radar</button></span>' +
      '</div>' +
      '<div class="adm-filtros">' +
        '<input class="fin-input" id="rdcBusca" type="search" autocomplete="off" placeholder="Buscar por empresa, contato, bairro…" aria-label="Buscar no radar">' +
        '<select class="fin-input" id="rdcFCat" aria-label="Filtrar por segmento"><option value="">Todos os segmentos</option></select>' +
        '<select class="fin-input" id="rdcFCidade" aria-label="Filtrar por cidade"><option value="">Todas as cidades</option></select>' +
        '<select class="fin-input" id="rdcFPrior" aria-label="Filtrar por prioridade"><option value="">Toda prioridade</option>' + cliOpts(RDC_PRIOR) + '</select>' +
        '<select class="fin-input" id="rdcFGrupo" aria-label="Agrupar por">' +
          '<option value="categoria">Agrupar por segmento</option><option value="cidade">Agrupar por cidade</option><option value="">Sem agrupar</option>' +
        '</select>' +
        '<label class="adm-check" style="align-self:center"><input type="checkbox" id="rdcFDesc"> <span>mostrar descartados</span></label>' +
      '</div>' +
      rdcFormHtml() +
      '<div id="rdcLista"><div class="load-note">Carregando…</div></div>' +
    '</div></div>';
}
function rdcFormHtml(){
  return '<div id="rdcForm" hidden style="margin:1rem 0 1.6rem">' +
    '<h3 id="rdcFTitulo" style="margin:0 0 .6rem">Adicionar ao radar</h3>' +
    '<div class="cp-row">' +
      '<div class="field"><label for="rdcFNome">Empresa*</label><input id="rdcFNome" class="fin-input" maxlength="120"></div>' +
      '<div class="field"><label for="rdcFCatSel">Segmento</label><select id="rdcFCatSel" class="fin-input"><option value="">— sem segmento —</option><option value="__outra__">Outro…</option></select></div>' +
      '<div class="field" id="rdcFCatOutraField" hidden><label for="rdcFCatOutra">Qual segmento?</label><input id="rdcFCatOutra" class="fin-input" placeholder="ex.: imobiliária, clínica, academia"></div>' +
      '<div class="field"><label for="rdcFPorte">Porte</label><select id="rdcFPorte" class="fin-input">' + cliOpts(RDC_PORTES) + '</select></div>' +
    '</div>' +
    '<div class="cp-row">' +
      '<div class="field"><label for="rdcFCidade">Cidade</label><input id="rdcFCidade" class="fin-input" list="rdcCidades" placeholder="ex.: Campinas"></div>' +
      '<datalist id="rdcCidades"></datalist>' +
      '<div class="field"><label for="rdcFBairro">Bairro / região</label><input id="rdcFBairro" class="fin-input"></div>' +
      '<div class="field"><label for="rdcFInsta">Instagram</label><input id="rdcFInsta" class="fin-input" placeholder="@perfil"></div>' +
      '<div class="field"><label for="rdcFSite">Site</label><input id="rdcFSite" class="fin-input" type="url" placeholder="https://…"></div>' +
    '</div>' +
    '<div class="cp-row">' +
      '<div class="field"><label for="rdcFContato">Contato (nome)</label><input id="rdcFContato" class="fin-input"></div>' +
      '<div class="field"><label for="rdcFCargo">Cargo</label><input id="rdcFCargo" class="fin-input" placeholder="ex.: dono, marketing"></div>' +
      '<div class="field"><label for="rdcFTel">Telefone / WhatsApp</label><input id="rdcFTel" class="fin-input"></div>' +
      '<div class="field"><label for="rdcFEmail">E-mail</label><input id="rdcFEmail" class="fin-input" type="email"></div>' +
    '</div>' +
    '<div class="cp-row">' +
      '<div class="field"><label for="rdcFPrior">Prioridade</label><select id="rdcFPrior" class="fin-input">' + cliOpts(RDC_PRIOR) + '</select></div>' +
      '<div class="field"><label for="rdcFOrigem">Como chegou ao radar</label><select id="rdcFOrigem" class="fin-input">' + cliOpts(CLI_ORIGENS) + '</select></div>' +
      '<div class="field"><label for="rdcFResp">Responsável</label><input id="rdcFResp" class="fin-input" placeholder="quem vai abordar"></div>' +
    '</div>' +
    '<div class="field"><label for="rdcFObs">Observações (por que vale abordar, já anuncia em rádio?, sazonalidade…)</label><textarea id="rdcFObs" class="fin-input" rows="3" style="resize:vertical"></textarea></div>' +
    '<div class="proj-actions">' +
      '<button type="button" class="btn primary" id="rdcSalvar">Salvar no radar</button>' +
      '<button type="button" class="btn ghost" id="rdcCancelar">Cancelar</button>' +
      '<button type="button" class="btn ghost" id="rdcMover" hidden>Mover pra carteira →</button>' +
      '<button type="button" class="btn ghost" id="rdcDescartar" hidden>Descartar</button>' +
      '<button type="button" class="btn ghost danger" id="rdcExcluir" hidden>Excluir</button>' +
      '<span class="fin-msg" id="rdcMsg" role="status" aria-live="polite"></span>' +
    '</div>' +
  '</div>';
}

/* ---- eventos ---- */
function rdcBind(){
  ['rdcBusca', 'rdcFCat', 'rdcFCidade', 'rdcFPrior', 'rdcFDesc'].forEach(function(id){
    document.getElementById(id).addEventListener('input', rdcRender);
  });
  document.getElementById('rdcFGrupo').addEventListener('input', function(ev){ RDC_GRUPO = ev.target.value; rdcRender(); });
  document.getElementById('rdcNovo').addEventListener('click', function(){ rdcFormAbrir(null); });
  document.getElementById('rdcFCatSel').addEventListener('input', function(ev){
    document.getElementById('rdcFCatOutraField').hidden = ev.target.value !== '__outra__';
  });
  document.getElementById('rdcLista').addEventListener('click', function(ev){
    var m = ev.target.closest('[data-mover]');
    if(m){ rdcMover(m.dataset.mover); return; }
    var b = ev.target.closest('[data-edit]'); if(!b) return;
    rdcFormAbrir(b.dataset.edit);
  });
  document.getElementById('rdcSalvar').addEventListener('click', rdcSalvar);
  document.getElementById('rdcCancelar').addEventListener('click', rdcFormFechar);
  document.getElementById('rdcMover').addEventListener('click', function(){ if(RDC_EDIT && RDC_EDIT.id) rdcMover(RDC_EDIT.id); });
  document.getElementById('rdcDescartar').addEventListener('click', rdcDescartar);
  document.getElementById('rdcExcluir').addEventListener('click', rdcExcluir);
}

/* ---- stream ---- */
function rdcListen(){
  if(UNSUB.rdc) return;
  UNSUB.rdc = col('clientes').where('radar', '==', true).onSnapshot(function(qs){
    RDC_ROWS = [];
    qs.forEach(function(doc){ RDC_ROWS.push({ id: doc.id, d: doc.data() }); });
    RDC_ROWS.sort(function(a, b){ return String(a.d.nome || '').localeCompare(String(b.d.nome || ''), 'pt-BR'); });
    RDC_OK = true;
    rdcFiltrosRender();
    rdcRender();
  }, function(){
    var host = document.getElementById('rdcLista');
    if(host) host.innerHTML = '<div class="load-note">Sem acesso — a flag verComercial foi liberada e as regras publicadas?</div>';
  });
}

/* ---- selects dependentes dos dados ---- */
function rdcCatSelect(){
  var cats = ((COM_CFG && COM_CFG.categorias) || []).map(function(c){ return typeof c === 'string' ? c : ((c && c.nome) || ''); }).filter(Boolean);
  /* segmentos já usados no radar entram também, pra lista não divergir do dado */
  RDC_ROWS.forEach(function(r){ if(r.d.categoria && cats.indexOf(r.d.categoria) < 0) cats.push(r.d.categoria); });
  cats.sort(function(a, b){ return a.localeCompare(b, 'pt-BR'); });
  var sel = document.getElementById('rdcFCatSel');
  if(!sel) return;
  var atual = sel.value;
  sel.innerHTML = '<option value="">— sem segmento —</option>' +
    cats.map(function(n){ return '<option value="' + escHtml(n) + '">' + escHtml(n) + '</option>'; }).join('') +
    '<option value="__outra__">Outro…</option>';
  if(atual) sel.value = atual;
}
function rdcFiltrosRender(){
  function opcoes(id, campo, rot){
    var sel = document.getElementById(id); if(!sel) return;
    var atual = sel.value, vals = {};
    RDC_ROWS.forEach(function(r){ var v = (r.d[campo] || '').trim(); if(v) vals[v] = (vals[v] || 0) + 1; });
    var ks = Object.keys(vals).sort(function(a, b){ return a.localeCompare(b, 'pt-BR'); });
    sel.innerHTML = '<option value="">' + rot + '</option>' + ks.map(function(k){
      return '<option value="' + escHtml(k) + '">' + escHtml(k) + ' (' + vals[k] + ')</option>';
    }).join('');
    if(atual && vals[atual]) sel.value = atual;
  }
  opcoes('rdcFCat', 'categoria', 'Todos os segmentos');
  opcoes('rdcFCidade', 'cidade', 'Todas as cidades');
  var dl = document.getElementById('rdcCidades');
  if(dl){
    var cs = {};
    RDC_ROWS.forEach(function(r){ if(r.d.cidade) cs[r.d.cidade.trim()] = 1; });
    dl.innerHTML = Object.keys(cs).map(function(c){ return '<option value="' + escHtml(c) + '">'; }).join('');
  }
  rdcCatSelect();
}

/* ---- render ---- */
function rdcVisiveis(){
  var q = document.getElementById('rdcBusca').value.trim().toLowerCase();
  var fC = document.getElementById('rdcFCat').value;
  var fCid = document.getElementById('rdcFCidade').value;
  var fP = document.getElementById('rdcFPrior').value;
  var desc = document.getElementById('rdcFDesc').checked;
  return RDC_ROWS.filter(function(r){
    var d = r.d;
    if(!desc && d.radarStatus === 'descartado') return false;
    if(fC && (d.categoria || '') !== fC) return false;
    if(fCid && (d.cidade || '') !== fCid) return false;
    if(fP && (d.prioridade || 'media') !== fP) return false;
    return embHit(q, [d.nome, d.nomeFantasia, d.contatoNome, d.categoria, d.cidade, d.bairro, d.instagram, d.obs]);
  });
}
function rdcRender(){
  if(!RDC_OK) return;
  var host = document.getElementById('rdcLista'); if(!host) return;
  var ativos = RDC_ROWS.filter(function(r){ return r.d.radarStatus !== 'descartado'; });
  var alta = ativos.filter(function(r){ return r.d.prioridade === 'alta'; }).length;
  var segs = {}, cids = {};
  ativos.forEach(function(r){ if(r.d.categoria) segs[r.d.categoria] = 1; if(r.d.cidade) cids[r.d.cidade] = 1; });
  document.getElementById('rdcKpis').innerHTML =
    '<div class="adm-kpi"><b>' + ativos.length + '</b>no radar</div>' +
    '<div class="adm-kpi"><b>' + alta + '</b>prioridade alta</div>' +
    '<div class="adm-kpi"><b>' + Object.keys(segs).length + '</b>segmentos</div>' +
    '<div class="adm-kpi"><b>' + Object.keys(cids).length + '</b>cidades</div>';

  var vis = rdcVisiveis();
  document.getElementById('rdcCount').textContent = vis.length ? vis.length + ' de ' + ativos.length : '';
  if(!vis.length){
    host.innerHTML = '<div class="load-note">' + (RDC_ROWS.length
      ? 'Nenhuma empresa com esse filtro.'
      : 'Radar vazio. Comece pelos segmentos que mais anunciam em rádio na região: imobiliárias, concessionárias, clínicas, supermercados, escolas, academias — e vá movendo pra carteira conforme o contato começa.') + '</div>';
    return;
  }
  if(!RDC_GRUPO){ host.innerHTML = rdcTabela(vis); return; }
  var grupos = {};
  vis.forEach(function(r){ var k = (r.d[RDC_GRUPO] || '').trim() || '(sem ' + (RDC_GRUPO === 'cidade' ? 'cidade' : 'segmento') + ')'; (grupos[k] = grupos[k] || []).push(r); });
  host.innerHTML = Object.keys(grupos).sort(function(a, b){ return a.localeCompare(b, 'pt-BR'); }).map(function(k){
    return '<h3 style="margin:1.4rem 0 .5rem">' + escHtml(k) + ' <span class="radar-count">' + grupos[k].length + '</span></h3>' + rdcTabela(grupos[k]);
  }).join('');
}
function rdcTabela(rows){
  return '<div class="tbl-scroll"><table class="users-table"><thead><tr>' +
    '<th scope="col">Empresa</th><th scope="col">Segmento</th><th scope="col">Cidade</th><th scope="col">Contato</th>' +
    '<th scope="col">Prioridade</th><th scope="col">Responsável</th><th scope="col">Atualizado</th><th scope="col"></th>' +
    '</tr></thead><tbody>' +
    rows.map(function(r){
      var d = r.d;
      var pr = d.prioridade || 'media';
      var desc = d.radarStatus === 'descartado';
      return '<tr' + (desc ? ' style="opacity:.55"' : '') + '>' +
        '<td><b>' + escHtml(d.nome || '—') + '</b>' +
          (d.instagram ? '<br><small style="color:var(--muted)">' + escHtml(d.instagram) + '</small>' : '') +
          (desc ? ' <span class="pill sd">descartado</span>' : '') + '</td>' +
        '<td>' + escHtml(d.categoria || '—') + (d.porte ? '<br><small style="color:var(--muted)">' + escHtml(comRotulo(RDC_PORTES, d.porte)) + '</small>' : '') + '</td>' +
        '<td>' + escHtml(d.cidade || '—') + (d.bairro ? '<br><small style="color:var(--muted)">' + escHtml(d.bairro) + '</small>' : '') + '</td>' +
        '<td>' + escHtml(d.contatoNome || '—') + (d.telefone ? '<br><small style="color:var(--muted)">' + escHtml(d.telefone) + '</small>' : '') + '</td>' +
        '<td><span class="pill ' + RDC_PRIOR_PILL[pr] + '">' + escHtml(comRotulo(RDC_PRIOR, pr)) + '</span></td>' +
        '<td>' + escHtml(d.responsavelNome || '—') + '</td>' +
        '<td>' + cliQuando(d.atualizadoEm) + '</td>' +
        '<td style="white-space:nowrap"><button type="button" class="mini" data-edit="' + escHtml(r.id) + '">editar</button> ' +
          (desc ? '' : '<button type="button" class="mini" data-mover="' + escHtml(r.id) + '" title="Vira prospecto na carteira de Clientes">→ carteira</button>') + '</td>' +
      '</tr>';
    }).join('') + '</tbody></table></div>';
}

/* ---- form ---- */
function rdcPorId(id){ for(var i = 0; i < RDC_ROWS.length; i++) if(RDC_ROWS[i].id === id) return RDC_ROWS[i]; return null; }
function rdcFormAbrir(id){
  var r = id ? rdcPorId(id) : null;
  var d = r ? r.d : {};
  RDC_EDIT = { id: r ? r.id : null, d: d };
  document.getElementById('rdcFTitulo').textContent = r ? 'Editar: ' + (d.nome || '') : 'Adicionar ao radar';
  document.getElementById('rdcFNome').value = d.nome || '';
  rdcCatSelect();
  var sel = document.getElementById('rdcFCatSel');
  var cat = d.categoria || '';
  var tem = cat && Array.prototype.some.call(sel.options, function(o){ return o.value === cat; });
  sel.value = !cat ? '' : (tem ? cat : '__outra__');
  document.getElementById('rdcFCatOutraField').hidden = sel.value !== '__outra__';
  document.getElementById('rdcFCatOutra').value = tem ? '' : cat;
  document.getElementById('rdcFPorte').value = d.porte || '';
  document.getElementById('rdcFCidade').value = d.cidade || '';
  document.getElementById('rdcFBairro').value = d.bairro || '';
  document.getElementById('rdcFInsta').value = d.instagram || '';
  document.getElementById('rdcFSite').value = d.site || '';
  document.getElementById('rdcFContato').value = d.contatoNome || '';
  document.getElementById('rdcFCargo').value = d.contatoCargo || '';
  document.getElementById('rdcFTel').value = d.telefone || '';
  document.getElementById('rdcFEmail').value = d.email || '';
  document.getElementById('rdcFPrior').value = d.prioridade || 'media';
  document.getElementById('rdcFOrigem').value = d.origem || 'prospeccao';
  document.getElementById('rdcFResp').value = d.responsavelNome || '';
  document.getElementById('rdcFObs').value = d.obs || '';
  document.getElementById('rdcMover').hidden = !r || d.radarStatus === 'descartado';
  document.getElementById('rdcDescartar').hidden = !r;
  document.getElementById('rdcDescartar').textContent = d.radarStatus === 'descartado' ? 'Reativar no radar' : 'Descartar';
  document.getElementById('rdcExcluir').hidden = !(r && canRe());
  document.getElementById('rdcForm').hidden = false;
  document.getElementById('rdcFNome').focus();
}
function rdcFormFechar(){
  RDC_EDIT = null;
  document.getElementById('rdcForm').hidden = true;
}
function rdcColeta(){
  var nome = document.getElementById('rdcFNome').value.trim();
  if(!nome){ flashMsg('rdcMsg', 'Informe o nome da empresa.'); return null; }
  var catSel = document.getElementById('rdcFCatSel').value;
  var categoria = catSel === '__outra__' ? document.getElementById('rdcFCatOutra').value.trim() : catSel;
  var site = document.getElementById('rdcFSite').value.trim();
  if(site && !/^https?:\/\//.test(site)){ flashMsg('rdcMsg', 'Site: comece com https://'); return null; }
  return {
    radar: true,
    radarStatus: (RDC_EDIT && RDC_EDIT.d.radarStatus) || 'ativo',
    nome: nome,
    categoria: categoria,
    porte: document.getElementById('rdcFPorte').value,
    cidade: document.getElementById('rdcFCidade').value.trim(),
    bairro: document.getElementById('rdcFBairro').value.trim(),
    instagram: document.getElementById('rdcFInsta').value.trim(),
    site: site,
    contatoNome: document.getElementById('rdcFContato').value.trim(),
    contatoCargo: document.getElementById('rdcFCargo').value.trim(),
    telefone: document.getElementById('rdcFTel').value.trim(),
    email: document.getElementById('rdcFEmail').value.trim(),
    prioridade: document.getElementById('rdcFPrior').value,
    origem: document.getElementById('rdcFOrigem').value,
    responsavelNome: document.getElementById('rdcFResp').value.trim(),
    status: 'prospecto',          /* já nasce como prospecto: mover pra carteira é só virar radar:false */
    obs: document.getElementById('rdcFObs').value.trim(),
    atualizadoPor: ME.nome || ME.email,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  };
}
function rdcSalvar(){
  if(!RDC_EDIT) return;
  var doc = rdcColeta(); if(!doc) return;
  var btn = document.getElementById('rdcSalvar');
  btnBusy(btn, true);
  var novo = !RDC_EDIT.id;
  var op = novo
    ? col('clientes').add(Object.assign({ criadoEm: firebase.firestore.FieldValue.serverTimestamp(), criadoPor: ME.nome || ME.email }, doc))
    : col('clientes').doc(RDC_EDIT.id).set(doc, { merge: true });
  op.then(function(ref){
    auditar(novo ? 'criar' : 'editar', 'clientes', (ref && ref.id) || RDC_EDIT.id, doc.nome + ' (radar)');
    rdcFormFechar();
    liveAnnounce('Salvo no radar.');
  }).catch(function(){ flashMsg('rdcMsg', 'Sem permissão para salvar.'); })
    .finally(function(){ btnBusy(btn, false); });
}
/* radar → carteira: mesmo doc, radar:false. Aparece em Clientes como prospecto,
   com responsável = quem moveu (se o radar não tinha um) */
function rdcMover(id){
  var r = rdcPorId(id); if(!r) return;
  if(!confirm('Mover "' + (r.d.nome || '') + '" pra carteira de Clientes? Ela sai do radar e entra como prospecto.')) return;
  var up = {
    radar: false,
    status: 'prospecto',
    responsavelNome: r.d.responsavelNome || ME.nome || ME.email,
    responsavelUid: r.d.responsavelNome ? (r.d.responsavelUid || '') : ME.uid,
    movidoDoRadarEm: firebase.firestore.FieldValue.serverTimestamp(),
    movidoDoRadarPor: ME.nome || ME.email,
    atualizadoPor: ME.nome || ME.email,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  };
  col('clientes').doc(id).set(up, { merge: true }).then(function(){
    auditar('editar', 'clientes', id, (r.d.nome || '') + ' — radar → carteira');
    if(RDC_EDIT && RDC_EDIT.id === id) rdcFormFechar();
    liveAnnounce('Movido pra carteira.');
    flashMsg('rdcMsg', 'Movido pra carteira. Abra Clientes › Prospecção.');
  }).catch(function(){ flashMsg('rdcMsg', 'Sem permissão para mover.'); });
}
function rdcDescartar(){
  if(!RDC_EDIT || !RDC_EDIT.id) return;
  var desc = RDC_EDIT.d.radarStatus === 'descartado';
  col('clientes').doc(RDC_EDIT.id).set({
    radarStatus: desc ? 'ativo' : 'descartado',
    atualizadoPor: ME.nome || ME.email,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).then(function(){
    auditar('editar', 'clientes', RDC_EDIT.id, (RDC_EDIT.d.nome || '') + (desc ? ' — reativado no radar' : ' — descartado do radar'));
    rdcFormFechar();
  }).catch(function(){ flashMsg('rdcMsg', 'Sem permissão.'); });
}
function rdcExcluir(){
  if(!RDC_EDIT || !RDC_EDIT.id || !canRe()) return;
  var nome = RDC_EDIT.d.nome || RDC_EDIT.id;
  if(!confirm('Excluir "' + nome + '" do radar? Não dá pra desfazer. (Pra só tirar da lista, use Descartar.)')) return;
  var id = RDC_EDIT.id;
  col('clientes').doc(id).delete().then(function(){
    auditar('apagar', 'clientes', id, nome + ' (radar)');
    rdcFormFechar();
  }).catch(function(){ flashMsg('rdcMsg', 'Não foi possível excluir.'); });
}
