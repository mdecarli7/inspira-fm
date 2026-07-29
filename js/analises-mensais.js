'use strict';
/* =====================================================================
 * analises-mensais.js — histórico mensal digitado das views Site e MobRadio
 * Extensões das views existentes #view-site e #view-mobradio (não criam
 * view nova): cada init injeta um bloco ACIMA do cartão "integração em
 * preparação", que continua lá como aviso do plano de automação.
 *
 * Dados (padrão da Análise Dial — doc único com rows[]):
 *   analises/site     { rows:[{ m:'YYYY-MM', usuarios, sessoes, pageviews,
 *                              origem, obs }], atualizadoPor, atualizadoEm }
 *   analises/mobradio { rows:[{ m:'YYYY-MM', ouvintes, tempoMedio,
 *                              downloads, obs }], atualizadoPor, atualizadoEm }
 *
 * Leitura por get() pontual com trava (AN.lido) — o número muda 1×/mês,
 * onSnapshot aqui só queimaria leituras do plano Spark. Relê após salvar.
 * Editor só aparece pra diretoria (canRe); as rules de `analises` já
 * garantem isso no servidor (todo aprovado lê, diretoria escreve).
 * Usa os globais do runtime: registrarModulo, canRe, db, ME, escHtml,
 * fmtInt, btnBusy, flashMsg, auditar, reduceMotion.
 * ===================================================================== */

registrarModulo({ id: 'an-site', extensaoDe: 'site', init: anSiteInit });
registrarModulo({ id: 'an-mob', extensaoDe: 'mobradio', init: anMobInit });

/* =================== configuração dos dois blocos =================== */
/* campos: k = chave no doc; tipo 'num' vira Number no save (vazio = null),
   'txt' fica string; ph = placeholder/aria-label do input do editor */
var AN_SITE = {
  pfx: 'anSite', view: 'view-site', doc: 'site',
  titulo: 'Histórico mensal do site',
  rotAudit: 'Análise Site — histórico mensal',
  fonte: 'Fonte: Google Analytics (digitação manual mensal)',
  integ: 'GA4',
  campos: [
    { k: 'usuarios', tipo: 'num', ph: 'usuários' },
    { k: 'sessoes', tipo: 'num', ph: 'sessões' },
    { k: 'pageviews', tipo: 'num', ph: 'pageviews' },
    { k: 'origem', tipo: 'txt', ph: 'origem principal (ex.: Google)' },
    { k: 'obs', tipo: 'txt', ph: 'observações' }
  ],
  thead: '<th scope="col">Mês</th><th scope="col" class="num">Usuários</th>' +
    '<th scope="col" class="num">Sessões</th><th scope="col" class="num">Pageviews</th>' +
    '<th scope="col">Origem principal</th><th scope="col">Observações</th>',
  linha: function(r){
    return '<tr><td><b>' + escHtml(anMesLabel(r.m)) + '</b></td>' +
      '<td class="num">' + anMesNum(r.usuarios) + '</td>' +
      '<td class="num">' + anMesNum(r.sessoes) + '</td>' +
      '<td class="num">' + anMesNum(r.pageviews) + '</td>' +
      '<td>' + escHtml(r.origem || '—') + '</td>' +
      '<td style="min-width:14rem">' + escHtml(r.obs || '') + '</td></tr>';
  },
  kpis: function(u){
    return anMesKpi(anMesNum(u.usuarios), 'usuários no mês') +
      anMesKpi(anMesNum(u.sessoes), 'sessões') +
      anMesKpi(anMesNum(u.pageviews), 'pageviews') +
      anMesKpi('<span style="font-size:1.05rem">' + escHtml(u.origem || '—') + '</span>', 'origem principal do tráfego');
  },
  bound: false, lido: false, dados: null, edit: []
};

