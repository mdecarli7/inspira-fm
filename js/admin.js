'use strict';
/* =====================================================================
 * admin.js — Painel do administrador (view #admin, gate admin)
 * Subabas: Visão geral · Atividade (auditoria) · Pendentes · Saúde.
 * Carrega depois do runtime.js e do base-org.js; usa os globais deles.
 * Leituras pensadas pro plano Spark: contagens via aggregation count()
 * (1 leitura por 1000 docs), auditoria por get paginado (não onSnapshot).
 * ===================================================================== */

registrarModulo({ id: 'admin', need: 'admin', init: admInit });
/* badge de pendentes no menu: o Início é a view padrão pós-login, então este
   init de extensão liga o stream de users pro admin sem depender de abrir o Painel */
registrarModulo({ id: 'admbadge', extensaoDe: 'inicio', init: admUsersListen });

var admBound = false, ADM_TAB = 'visao';
var ADM_USERS = [];
var ADM_AUD = { rows: [], ultimo: null, fim: false };
var ADM_CHECK_ITENS = [
  { k: 'rules', t: 'Regras do Firestore publicadas no Console (mesma versão do firestore.rules do repositório)' },
  { k: 'emailEnum', t: 'Email enumeration protection ativada (Authentication → Settings)' },
  { k: 'anon', t: 'Provedor Anonymous desligado (Authentication → Sign-in method)' },
  { k: 'autoCad', t: 'Auto-cadastro sob controle: novos logins viram “pendente” e a fila é revisada aqui' },
  { k: 'backupMensal', t: 'Backup do conteúdo (export-conteudo.html) feito no último mês, guardado FORA do repositório' }
];

/* ---- entrada ---- */
function admInit(){
  if(!isAdmin()) return;
  if(!admBound){
    admBound = true;
    admMarkup();
    admBind();
  }
  admUsersListen();
  admTabSet(ADM_TAB);
  if(!ADM_AUD.rows.length) admAudCarregar(true);
  admSaudeCarregar();
  admContagens();
}

