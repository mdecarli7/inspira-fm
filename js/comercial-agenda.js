'use strict';
/* =====================================================================
 * comercial-agenda.js — Agenda do comercial (view #agenda-comercial, gate com)
 * Reuniões, follow-ups, prazos e tarefas da equipe comercial, agrupados
 * por dia: primeiro os atrasados, depois hoje e os próximos 60 dias.
 * Mescla (só leitura) os prazos de campanha em comercialização.
 * Carrega depois de base-org.js e comercial-core.js; usa os globais deles
 * (col, canCom, comHoje, comDiasAte, comRotulo) e do runtime (UNSUB, ME,
 * escHtml, btnBusy, flashMsg, auditar, liveAnnounce, reduceMotion).
 * ===================================================================== */

registrarModulo({ id: 'agenda-comercial', need: 'com', init: agcInit });

var agcBound = false;
var AGC_ROWS = [];   /* itens da coleção agenda_comercial: {id, d} */
var AGC_CAMP = [];   /* prazos virtuais das campanhas em comercialização: {id, camp:true, d} */
var AGC_EDIT = null; /* {id} em edição; id null = criando; null = form fechado */

var AGC_TIPOS = [
  ['reuniao', 'Reunião'],
  ['followup', 'Follow-up'],
  ['prazo', 'Prazo'],
  ['tarefa', 'Tarefa']
];
/* cor do pill por tipo — reusa as classes .pill que o index já tem */
var AGC_PILL = { reuniao: 'rede', followup: 'local', prazo: 'medioalto', tarefa: 'sd' };
var AGC_SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/* ---- entrada (router chama ao abrir a view) ---- */
function agcInit(){
  if(!canCom()) return;
  if(!agcBound){
    var sec = document.getElementById('view-agenda-comercial');
    if(!sec) return; /* casca ainda não está no index — não trava o resto */
    agcBound = true;
    agcMarkup(sec);
    agcBind();
  }
  agcListen();
  agcRender();
}