var AN_MOB = {
  pfx: 'anMob', view: 'view-mobradio', doc: 'mobradio',
  titulo: 'Histórico mensal do app',
  rotAudit: 'Análise MobRadio — histórico mensal',
  fonte: 'Fonte: painel MobRadio (digitação manual mensal)',
  integ: 'API MobRadio',
  campos: [
    { k: 'ouvintes', tipo: 'num', ph: 'ouvintes (pico simultâneos)' },
    { k: 'tempoMedio', tipo: 'txt', ph: 'tempo médio (ex.: 42 min)' },
    { k: 'downloads', tipo: 'num', ph: 'downloads' },
    { k: 'obs', tipo: 'txt', ph: 'observações' }
  ],
  thead: '<th scope="col">Mês</th><th scope="col" class="num">Ouvintes (pico)</th>' +
    '<th scope="col">Tempo médio</th><th scope="col" class="num">Downloads</th>' +
    '<th scope="col">Observações</th>',
  linha: function(r){
    return '<tr><td><b>' + escHtml(anMesLabel(r.m)) + '</b></td>' +
      '<td class="num">' + anMesNum(r.ouvintes) + '</td>' +
      '<td>' + escHtml(r.tempoMedio || '—') + '</td>' +
      '<td class="num">' + anMesNum(r.downloads) + '</td>' +
      '<td style="min-width:14rem">' + escHtml(r.obs || '') + '</td></tr>';
  },
  kpis: function(u){
    return anMesKpi(anMesNum(u.ouvintes), 'ouvintes no pico (simultâneos)') +
      anMesKpi('<span style="font-size:1.05rem">' + escHtml(u.tempoMedio || '—') + '</span>', 'tempo médio de escuta') +
      anMesKpi(anMesNum(u.downloads), 'downloads no mês');
  },
  bound: false, lido: false, dados: null, edit: []
};

function anSiteInit(){ anMesInit(AN_SITE); }
function anMobInit(){ anMesInit(AN_MOB); }

/* =================== helpers comuns (anMes*) =================== */
var AN_MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/* 'YYYY-MM' → 'ago/2026'; formato estranho volta como veio (o chamador escapa) */
function anMesLabel(m){
  var p = /^(\d{4})-(\d{2})$/.exec(String(m || ''));
  if(!p) return String(m || '—');
  var i = +p[2] - 1;
  if(i < 0 || i > 11) return String(m);
  return AN_MESES[i] + '/' + p[1];
}
/* fmtInt só aceita número: null/ausente vira travessão em vez de quebrar */
function anMesNum(n){
  return (typeof n === 'number' && isFinite(n)) ? fmtInt(n) : '—';
}
function anMesKpi(v, rot){
  return '<div class="adm-kpi"><b>' + v + '</b><span>' + rot + '</span></div>';
}
/* rows do doc em cópia ordenada por mês desc (mais recente primeiro) */
function anMesRowsDesc(cfg){
  var rows = (cfg.dados && cfg.dados.rows) || [];
  return rows.slice().sort(function(a, b){
    var x = String(a.m || ''), y = String(b.m || '');
    return x < y ? 1 : x > y ? -1 : 0;
  });
}

/* =================== entrada (roda a cada navegação pra view) =================== */
function anMesInit(cfg){
  if(!cfg.bound){
    cfg.bound = true;
    anMesMontar(cfg);
  }
  if(cfg.lido) return;   // já leu nesta sessão — get pontual, não repete
  anMesCarregar(cfg);
}