/* ---- markup (injetado no 1º acesso; a section no index é casca vazia) ---- */
function admMarkup(){
  document.getElementById('view-admin').innerHTML =
    '<div class="page-hero">' +
      '<svg class="waves" viewBox="0 0 1440 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<path class="wave-drift" d="M-80,110 C320,30 620,200 980,120 C1220,68 1380,140 1520,90 L1520,-60 L-80,-60 Z" fill="var(--teal-800)"/>' +
        '<path class="wave-drift w2" d="M-100,560 C300,480 660,640 1040,550 C1260,500 1420,570 1540,530 L1540,720 L-100,720 Z" fill="var(--teal-950)"/>' +
      '</svg>' +
      '<div class="wrap">' +
        '<p class="crumb">Administração · Acesso restrito</p>' +
        '<h1 id="adm-title">Painel do administrador</h1>' +
        '<p class="sub">Uso da plataforma, trilha de atividade, fila de aprovação e saúde do sistema — o que só o admin vê.</p>' +
      '</div>' +
    '</div>' +
    '<div class="section"><div class="wrap">' +
      '<div class="camp-tabs" id="admTabs">' +
        '<button type="button" data-admtab="visao" class="on">Visão geral</button>' +
        '<button type="button" data-admtab="atividade">Atividade</button>' +
        '<button type="button" data-admtab="pendentes">Pendentes <span id="admPendN" class="sn-badge" hidden>0</span></button>' +
        '<button type="button" data-admtab="saude">Saúde</button>' +
      '</div>' +

      '<div id="admPanelVisao">' +
        '<h3 style="margin-top:1.2rem">Contas e uso</h3>' +
        '<div class="adm-kpis" id="admKpis"><div class="load-note">Carregando…</div></div>' +
        '<h3>Tamanho das coleções</h3>' +
        '<p class="lead">Contagem feita no servidor (aggregation count) — custo de leitura mínimo. Coleções novas aparecem quando as regras forem publicadas.</p>' +
        '<div class="tbl-scroll"><table class="users-table"><tbody id="admCounts"><tr><td class="load-note">Carregando…</td></tr></tbody></table></div>' +
        '<p class="chart-note"><button type="button" class="mini" id="admCountsRefresh">Atualizar contagens</button></p>' +
      '</div>' +

      '<div id="admPanelAtividade" hidden>' +
        '<h3 style="margin-top:1.2rem">Trilha de atividade</h3>' +
        '<p class="lead">Quem fez o quê, registrado a cada salvar/excluir/login. Só o admin lê esta trilha.</p>' +
        '<div class="adm-filtros">' +
          '<select class="fin-input" id="admFAcao"><option value="">Todas as ações</option>' +
            ['login','criar','editar','apagar','aprovar','publicar'].map(function(a){ return '<option>' + a + '</option>'; }).join('') +
          '</select>' +
          '<select class="fin-input" id="admFCol"><option value="">Todas as áreas</option></select>' +
          '<input class="fin-input" id="admFQuem" placeholder="Filtrar por pessoa (nome ou e-mail)">' +
        '</div>' +
        '<div class="tbl-scroll"><table class="users-table"><thead><tr>' +
          '<th scope="col">Quando</th><th scope="col">Quem</th><th scope="col">Ação</th><th scope="col">Área</th><th scope="col">O quê</th>' +
        '</tr></thead><tbody id="admAudRows"><tr><td colspan="5" class="load-note">Carregando…</td></tr></tbody></table></div>' +
        '<p class="chart-note">' +
          '<button type="button" class="mini" id="admAudMais">Carregar mais</button> ' +
          '<button type="button" class="mini" id="admAudLimpar">Limpar registros com mais de 90 dias</button> ' +
          '<span id="admAudMsg"></span>' +
        '</p>' +
      '</div>' +

      '<div id="admPanelPendentes" hidden>' +
        '<h3 style="margin-top:1.2rem">Fila de aprovação</h3>' +
        '<p class="lead">Toda conta nova entra como <b>pendente</b> e não vê nada até você aprovar. Aprovar = virar colaborador; ajustes finos (diretor, Balanço) ficam na página <a href="#usuarios">Usuários</a>.</p>' +
        '<div id="admPendLista"><div class="load-note">Carregando…</div></div>' +
      '</div>' +

      '<div id="admPanelSaude" hidden>' +
        '<h3 style="margin-top:1.2rem">Backup do conteúdo</h3>' +
        '<p class="lead" id="admBackupInfo">Verificando…</p>' +
        '<p class="chart-note">O backup baixa o HTML das views que vivem no Firestore (Análise, Organograma, Equipe) e a folha. Sirva <code>scripts/export-conteudo.html</code> em localhost, entre com o Google e exporte. O JSON tem a folha salarial: <b>guardar fora do repositório</b>.</p>' +
        '<h3>Checklist de segurança (Console do Firebase)</h3>' +
        '<p class="lead">Pendências que não dão pra resolver em código — marque conforme for fazendo no Console.</p>' +
        '<div id="admCheck"><div class="load-note">Carregando…</div></div>' +
      '</div>' +
    '</div></div>';
}

/* ---- eventos ---- */
function admBind(){
  document.getElementById('admTabs').addEventListener('click', function(ev){
    var b = ev.target.closest('[data-admtab]'); if(!b) return;
    admTabSet(b.dataset.admtab);
  });
  document.getElementById('admCountsRefresh').addEventListener('click', admContagens);
  document.getElementById('admAudMais').addEventListener('click', function(){ admAudCarregar(false); });
  document.getElementById('admAudLimpar').addEventListener('click', admAudLimpar);
  ['admFAcao','admFCol','admFQuem'].forEach(function(id){
    document.getElementById(id).addEventListener('input', admAudRender);
  });
  document.getElementById('admPendLista').addEventListener('click', admPendClick);
  document.getElementById('admCheck').addEventListener('change', admCheckSalvar);
}
function admTabSet(t){
  ADM_TAB = t;
  document.querySelectorAll('[data-admtab]').forEach(function(b){
    b.classList.toggle('on', b.dataset.admtab === t);
  });
  document.getElementById('admPanelVisao').hidden = t !== 'visao';
  document.getElementById('admPanelAtividade').hidden = t !== 'atividade';
  document.getElementById('admPanelPendentes').hidden = t !== 'pendentes';
  document.getElementById('admPanelSaude').hidden = t !== 'saude';
}