/* ---- markup (injetado no 1º acesso; a section no index é casca vazia) ---- */
function agcMarkup(sec){
  sec.innerHTML =
    '<div class="page-hero">' +
      '<svg class="waves" viewBox="0 0 1440 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<path class="wave-drift" d="M-80,110 C320,30 620,200 980,120 C1220,68 1380,140 1520,90 L1520,-60 L-80,-60 Z" fill="var(--teal-800)"/>' +
        '<path class="wave-drift w2" d="M-100,560 C300,480 660,640 1040,550 C1260,500 1420,570 1540,530 L1540,720 L-100,720 Z" fill="var(--teal-950)"/>' +
      '</svg>' +
      '<div class="wrap">' +
        '<p class="crumb">Comercial · Agenda</p>' +
        '<h1 id="agc-title">Agenda comercial</h1>' +
        '<p class="sub">Reuniões, follow-ups, prazos e tarefas da equipe comercial num só lugar — com os prazos das campanhas em comercialização já mesclados.</p>' +
      '</div>' +
    '</div>' +
    '<div class="section"><div class="wrap">' +
      '<div class="adm-kpis" id="agcKpis"><div class="load-note">Carregando…</div></div>' +

      '<div class="adm-filtros">' +
        '<select class="fin-input" id="agcFTipo" aria-label="Filtrar por tipo">' +
          '<option value="">Todos os tipos</option>' +
          AGC_TIPOS.map(function(t){ return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('') +
        '</select>' +
        '<label class="adm-check" style="align-self:center"><input type="checkbox" id="agcFMeus"> <span>só os meus</span></label>' +
        '<label class="adm-check" style="align-self:center"><input type="checkbox" id="agcFFeitos"> <span>mostrar feitos</span></label>' +
        '<button type="button" class="mini" id="agcNovo" style="margin-left:auto">+ Novo compromisso</button>' +
      '</div>' +

      '<div id="agcForm" hidden style="border:1px solid var(--line);border-radius:.9rem;background:var(--surface);padding:1rem 1.1rem;margin-bottom:1.2rem">' +
        '<div class="cp-row">' +
          '<div class="field"><label for="agcTipo">Tipo</label>' +
            '<select id="agcTipo" class="fin-input">' +
              AGC_TIPOS.map(function(t){ return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('') +
            '</select></div>' +
          '<div class="field" style="flex:2;min-width:14rem"><label for="agcTitulo">Título</label>' +
            '<input id="agcTitulo" class="fin-input" placeholder="ex.: Reunião de proposta com a padaria"></div>' +
        '</div>' +
        '<div class="cp-row">' +
          '<div class="field"><label for="agcData">Data</label>' +
            '<input id="agcData" type="date" class="fin-input"></div>' +
          '<div class="field"><label for="agcHora">Hora (opcional)</label>' +
            '<input id="agcHora" class="fin-input" placeholder="ex.: 14h30"></div>' +
          '<div class="field" style="flex:2;min-width:12rem"><label for="agcCliente">Cliente (opcional)</label>' +
            '<input id="agcCliente" class="fin-input" placeholder="ex.: Supermercado Boa Compra"></div>' +
        '</div>' +
        '<div class="field"><label for="agcObs">Observações (opcional)</label>' +
          '<textarea id="agcObs" class="fin-input" rows="2" placeholder="Contexto, link da proposta, o que não pode esquecer…"></textarea></div>' +
        '<p style="margin:.8rem 0 0;display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">' +
          '<button type="button" class="mini" id="agcSalvar">Salvar</button>' +
          '<button type="button" class="mini" id="agcCancelar">Cancelar</button>' +
          '<button type="button" class="mini del" id="agcExcluir" hidden>Excluir</button>' +
          '<span id="agcMsg" role="status"></span>' +
        '</p>' +
      '</div>' +

      '<div id="agcLista"><div class="load-note">Carregando…</div></div>' +
    '</div></div>';
}

/* ---- eventos ---- */
function agcBind(){
  document.getElementById('agcNovo').addEventListener('click', function(){ agcOpen(null, {}); });
  document.getElementById('agcSalvar').addEventListener('click', agcSave);
  document.getElementById('agcCancelar').addEventListener('click', agcFechar);
  document.getElementById('agcExcluir').addEventListener('click', function(){
    if(!AGC_EDIT || !AGC_EDIT.id) return;
    agcDelete(AGC_EDIT.id, document.getElementById('agcTitulo').value.trim() || 'compromisso', true);
  });
  ['agcFTipo', 'agcFMeus', 'agcFFeitos'].forEach(function(id){
    document.getElementById(id).addEventListener('change', agcRender);
  });
  var lista = document.getElementById('agcLista');
  lista.addEventListener('click', function(ev){
    var b = ev.target.closest('[data-agcedit]');
    if(b){
      var row = agcRowById(b.getAttribute('data-agcedit'));
      if(row) agcOpen(row.id, row.d);
      return;
    }
    var x = ev.target.closest('[data-agcdel]');
    if(x){
      var row2 = agcRowById(x.getAttribute('data-agcdel'));
      if(row2) agcDelete(row2.id, row2.d.titulo || 'compromisso', false);
    }
  });
  lista.addEventListener('change', function(ev){
    var cb = ev.target.closest('[data-agcfeito]');
    if(cb) agcFeitoToggle(cb.getAttribute('data-agcfeito'), cb.checked);
  });
}

/* ---- streams ---- */
function agcListen(){
  if(!UNSUB.agc){
    UNSUB.agc = col('agenda_comercial').orderBy('data').onSnapshot(function(qs){
      AGC_ROWS = [];
      qs.forEach(function(doc){ AGC_ROWS.push({ id: doc.id, d: doc.data() }); });
      agcRender();
    }, function(){
      delete UNSUB.agc;
      var host = document.getElementById('agcLista');
      if(host) host.innerHTML = '<div class="load-note">Sem acesso — a flag verComercial foi liberada e as regras publicadas?</div>';
    });
  }
  /* prazos de campanha (só leitura): campanhas em comercialização com comPrazo
     viram itens virtuais tipo "prazo" na lista, sem editar/excluir/feito */
  if(!UNSUB.agcCamp){
    UNSUB.agcCamp = col('campanhas').onSnapshot(function(qs){
      AGC_CAMP = [];
      qs.forEach(function(doc){
        var d = doc.data();
        if(d.status === 'comercializacao' && d.comPrazo){
          AGC_CAMP.push({ id: 'camp-' + doc.id, camp: true, d: {
            tipo: 'prazo',
            titulo: 'Prazo comercial — ' + (d.nome || 'campanha sem nome'),
            data: d.comPrazo, hora: '',
            clienteNome: '', responsavelUid: '', responsavelNome: '',
            feito: false, obs: ''
          } });
        }
      });
      agcRender();
    }, function(){
      delete UNSUB.agcCamp;
      /* sem permissão em campanhas: a agenda segue sem os prazos mesclados */
    });
  }
}

function agcRowById(id){
  for(var i = 0; i < AGC_ROWS.length; i++) if(AGC_ROWS[i].id === id) return AGC_ROWS[i];
  return null;
}

/* ---- datas ---- */
/* "seg, 28/07" a partir de YYYY-MM-DD; meio-dia evita pulo de dia por fuso */
function agcFmtDia(iso){
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if(!m) return '';
  var dt = new Date(iso + 'T12:00:00');
  return AGC_SEM[dt.getDay()] + ', ' + m[3] + '/' + m[2];
}
/* hoje + n dias em YYYY-MM-DD (fuso local, mesmo formato do comHoje) */
function agcSomaDias(n){
  var d = new Date();
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---- filtros + mescla ---- */
function agcItens(){
  var fTipo = document.getElementById('agcFTipo').value;
  var soMeus = document.getElementById('agcFMeus').checked;
  var comFeitos = document.getElementById('agcFFeitos').checked;
  return AGC_ROWS.concat(AGC_CAMP).filter(function(r){
    if(fTipo && r.d.tipo !== fTipo) return false;
    /* "só os meus" esconde também os prazos de campanha: não têm responsável */
    if(soMeus && (!ME || r.d.responsavelUid !== ME.uid)) return false;
    if(!comFeitos && r.d.feito) return false;
    return true;
  }).sort(function(a, b){
    /* data > hora > título; hora é texto livre ("14h30"), a ordenação lexicográfica
       basta pro uso real (sem hora vem primeiro no dia) */
    var ka = (a.d.data || '') + '|' + (a.d.hora || '') + '|' + (a.d.titulo || '');
    var kb = (b.d.data || '') + '|' + (b.d.hora || '') + '|' + (b.d.titulo || '');
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/* ---- contadores (sobre tudo que está pendente, sem filtro de tela) ---- */
function agcKpis(){
  var host = document.getElementById('agcKpis');
  if(!host) return;
  var hoje = comHoje(), fimSemana = agcSomaDias(6);
  var atras = 0, nHoje = 0, nSemana = 0;
  AGC_ROWS.concat(AGC_CAMP).forEach(function(r){
    if(r.d.feito || !r.d.data) return;
    if(r.d.data < hoje) atras++;
    else if(r.d.data === hoje) nHoje++;
    if(r.d.data >= hoje && r.d.data <= fimSemana) nSemana++;
  });
  function kpi(n, rot){ return '<div class="adm-kpi"><b>' + n + '</b><span>' + rot + '</span></div>'; }
  host.innerHTML =
    kpi(atras, 'atrasados') +
    kpi(nHoje, 'para hoje') +
    kpi(nSemana, 'nos próximos 7 dias');
}

/* ---- lista agrupada por dia ---- */
function agcRender(){
  agcKpis();
  var host = document.getElementById('agcLista');
  if(!host) return;
  var hoje = comHoje(), amanha = agcSomaDias(1), limite = agcSomaDias(60);
  var itens = agcItens();

  var atrasados = [], visiveis = [], futuros = 0;
  itens.forEach(function(r){
    if(r.d.data < hoje && !r.d.feito){ atrasados.push(r); return; }
    if(r.d.data > limite){ futuros++; return; }
    /* feitos do passado (com "mostrar feitos" ligado) entram nos grupos por dia */
    visiveis.push(r);
  });

  if(!atrasados.length && !visiveis.length){
    host.innerHTML = '<div class="proj-empty">Nada na agenda' +
      (AGC_ROWS.length || AGC_CAMP.length ? ' com esses filtros' : ' pros próximos 60 dias') +
      '. Clique em <b>+ Novo compromisso</b> pra começar.</div>' +
      agcNotaFuturos(futuros);
    return;
  }

  var html = '';
  if(atrasados.length){
    html += '<h3 style="margin-top:1.4rem;color:var(--al-alto)">Atrasados <span class="sn-badge">' + atrasados.length + '</span></h3>' +
      atrasados.map(function(r){ return agcItemHtml(r, true); }).join('');
  }
  /* agrupa os demais por dia (já vêm ordenados por data) */
  var dia = null;
  visiveis.forEach(function(r){
    if(r.d.data !== dia){
      dia = r.d.data;
      var rotulo = agcFmtDia(dia);
      if(dia === hoje) rotulo += ' · hoje';
      else if(dia === amanha) rotulo += ' · amanhã';
      html += '<h3 style="margin-top:1.4rem">' + escHtml(rotulo) + '</h3>';
    }
    html += agcItemHtml(r, false);
  });
  html += agcNotaFuturos(futuros);
  host.innerHTML = html;
}
function agcNotaFuturos(n){
  return n ? '<p class="chart-note">' + n + (n === 1 ? ' compromisso' : ' compromissos') + ' depois dos próximos 60 dias — não exibido' + (n === 1 ? '' : 's') + ' aqui.</p>' : '';
}

function agcItemHtml(r, atrasado){
  var d = r.d;
  var h = '<div class="adm-pend"' + (atrasado ? ' style="border-color:var(--al-alto)"' : '') + '>';
  if(!r.camp){
    h += '<input type="checkbox" data-agcfeito="' + escHtml(r.id) + '"' + (d.feito ? ' checked' : '') +
      ' aria-label="Marcar ' + escHtml(d.titulo || 'compromisso') + ' como feito">';
  }
  h += '<span class="pill ' + (AGC_PILL[d.tipo] || 'sd') + '">' + escHtml(comRotulo(AGC_TIPOS, d.tipo)) + '</span>';
  if(atrasado) h += '<span class="com-dias atras">' + escHtml(agcFmtDia(d.data)) + '</span>';
  if(d.hora) h += '<span class="com-dias' + (atrasado ? ' atras' : '') + '">' + escHtml(d.hora) + '</span>';
  h += '<b' + (d.feito ? ' style="text-decoration:line-through;color:var(--muted)"' : '') + '>' + escHtml(d.titulo || '') + '</b>';
  if(d.clienteNome) h += '<span>' + escHtml(d.clienteNome) + '</span>';
  if(d.responsavelNome) h += '<span style="color:var(--muted)">' + escHtml(d.responsavelNome) + '</span>';
  if(d.obs) h += '<span style="color:var(--muted);font-size:.85rem">' + escHtml(d.obs) + '</span>';
  if(r.camp){
    h += '<span class="st-pill st-comerc">da campanha</span>' +
      '<a class="mini" href="#campanhas">Ver campanha</a>';
  }else{
    h += '<button type="button" class="mini" data-agcedit="' + escHtml(r.id) + '">Editar</button>' +
      '<button type="button" class="mini del" data-agcdel="' + escHtml(r.id) + '">Excluir</button>';
  }
  return h + '</div>';
}

/* ---- feito: update direto do checkbox da lista ---- */
function agcFeitoToggle(id, checked){
  var row = agcRowById(id);
  if(!row) return;
  col('agenda_comercial').doc(id).update({
    feito: checked,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    atualizadoPor: ME.nome || ME.email
  }).then(function(){
    auditar('editar', 'agenda_comercial', id, (row.d.titulo || '') + (checked ? ' (feito)' : ' (reaberto)'));
  }).catch(function(){
    flashMsg('agcMsg', 'Sem permissão para atualizar.');
    agcRender(); /* volta o checkbox pro estado real */
  });
}

/* ---- form ---- */
function agcOpen(id, d){
  AGC_EDIT = { id: id };
  document.getElementById('agcTipo').value = d.tipo || 'reuniao';
  document.getElementById('agcTitulo').value = d.titulo || '';
  document.getElementById('agcData').value = d.data || comHoje();
  document.getElementById('agcHora').value = d.hora || '';
  document.getElementById('agcCliente').value = d.clienteNome || '';
  document.getElementById('agcObs').value = d.obs || '';
  document.getElementById('agcExcluir').hidden = !id;
  var f = document.getElementById('agcForm');
  f.hidden = false;
  f.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  document.getElementById('agcTitulo').focus();
}
function agcFechar(){
  AGC_EDIT = null;
  document.getElementById('agcForm').hidden = true;
}
function agcSave(){
  if(!AGC_EDIT) return;
  var titulo = document.getElementById('agcTitulo').value.trim();
  if(!titulo){ flashMsg('agcMsg', 'Dê um título ao compromisso.'); return; }
  var data = document.getElementById('agcData').value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data)){ flashMsg('agcMsg', 'Informe a data.'); return; }
  /* base do save; clienteId/negocioId/responsável/feito/criadoEm não entram na
     edição (set com merge preserva o que já está no doc) */
  var base = {
    tipo: document.getElementById('agcTipo').value,
    titulo: titulo,
    data: data,
    hora: document.getElementById('agcHora').value.trim(),
    clienteNome: document.getElementById('agcCliente').value.trim(),
    obs: document.getElementById('agcObs').value.trim(),
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    atualizadoPor: ME.nome || ME.email
  };
  var btn = document.getElementById('agcSalvar');
  btnBusy(btn, true);
  var novo = !AGC_EDIT.id, idAtual = AGC_EDIT.id;
  var op = novo
    ? col('agenda_comercial').add(Object.assign({
        clienteId: '', negocioId: '',
        responsavelUid: ME.uid, responsavelNome: ME.nome || ME.email,
        feito: false,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      }, base))
    : col('agenda_comercial').doc(idAtual).set(base, { merge: true });
  op.then(function(ref){
    auditar(novo ? 'criar' : 'editar', 'agenda_comercial', (ref && ref.id) || idAtual || '', titulo);
    agcFechar();
    liveAnnounce('Compromisso salvo.');
  }).catch(function(){
    flashMsg('agcMsg', 'Sem permissão para salvar — a flag verComercial foi liberada e as regras publicadas?');
  }).finally(function(){ btnBusy(btn, false); });
}

/* ---- excluir (qualquer canCom pode; as rules permitem) ---- */
function agcDelete(id, titulo, fechaForm){
  if(!confirm('Excluir "' + titulo + '" da agenda para todos?')) return;
  col('agenda_comercial').doc(id).delete().then(function(){
    auditar('apagar', 'agenda_comercial', id, titulo);
    if(fechaForm) agcFechar();
    liveAnnounce('Compromisso excluído.');
  }).catch(function(){ flashMsg('agcMsg', 'Sem permissão para excluir.'); });
}