/* =================== markup (injetado uma vez, acima do placeholder) =================== */
function anMesMontar(cfg){
  var sec = document.getElementById(cfg.view);
  if(!sec) return;
  var box = document.createElement('div');
  box.id = cfg.pfx + 'Box';
  box.style.margin = '0 0 1.8rem';
  box.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:.8rem;flex-wrap:wrap;margin:0 0 .9rem">' +
      '<h3 style="margin:0">' + escHtml(cfg.titulo) + '</h3>' +
      (canRe() ? '<button type="button" class="mini" id="' + cfg.pfx + 'EditBtn">Editar dados</button>' : '') +
    '</div>' +
    '<div class="adm-kpis" id="' + cfg.pfx + 'Kpis"></div>' +
    '<div id="' + cfg.pfx + 'Form" hidden style="border:1px solid var(--line);border-radius:.9rem;background:var(--surface);padding:1rem;margin:0 0 1.2rem">' +
      '<div id="' + cfg.pfx + 'Rows"></div>' +
      '<div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-top:.8rem">' +
        '<button type="button" class="btn" id="' + cfg.pfx + 'Salvar">Salvar</button>' +
        '<button type="button" class="btn ghost" id="' + cfg.pfx + 'Cancelar">Cancelar</button>' +
        '<span class="fin-msg" id="' + cfg.pfx + 'Msg" role="status" aria-live="polite"></span>' +
      '</div>' +
    '</div>' +
    '<div id="' + cfg.pfx + 'Table"><div class="load-note">Carregando…</div></div>' +
    '<p class="chart-note" id="' + cfg.pfx + 'Fonte">' + escHtml(cfg.fonte) + '</p>';
  /* acima do cartão "integração em preparação", que segue visível abaixo */
  var wrap = sec.querySelector('.section .wrap');
  if(wrap) wrap.insertBefore(box, wrap.firstChild);
  else sec.appendChild(box);

  var eb = document.getElementById(cfg.pfx + 'EditBtn');
  if(eb) eb.addEventListener('click', function(){ anMesEdit(cfg); });
  document.getElementById(cfg.pfx + 'Cancelar').addEventListener('click', function(){
    document.getElementById(cfg.pfx + 'Form').hidden = true;
  });
  document.getElementById(cfg.pfx + 'Salvar').addEventListener('click', function(){ anMesSave(cfg); });
}

/* =================== leitura (get pontual) =================== */
function anMesCarregar(cfg){
  db.collection('analises').doc(cfg.doc).get().then(function(snap){
    cfg.lido = true;
    cfg.dados = snap.exists ? snap.data() : null;
    anMesRender(cfg, false);
  }).catch(function(){
    /* lido fica false: erro transitório (offline) tenta de novo na próxima visita */
    cfg.dados = null;
    anMesRender(cfg, true);
  });
}

/* =================== render (KPIs + tabela + rodapé) =================== */
function anMesRender(cfg, erro){
  var k = document.getElementById(cfg.pfx + 'Kpis');
  var t = document.getElementById(cfg.pfx + 'Table');
  if(!k || !t) return;
  var rows = anMesRowsDesc(cfg);
  if(!rows.length){
    k.innerHTML = '';
    t.innerHTML = '<div class="proj-empty">' + (erro
      ? 'Sem acesso aos números — as regras da coleção <b>analises</b> foram publicadas?'
      : 'Nenhum dado ainda — a diretoria digita os números do mês aqui até a integração automática (' + escHtml(cfg.integ) + ') sair.' +
        (canRe() ? ' Clique em <b>Editar dados</b> para lançar o primeiro mês.' : '')) + '</div>';
    return;
  }
  var u = rows[0];   // mês mais recente
  k.innerHTML = cfg.kpis(u) +
    '<div class="adm-kpi"><b style="font-size:1.05rem">' + escHtml(anMesLabel(u.m)) + '</b><span>mês de referência</span></div>';
  t.innerHTML = '<div class="tbl-scroll"><table class="users-table"><thead><tr>' + cfg.thead +
    '</tr></thead><tbody>' + rows.map(cfg.linha).join('') + '</tbody></table></div>';
  var f = document.getElementById(cfg.pfx + 'Fonte');
  if(f) f.textContent = cfg.fonte + (cfg.dados && cfg.dados.atualizadoPor
    ? ' · Última atualização por ' + cfg.dados.atualizadoPor : '');
}

/* =================== editor inline (só diretoria) =================== */
function anMesEdit(cfg){
  if(!canRe()) return;
  /* cópia em memória, cronológica e com números como string pros inputs */
  cfg.edit = anMesRowsDesc(cfg).reverse().map(function(r){
    var o = { m: String(r.m || '') };
    cfg.campos.forEach(function(c){
      var v = r[c.k];
      o[c.k] = (c.tipo === 'num')
        ? (typeof v === 'number' && isFinite(v) ? String(v) : '')
        : String(v || '');
    });
    return o;
  });
  if(!cfg.edit.length) cfg.edit.push(anMesLinhaVazia(cfg));
  anMesFormRender(cfg);
  var f = document.getElementById(cfg.pfx + 'Form');
  f.hidden = false;
  f.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}