/* ---- stream de users: KPIs, fila de pendentes e badge do menu ---- */
function admUsersListen(){
  if(!isAdmin() || UNSUB.admUsers) return;
  UNSUB.admUsers = db.collection('users').onSnapshot(function(qs){
    ADM_USERS = [];
    qs.forEach(function(doc){ ADM_USERS.push({ id: doc.id, d: doc.data() }); });
    admBadge();
    if(admBound){ admKpis(); admPendRender(); }
  }, function(){ /* sem permissão (não-admin com stream residual): silencioso */ });
}
function admPendentes(){
  return ADM_USERS.filter(function(u){ return (u.d.role || 'pendente') === 'pendente'; });
}
function admBadge(){
  var n = admPendentes().length;
  var el = document.getElementById('admBadge');
  if(el){ el.textContent = n; el.hidden = !n; }
  var el2 = document.getElementById('admPendN');
  if(el2){ el2.textContent = n; el2.hidden = !n; }
}
function admKpis(){
  var host = document.getElementById('admKpis');
  if(!host) return;
  var agora = Date.now(), d7 = 0, d30 = 0, porPapel = {};
  ADM_USERS.forEach(function(u){
    var r = u.d.role || 'pendente';
    porPapel[r] = (porPapel[r] || 0) + 1;
    var ua = u.d.ultimoAcesso && u.d.ultimoAcesso.toMillis ? u.d.ultimoAcesso.toMillis() : 0;
    if(agora - ua < 7 * 864e5) d7++;
    if(agora - ua < 30 * 864e5) d30++;
  });
  function kpi(n, rot){ return '<div class="adm-kpi"><b>' + n + '</b><span>' + rot + '</span></div>'; }
  host.innerHTML =
    kpi(ADM_USERS.length, 'contas no total') +
    kpi(admPendentes().length, 'pendentes de aprovação') +
    kpi(d7, 'ativos nos últimos 7 dias') +
    kpi(d30, 'ativos nos últimos 30 dias') +
    kpi((porPapel.diretor || 0) + (porPapel.admin || 0), 'diretoria + admin') +
    kpi(porPapel.colaborador || 0, 'colaboradores');
}

/* ---- fila de pendentes ---- */
function admPendRender(){
  var host = document.getElementById('admPendLista');
  if(!host) return;
  var pend = admPendentes();
  if(!pend.length){ host.innerHTML = '<p class="load-note">Ninguém esperando aprovação. 🎉</p>'; return; }
  host.innerHTML = pend.map(function(u){
    return '<div class="adm-pend" data-uid="' + escHtml(u.id) + '">' +
      '<b>' + escHtml(u.d.nome || u.d.email || u.id) + '</b>' +
      '<span>' + escHtml(u.d.email || '') + '</span>' +
      '<span class="pill role-pendente">' + escHtml(u.d.setor || 'sem setor') + '</span>' +
      '<button type="button" class="mini" data-aprovar="1">Aprovar como colaborador</button>' +
      '<button type="button" class="mini" data-recusar="1">Recusar</button>' +
    '</div>';
  }).join('');
}
function admPendClick(ev){
  var btn = ev.target.closest('button'); if(!btn) return;
  var box = btn.closest('.adm-pend'); if(!box) return;
  var uid = box.getAttribute('data-uid');
  var quem = box.querySelector('b') ? box.querySelector('b').textContent : uid;
  if(btn.dataset.aprovar){
    btn.disabled = true; btn.textContent = 'Aprovando…';
    db.collection('users').doc(uid).update({ role: 'colaborador' }).then(function(){
      auditar('aprovar', 'users', uid, quem + ' → colaborador');
      liveAnnounce('Conta aprovada.');
    }).catch(function(){ btn.disabled = false; btn.textContent = 'Aprovar como colaborador'; });
  }
  if(btn.dataset.recusar){
    if(!confirm('Recusar e remover o cadastro de "' + quem + '"?\nA conta Google/e-mail continua existindo; se a pessoa logar de novo, volta pra fila.')) return;
    btn.disabled = true;
    db.collection('users').doc(uid).delete().then(function(){
      auditar('apagar', 'users', uid, quem + ' (cadastro recusado)');
    }).catch(function(){ btn.disabled = false; });
  }
}

/* ---- contagens por coleção (aggregation count) ---- */
var ADM_COLS = ['users','campanhas','brainstorm','planejamento','quadros','colunistas','embaixadores','juridico','projetos','auditoria','clientes','negocios','contratos','agenda_comercial','documentos'];
function admContagens(){
  var host = document.getElementById('admCounts');
  if(!host) return;
  Promise.all(ADM_COLS.map(function(c){
    try{
      return db.collection(c).count().get()
        .then(function(s){ return { c: c, n: s.data().count }; })
        .catch(function(){ return { c: c, n: null }; });
    }catch(e){ return Promise.resolve({ c: c, n: null }); }
  })).then(function(rs){
    host.innerHTML = rs.filter(function(r){ return r.n !== null; }).map(function(r){
      return '<tr><td>' + escHtml(r.c) + '</td><td style="text-align:right"><b>' + fmtInt(r.n) + '</b></td></tr>';
    }).join('') || '<tr><td class="load-note">Nenhuma contagem disponível — as regras foram publicadas?</td></tr>';
  });
}

/* ---- auditoria: get paginado, filtro client-side sobre o que já veio ---- */
function admAudCarregar(reset){
  if(reset){ ADM_AUD = { rows: [], ultimo: null, fim: false }; }
  if(ADM_AUD.fim) return;
  var q = db.collection('auditoria').orderBy('quando', 'desc').limit(100);
  if(ADM_AUD.ultimo) q = q.startAfter(ADM_AUD.ultimo);
  q.get().then(function(qs){
    if(qs.size < 100) ADM_AUD.fim = true;
    if(qs.size) ADM_AUD.ultimo = qs.docs[qs.size - 1];
    qs.forEach(function(doc){ ADM_AUD.rows.push(doc.data()); });
    admAudRender();
  }).catch(function(){
    var host = document.getElementById('admAudRows');
    if(host) host.innerHTML = '<tr><td colspan="5" class="load-note">Sem acesso à trilha — as regras da coleção auditoria foram publicadas?</td></tr>';
  });
}
function admAudRender(){
  var host = document.getElementById('admAudRows');
  if(!host) return;
  var fA = document.getElementById('admFAcao').value;
  var fC = document.getElementById('admFCol').value;
  var fQ = document.getElementById('admFQuem').value.trim().toLowerCase();
  /* o select de áreas se alimenta do que já foi carregado */
  var cols = [];
  ADM_AUD.rows.forEach(function(r){ if(r.col && cols.indexOf(r.col) < 0) cols.push(r.col); });
  var selC = document.getElementById('admFCol');
  if(selC.options.length - 1 !== cols.length){
    selC.innerHTML = '<option value="">Todas as áreas</option>' +
      cols.sort().map(function(c){ return '<option' + (c === fC ? ' selected' : '') + '>' + escHtml(c) + '</option>'; }).join('');
  }
  var vis = ADM_AUD.rows.filter(function(r){
    if(fA && r.acao !== fA) return false;
    if(fC && r.col !== fC) return false;
    if(fQ && ((r.quemNome || '') + ' ' + (r.quemEmail || '')).toLowerCase().indexOf(fQ) < 0) return false;
    return true;
  });
  if(!vis.length){
    host.innerHTML = '<tr><td colspan="5" class="load-note">Nenhum registro' + (ADM_AUD.rows.length ? ' com esse filtro' : ' ainda') + '.</td></tr>';
  } else {
    host.innerHTML = vis.map(function(r){
      var quando = r.quando && r.quando.toDate ? r.quando.toDate().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
      return '<tr>' +
        '<td>' + quando + '</td>' +
        '<td>' + escHtml(r.quemNome || r.quemEmail || '') + '</td>' +
        '<td><span class="pill">' + escHtml(r.acao || '') + '</span></td>' +
        '<td>' + escHtml(r.col || '') + '</td>' +
        '<td>' + escHtml(r.rotulo || '') + '</td></tr>';
    }).join('');
  }
  document.getElementById('admAudMais').hidden = ADM_AUD.fim;
}
function admAudLimpar(){
  if(!confirm('Apagar todos os registros de atividade com mais de 90 dias? Não dá pra desfazer.')) return;
  var corte = firebase.firestore.Timestamp.fromMillis(Date.now() - 90 * 864e5);
  var apagados = 0;
  function lote(){
    return db.collection('auditoria').where('quando', '<', corte).limit(400).get().then(function(qs){
      if(!qs.size) return apagados;
      var b = db.batch();
      qs.forEach(function(doc){ b.delete(doc.ref); });
      apagados += qs.size;
      return b.commit().then(lote);
    });
  }
  var msg = document.getElementById('admAudMsg');
  msg.textContent = 'Limpando…';
  lote().then(function(n){
    msg.textContent = n ? n + ' registros antigos removidos.' : 'Nada com mais de 90 dias.';
    admAudCarregar(true);
  }).catch(function(){ msg.textContent = 'Não foi possível limpar.'; });
}