function anMesLinhaVazia(cfg){
  var o = { m: '' };
  cfg.campos.forEach(function(c){ o[c.k] = ''; });
  return o;
}
function anMesInputHtml(cfg, r, c){
  var tipo = c.tipo === 'num' ? ' type="number" min="0" step="1" style="max-width:9rem"' : ' style="min-width:11rem"';
  return '<input class="fin-input am-' + c.k + '"' + tipo +
    ' value="' + escHtml(r[c.k]) + '" placeholder="' + escHtml(c.ph) + '" aria-label="' + escHtml(c.ph) + '">';
}
function anMesFormRender(cfg){
  var host = document.getElementById(cfg.pfx + 'Rows');
  host.innerHTML = cfg.edit.map(function(r, i){
    return '<div class="am-row" data-i="' + i + '" style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:.5rem">' +
      '<input type="month" class="fin-input am-m" style="max-width:11rem" value="' + escHtml(r.m) + '" aria-label="Mês (AAAA-MM)">' +
      cfg.campos.map(function(c){ return anMesInputHtml(cfg, r, c); }).join('') +
      '<button type="button" class="i-del" title="Remover" aria-label="Remover mês">×</button></div>';
  }).join('') +
  '<div class="pp-add"><button type="button" class="mini" data-add="1">+ Adicionar mês</button></div>';

  host.onclick = function(ev){
    var b = ev.target.closest('button'); if(!b) return;
    if(b.dataset.add){ cfg.edit.push(anMesLinhaVazia(cfg)); anMesFormRender(cfg); }
    else if(b.classList.contains('i-del')){ cfg.edit.splice(+b.closest('.am-row').dataset.i, 1); anMesFormRender(cfg); }
  };
  host.oninput = function(ev){
    var row = ev.target.closest('.am-row'); if(!row) return;
    var r = cfg.edit[+row.dataset.i]; if(!r) return;
    if(ev.target.classList.contains('am-m')){ r.m = ev.target.value; return; }
    for(var i = 0; i < cfg.campos.length; i++){
      if(ev.target.classList.contains('am-' + cfg.campos[i].k)){ r[cfg.campos[i].k] = ev.target.value; return; }
    }
  };
}

/* =================== save (doc inteiro, como o Dial) =================== */
function anMesSave(cfg){
  /* só entra linha com mês válido AAAA-MM; número vazio/ruim vira null */
  var rows = cfg.edit.filter(function(r){ return /^\d{4}-\d{2}$/.test((r.m || '').trim()); })
    .map(function(r){
      var o = { m: r.m.trim() };
      cfg.campos.forEach(function(c){
        if(c.tipo === 'num'){
          var v = String(r[c.k] || '').trim();
          o[c.k] = (v !== '' && isFinite(Number(v))) ? Number(v) : null;
        }else{
          o[c.k] = String(r[c.k] || '').trim();
        }
      });
      return o;
    })
    .sort(function(a, b){ return a.m < b.m ? -1 : a.m > b.m ? 1 : 0; });   // guarda cronológico
  var btn = document.getElementById(cfg.pfx + 'Salvar');
  btnBusy(btn, true);
  db.collection('analises').doc(cfg.doc).set({
    rows: rows,
    atualizadoPor: ME.nome || ME.email,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){
    auditar('editar', 'analises', cfg.doc, cfg.rotAudit + ' (' + rows.length + ' meses)');
    document.getElementById(cfg.pfx + 'Form').hidden = true;
    cfg.lido = false;
    anMesCarregar(cfg);   // relê após salvar: pega o serverTimestamp resolvido
  }).catch(function(){
    flashMsg(cfg.pfx + 'Msg', 'Sem permissão para salvar — só a diretoria edita estes números.');
  }).finally(function(){ btnBusy(btn, false); });
}