/* ---- saúde: backup + checklist do Console ---- */
function admSaudeCarregar(){
  var info = document.getElementById('admBackupInfo');
  if(info) db.collection('config').doc('backups').get().then(function(s){
    if(!s.exists || !s.data().quando || !s.data().quando.toDate){
      info.innerHTML = '<b>Nenhum backup registrado.</b> O conteúdo das views que vivem no Firestore não tem cópia versionada — faça o primeiro export.';
      return;
    }
    var dias = Math.floor((Date.now() - s.data().quando.toMillis()) / 864e5);
    info.innerHTML = 'Último backup: <b>' + s.data().quando.toDate().toLocaleDateString('pt-BR') + '</b>' +
      (s.data().quem ? ' por ' + escHtml(s.data().quem) : '') +
      (dias > 30 ? ' — <b>há ' + dias + ' dias</b>, hora de fazer outro.' : ' (há ' + dias + ' dia' + (dias === 1 ? '' : 's') + ').');
  }).catch(function(){ info.textContent = 'Sem acesso ao registro de backups — as regras foram publicadas?'; });

  var host = document.getElementById('admCheck');
  if(!host) return;
  db.collection('config').doc('checklistSeguranca').get().then(function(s){
    var feito = s.exists ? (s.data() || {}) : {};
    host.innerHTML = ADM_CHECK_ITENS.map(function(it){
      return '<label class="adm-check"><input type="checkbox" data-check="' + it.k + '"' + (feito[it.k] ? ' checked' : '') + '> <span>' + it.t + '</span></label>';
    }).join('');
  }).catch(function(){
    host.innerHTML = '<p class="load-note">Sem acesso ao checklist — as regras foram publicadas?</p>';
  });
}
function admCheckSalvar(ev){
  var cb = ev.target.closest('[data-check]'); if(!cb) return;
  var patch = {};
  patch[cb.dataset.check] = cb.checked;
  db.collection('config').doc('checklistSeguranca').set(patch, { merge: true }).catch(function(){
    cb.checked = !cb.checked;
  });
}
