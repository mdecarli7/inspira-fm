'use strict';
/* =====================================================================
 * comercial-painel.js — Painel do comercial (view #comercial, gate com)
 * Subabas: Visão geral (KPIs, funil, renovações, follow-ups, cotas por
 * campanha) · Produtos e tabela (o editor do doc config/comercial).
 * Carrega depois do runtime.js, base-org.js e comercial-core.js — usa os
 * globais deles (ME, UNSUB, escHtml, fmtBRL, fmtInt, btnBusy, flashMsg,
 * auditar, canRe, col, canCom, COM_ETAPAS, comCfgCarregar, COM_CFG,
 * comDiasAte). PREÇO NUNCA em código: o repositório é público — a tabela
 * de produtos/valores vive no doc Firestore config/comercial (aba 2 daqui).
 * Este módulo só LÊ negocios/contratos/agenda_comercial/campanhas; a única
 * escrita fora do config é o sync de comVendido em campanhas — com
 * confirm() e restrito à diretoria.
 * ===================================================================== */

registrarModulo({ id: 'comercial', need: 'com', init: comInit });

var comBound = false, COM_TAB = 'visao';
var COM_NEG = [], COM_CTR = [], COM_AGD = [], COM_CAMPS = [];
var COM_ERR = { neg: false, ctr: false, agc: false, camp: false };
var COM_PROD_ROWS = [];
var COM_TIPOS = [
  ['quadro', 'Quadro'],
  ['combo', 'Combo'],
  ['cota_master', 'Cota master'],
  ['360', '360']
];
var COM_AGD_TIPOS = { followup: 'Follow-up', reuniao: 'Reunião', tarefa: 'Tarefa' };
var COM_SEM_ACESSO = 'Sem acesso — flag verComercial liberada e regras publicadas?';
/* grid das linhas do editor de produtos (inline: não há classe própria no CSS) */
var COM_ROW_CSS = 'display:grid;grid-template-columns:1.3fr .8fr .7fr .55fr auto 1.5fr 2rem;gap:.4rem;align-items:center;margin-bottom:.45rem';

/* ---- entrada ---- */
function comInit(){
  if(!canCom()) return;
  if(!comBound){
    comBound = true;
    comMarkup();
    comBind();
  }
  comStreams();
  comTabSet(COM_TAB);
  comCfgCarregar().then(function(){
    comProdFormCarregar();
    comRenderVisao();
  });
}

/* ---- markup (injetado no 1º acesso; a section no index é casca vazia) ---- */
function comMarkup(){
  document.getElementById('view-comercial').innerHTML =
    '<div class="page-hero">' +
      '<svg class="waves" viewBox="0 0 1440 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<path class="wave-drift" d="M-80,110 C320,30 620,200 980,120 C1220,68 1380,140 1520,90 L1520,-60 L-80,-60 Z" fill="var(--teal-800)"/>' +
        '<path class="wave-drift w2" d="M-100,560 C300,480 660,640 1040,550 C1260,500 1420,570 1540,530 L1540,720 L-100,720 Z" fill="var(--teal-950)"/>' +
      '</svg>' +
      '<div class="wrap">' +
        '<p class="crumb">Comercial · Visão geral</p>' +
        '<h1 id="com-title">Painel comercial</h1>' +
        '<p class="sub">Funil de negócios, contratos, follow-ups da semana e a tabela de produtos — a saúde do comercial num só lugar.</p>' +
      '</div>' +
    '</div>' +
    '<div class="section"><div class="wrap">' +
      '<div class="camp-tabs" id="comTabs">' +
        '<button type="button" data-comtab="visao" class="on">Visão geral</button>' +
        '<button type="button" data-comtab="produtos">Produtos e tabela</button>' +
      '</div>' +
      '<p class="chart-note" aria-live="polite"><span id="comMsg"></span></p>' +

      '<div id="comPanelVisao">' +
        '<h3 style="margin-top:1.2rem">Números de agora</h3>' +
        '<div class="adm-kpis" id="comKpis"><div class="load-note">Carregando…</div></div>' +

        '<h3>Funil de negócios</h3>' +
        '<p class="lead">Cada negócio conta uma vez, na etapa em que está. Os valores são o mensal em jogo.</p>' +
        '<div class="tbl-scroll"><table class="users-table"><thead><tr>' +
          '<th scope="col">Etapa</th><th scope="col" style="text-align:right">Negócios</th><th scope="col" style="text-align:right">R$/mês</th><th scope="col">Volume</th>' +
        '</tr></thead><tbody id="comFunil"><tr><td colspan="4" class="load-note">Carregando…</td></tr></tbody></table></div>' +

        '<h3>Contratos a renovar</h3>' +
        '<div class="tbl-scroll"><table class="users-table"><thead><tr>' +
          '<th scope="col">Cliente</th><th scope="col">Produto</th><th scope="col">Fim</th><th scope="col">Prazo</th>' +
        '</tr></thead><tbody id="comRenova"><tr><td colspan="4" class="load-note">Carregando…</td></tr></tbody></table></div>' +
        '<p class="chart-note"><a href="#contratos">Ver todos os contratos</a></p>' +

        '<h3>Follow-ups dos próximos 7 dias</h3>' +
        '<div class="tbl-scroll"><table class="users-table"><thead><tr>' +
          '<th scope="col">Quando</th><th scope="col">Tipo</th><th scope="col">O quê</th><th scope="col">Cliente</th>' +
        '</tr></thead><tbody id="comFollow"><tr><td colspan="4" class="load-note">Carregando…</td></tr></tbody></table></div>' +
        '<p class="chart-note"><a href="#agenda-comercial">Abrir agenda</a></p>' +

        '<h3>Cotas por campanha</h3>' +
        '<p class="lead">Soma dos contratos ativos ligados a cada campanha vs o que a campanha registra como vendido. Sincronizar escreve o total no <code>comVendido</code> da campanha (só diretoria).</p>' +
        '<div class="tbl-scroll"><table class="users-table"><thead><tr>' +
          '<th scope="col">Campanha</th><th scope="col" style="text-align:right">Contratos ativos</th><th scope="col" style="text-align:right">comVendido hoje</th><th scope="col" style="text-align:right">Meta</th><th scope="col"></th>' +
        '</tr></thead><tbody id="comCotas"><tr><td colspan="5" class="load-note">Carregando…</td></tr></tbody></table></div>' +
      '</div>' +

      '<div id="comPanelProdutos" hidden>' +
        '<p class="lead" style="margin-top:1.2rem"><b>Tabela privada</b> — visível só pra quem tem acesso ao comercial. O repositório do site é público: preço nunca vai em código.</p>' +
        '<h3>Produtos</h3>' +
        '<div style="overflow-x:auto"><div id="comProdRows" style="min-width:820px"><div class="load-note">Carregando…</div></div></div>' +
        '<h3>Categorias de exclusividade</h3>' +
        '<p class="lead">Uma categoria por linha (ex.: imobiliário, saúde, educação). Usadas pra travar exclusividade de anunciante por produto.</p>' +
        '<textarea class="fin-input" id="comCats" rows="5" placeholder="uma por linha" style="width:100%;max-width:32rem"></textarea>' +
        '<h3>Regras</h3>' +
        '<div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:flex-end">' +
          '<label>Contrato mínimo (meses)<br><input class="fin-input" id="comRegraMin" type="number" min="1" step="1" style="max-width:9rem"></label>' +
          '<label>Aviso prévio de renovação (dias)<br><input class="fin-input" id="comRegraAviso" type="number" min="1" step="1" style="max-width:9rem"></label>' +
          '<label style="display:flex;gap:.4rem;align-items:center"><input type="checkbox" id="comRegraRel"> Relatório mensal incluso</label>' +
        '</div>' +
        '<h3>Meta mensal (R$)</h3>' +
        '<p class="lead">Base do termômetro da Visão geral: receita contratada ÷ meta.</p>' +
        '<input class="fin-input" id="comMeta" type="number" min="0" step="0.01" placeholder="ex.: 15000" style="max-width:14rem">' +
        '<p class="chart-note" style="margin-top:1rem"><button type="button" class="btn primary" id="comTabSalvar">Salvar tabela</button></p>' +
      '</div>' +
    '</div></div>';
}

/* ---- eventos ---- */
function comBind(){
  document.getElementById('comTabs').addEventListener('click', function(ev){
    var b = ev.target.closest('[data-comtab]'); if(!b) return;
    comTabSet(b.dataset.comtab);
  });
  document.getElementById('comCotas').addEventListener('click', comCotasClick);
  var sv = document.getElementById('comTabSalvar');
  if(!canRe()){ sv.disabled = true; sv.title = 'só diretoria salva a tabela'; }
  sv.addEventListener('click', comProdSalvar);
}
function comTabSet(t){
  COM_TAB = t;
  document.querySelectorAll('[data-comtab]').forEach(function(b){
    b.classList.toggle('on', b.dataset.comtab === t);
  });
  document.getElementById('comPanelVisao').hidden = t !== 'visao';
  document.getElementById('comPanelProdutos').hidden = t !== 'produtos';
}

/* ---- streams (chaves exclusivas deste módulo no UNSUB) ---- */
function comStreams(){
  if(!canCom()) return;
  if(!UNSUB.comNeg) UNSUB.comNeg = col('negocios').onSnapshot(function(qs){
    COM_NEG = [];
    qs.forEach(function(doc){ COM_NEG.push({ id: doc.id, d: doc.data() }); });
    COM_ERR.neg = false; comRenderVisao();
  }, function(){ COM_ERR.neg = true; comRenderVisao(); });

  if(!UNSUB.comCtr) UNSUB.comCtr = col('contratos').onSnapshot(function(qs){
    COM_CTR = [];
    qs.forEach(function(doc){ COM_CTR.push({ id: doc.id, d: doc.data() }); });
    COM_ERR.ctr = false; comRenderVisao();
  }, function(){ COM_ERR.ctr = true; comRenderVisao(); });

  if(!UNSUB.comAgc) UNSUB.comAgc = col('agenda_comercial').onSnapshot(function(qs){
    COM_AGD = [];
    qs.forEach(function(doc){ COM_AGD.push({ id: doc.id, d: doc.data() }); });
    COM_ERR.agc = false; comRenderVisao();
  }, function(){ COM_ERR.agc = true; comRenderVisao(); });

  /* campanhas: leitura só pra casar cota × meta; a única escrita é o sync (diretoria) */
  if(!UNSUB.comCamp) UNSUB.comCamp = col('campanhas').onSnapshot(function(qs){
    COM_CAMPS = [];
    qs.forEach(function(doc){ COM_CAMPS.push({ id: doc.id, d: doc.data() }); });
    COM_ERR.camp = false; comRenderVisao();
  }, function(){ COM_ERR.camp = true; comRenderVisao(); });
}

/* ---- helpers ---- */
function comKpi(n, rot){ return '<div class="adm-kpi"><b>' + n + '</b><span>' + rot + '</span></div>'; }
function comAvisoDias(){
  return COM_CFG && COM_CFG.regras && +COM_CFG.regras.avisoPrevioDias ? +COM_CFG.regras.avisoPrevioDias : 30;
}
/* YYYY-MM-DD → DD/MM/YYYY (sem Date: evita fuso). Sempre escapado: é dado. */
function comDataBR(iso){
  if(!iso) return '—';
  var p = String(iso).split('-');
  return escHtml(p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso);
}
/* slug pro id do produto: minúsculas, sem acento, hífens */
function comSlug(s){
  s = String(s || '').toLowerCase();
  var de = 'áàâãäéèêëíìîïóòôõöúùûüçñ', para = 'aaaaaeeeeiiiiooooouuuucn';
  var out = '', i, p;
  for(i = 0; i < s.length; i++){
    p = de.indexOf(s.charAt(i));
    out += p >= 0 ? para.charAt(p) : s.charAt(i);
  }
  return out.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'produto';
}

/* ---- aba Visão geral ---- */
function comRenderVisao(){
  if(!comBound) return;
  comKpisRender();
  comFunilRender();
  comRenovaRender();
  comFollowRender();
  comCotasRender();
}

function comKpisRender(){
  var host = document.getElementById('comKpis');
  if(!host) return;
  if(COM_ERR.neg || COM_ERR.ctr){
    host.innerHTML = '<div class="load-note">' + COM_SEM_ACESSO + '</div>';
    return;
  }
  var nAb = 0, somaAb = 0;
  COM_NEG.forEach(function(g){
    var e = g.d.etapa || 'novo';
    if(e === 'ganho' || e === 'perdido') return;
    nAb++;
    somaAb += +g.d.valorMensal || 0;
  });
  var nAt = 0, receita = 0;
  COM_CTR.forEach(function(c){
    if((c.d.status || '') !== 'ativo') return;
    nAt++;
    receita += +c.d.valorMensal || 0;
  });
  var aviso = comAvisoDias(), nRen = 0;
  COM_CTR.forEach(function(c){
    if((c.d.status || '') !== 'ativo') return;
    var dias = comDiasAte(c.d.fim);
    if(dias !== null && dias >= 0 && dias <= aviso) nRen++;
  });
  var meta = COM_CFG && +COM_CFG.metaMensal > 0 ? +COM_CFG.metaMensal : 0;
  var termo = meta
    ? comKpi(Math.round(receita / meta * 100) + '%', 'da meta mensal (R$ ' + fmtBRL(meta) + ')')
    : comKpi('—', 'defina a meta na aba Produtos');
  host.innerHTML =
    comKpi(fmtInt(nAb), 'negócios abertos · R$ ' + fmtBRL(somaAb) + '/mês em aberto') +
    comKpi(fmtInt(nAt), 'contratos ativos · R$ ' + fmtBRL(receita) + '/mês contratados') +
    termo +
    comKpi(fmtInt(nRen), 'a renovar em até ' + aviso + ' dias');
}

function comFunilRender(){
  var host = document.getElementById('comFunil');
  if(!host) return;
  if(COM_ERR.neg){
    host.innerHTML = '<tr><td colspan="4" class="load-note">' + COM_SEM_ACESSO + '</td></tr>';
    return;
  }
  var porEtapa = {};
  COM_ETAPAS.forEach(function(e){ porEtapa[e[0]] = { n: 0, soma: 0 }; });
  COM_NEG.forEach(function(g){
    var st = porEtapa[g.d.etapa || 'novo'];
    if(!st) return; /* etapa desconhecida: fora do funil */
    st.n++;
    st.soma += +g.d.valorMensal || 0;
  });
  /* barra proporcional à CONTAGEM da etapa mais cheia (funil é fluxo de negócios) */
  var max = 0;
  COM_ETAPAS.forEach(function(e){ if(porEtapa[e[0]].n > max) max = porEtapa[e[0]].n; });
  host.innerHTML = COM_ETAPAS.map(function(e){
    var st = porEtapa[e[0]];
    var pct = max ? Math.round(st.n / max * 100) : 0;
    return '<tr>' +
      '<td>' + escHtml(e[1]) + '</td>' +
      '<td style="text-align:right"><b>' + fmtInt(st.n) + '</b></td>' +
      '<td style="text-align:right">R$ ' + fmtBRL(st.soma) + '</td>' +
      '<td style="width:38%;min-width:160px"><div style="height:10px;border-radius:5px;background:var(--teal-700);width:' + pct + '%' + (st.n ? ';min-width:4px' : '') + '"></div></td>' +
    '</tr>';
  }).join('') + (COM_NEG.length ? '' : '<tr><td colspan="4" class="load-note">Nenhum negócio no funil ainda.</td></tr>');
}

function comRenovaRender(){
  var host = document.getElementById('comRenova');
  if(!host) return;
  if(COM_ERR.ctr){
    host.innerHTML = '<tr><td colspan="4" class="load-note">' + COM_SEM_ACESSO + '</td></tr>';
    return;
  }
  var ativos = COM_CTR.filter(function(c){ return (c.d.status || '') === 'ativo' && c.d.fim; });
  ativos.sort(function(a, b){ return a.d.fim < b.d.fim ? -1 : a.d.fim > b.d.fim ? 1 : 0; });
  var top = ativos.slice(0, 5);
  if(!top.length){
    host.innerHTML = '<tr><td colspan="4" class="load-note">Nenhum contrato ativo com data de fim.</td></tr>';
    return;
  }
  host.innerHTML = top.map(function(c){
    var dias = comDiasAte(c.d.fim), prazo;
    if(dias === null) prazo = '—';
    else if(dias < 0) prazo = 'venceu há ' + (-dias) + ' dia' + (dias === -1 ? '' : 's');
    else if(dias === 0) prazo = 'termina hoje';
    else prazo = 'em ' + dias + ' dia' + (dias === 1 ? '' : 's');
    return '<tr>' +
      '<td>' + escHtml(c.d.clienteNome || '') + '</td>' +
      '<td>' + escHtml(c.d.produtoNome || '') + '</td>' +
      '<td>' + comDataBR(c.d.fim) + '</td>' +
      '<td>' + escHtml(prazo) + '</td></tr>';
  }).join('');
}

function comFollowRender(){
  var host = document.getElementById('comFollow');
  if(!host) return;
  if(COM_ERR.agc){
    host.innerHTML = '<tr><td colspan="4" class="load-note">' + COM_SEM_ACESSO + '</td></tr>';
    return;
  }
  var rows = COM_AGD.filter(function(a){
    if(a.d.feito) return false;
    if(!COM_AGD_TIPOS[a.d.tipo || '']) return false;
    var dias = comDiasAte(a.d.data);
    return dias !== null && dias >= 0 && dias <= 7;
  });
  rows.sort(function(a, b){ return (a.d.data || '') < (b.d.data || '') ? -1 : 1; });
  var top = rows.slice(0, 6);
  if(!top.length){
    host.innerHTML = '<tr><td colspan="4" class="load-note">Nada agendado pros próximos 7 dias.</td></tr>';
    return;
  }
  host.innerHTML = top.map(function(a){
    return '<tr>' +
      '<td>' + comDataBR(a.d.data) + '</td>' +
      '<td><span class="pill">' + escHtml(COM_AGD_TIPOS[a.d.tipo]) + '</span></td>' +
      '<td>' + escHtml(a.d.titulo || '') + '</td>' +
      '<td>' + escHtml(a.d.clienteNome || '') + '</td></tr>';
  }).join('');
}

function comCotasRender(){
  var host = document.getElementById('comCotas');
  if(!host) return;
  if(COM_ERR.ctr || COM_ERR.camp){
    host.innerHTML = '<tr><td colspan="5" class="load-note">' + COM_SEM_ACESSO + '</td></tr>';
    return;
  }
  var porCamp = {};
  COM_CTR.forEach(function(c){
    if((c.d.status || '') !== 'ativo') return;
    var cid = c.d.campanhaId || '';
    if(!cid) return;
    if(!porCamp[cid]) porCamp[cid] = { soma: 0, n: 0 };
    porCamp[cid].soma += +c.d.valorMensal || 0;
    porCamp[cid].n++;
  });
  var ids = Object.keys(porCamp);
  if(!ids.length){
    host.innerHTML = '<tr><td colspan="5" class="load-note">Nenhum contrato ativo ligado a campanha.</td></tr>';
    return;
  }
  host.innerHTML = ids.map(function(cid){
    var g = porCamp[cid], camp = null, i;
    for(i = 0; i < COM_CAMPS.length; i++) if(COM_CAMPS[i].id === cid){ camp = COM_CAMPS[i].d; break; }
    var nome = camp ? (camp.nome || cid) : cid + ' (campanha não encontrada)';
    var acao = !camp ? '' : canRe()
      ? '<button type="button" class="mini" data-sync="' + escHtml(cid) + '" data-soma="' + g.soma + '" data-nome="' + escHtml(camp.nome || cid) + '">Sincronizar comVendido</button>'
      : '<span title="só diretoria escreve em campanhas">—</span>';
    return '<tr>' +
      '<td>' + escHtml(nome) + '</td>' +
      '<td style="text-align:right">R$ ' + fmtBRL(g.soma) + ' · ' + fmtInt(g.n) + ' contrato' + (g.n === 1 ? '' : 's') + '</td>' +
      '<td style="text-align:right">' + (camp ? 'R$ ' + fmtBRL(+camp.comVendido || 0) : '—') + '</td>' +
      '<td style="text-align:right">' + (camp && +camp.comMeta > 0 ? 'R$ ' + fmtBRL(+camp.comMeta) : '—') + '</td>' +
      '<td>' + acao + '</td></tr>';
  }).join('');
}

/* sync: única escrita fora do config — regras de campanhas só deixam a diretoria */
function comCotasClick(ev){
  var btn = ev.target.closest('[data-sync]');
  if(!btn || !canRe()) return;
  var cid = btn.getAttribute('data-sync');
  var soma = +btn.getAttribute('data-soma') || 0;
  var nome = btn.getAttribute('data-nome') || cid;
  if(!confirm('Atualizar o comVendido da campanha "' + nome + '" para R$ ' + fmtBRL(soma) + '?\nIsso escreve na coleção campanhas.')) return;
  btnBusy(btn, true, 'Sincronizando…');
  col('campanhas').doc(cid).update({ comVendido: soma }).then(function(){
    auditar('editar', 'campanhas', cid, 'comVendido sincronizado do comercial');
    flashMsg('comMsg', 'comVendido da campanha atualizado.');
  }).catch(function(){
    flashMsg('comMsg', 'Não deu pra sincronizar — só a diretoria escreve em campanhas.');
  }).finally(function(){ btnBusy(btn, false); });
}

/* ---- aba Produtos e tabela (editor do config/comercial) ---- */
function comProdNova(){
  return { id: '', nome: '', tipo: 'quadro', valorMensal: 0, cotasMax: 7, exclusividadeCategoria: true, descricao: '' };
}
/* popula o form a partir do COM_CFG (chamado no init e depois de salvar —
   voltar pra view descarta edição não salva, igual aos outros editores do app) */
function comProdFormCarregar(){
  if(!comBound || !COM_CFG) return;
  COM_PROD_ROWS = (COM_CFG.produtos || []).map(function(p){
    return {
      id: p.id || '',
      nome: p.nome || '',
      tipo: p.tipo || 'quadro',
      valorMensal: +p.valorMensal || 0,
      cotasMax: +p.cotasMax || 7,
      exclusividadeCategoria: p.exclusividadeCategoria !== false,
      descricao: p.descricao || ''
    };
  });
  if(!COM_PROD_ROWS.length) COM_PROD_ROWS.push(comProdNova());
  comProdRender();
  document.getElementById('comCats').value = (COM_CFG.categorias || []).join('\n');
  var rg = COM_CFG.regras || {};
  document.getElementById('comRegraMin').value = rg.contratoMinMeses || 3;
  document.getElementById('comRegraAviso').value = rg.avisoPrevioDias || 30;
  document.getElementById('comRegraRel').checked = rg.relatorioMensalIncluso === true;
  document.getElementById('comMeta').value = +COM_CFG.metaMensal > 0 ? +COM_CFG.metaMensal : '';
}
function comProdRender(){
  var host = document.getElementById('comProdRows');
  if(!host) return;
  host.innerHTML =
    '<div style="' + COM_ROW_CSS + ';font-size:.85em;opacity:.75">' +
      '<span>Produto</span><span>Tipo</span><span>R$/mês</span><span>Cotas máx.</span><span>Exclusividade</span><span>Descrição</span><span></span>' +
    '</div>' +
    COM_PROD_ROWS.map(function(r, i){
      return '<div class="com-prow" data-i="' + i + '" style="' + COM_ROW_CSS + '">' +
        '<input class="fin-input p-nome" value="' + escHtml(r.nome) + '" placeholder="nome do produto">' +
        '<select class="fin-input p-tipo">' + COM_TIPOS.map(function(t){
          return '<option value="' + t[0] + '"' + (r.tipo === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
        }).join('') + '</select>' +
        '<input class="fin-input p-valor" type="number" min="0" step="0.01" value="' + escHtml(String(+r.valorMensal || '')) + '" placeholder="0,00">' +
        '<input class="fin-input p-cotas" type="number" min="1" step="1" value="' + escHtml(String(+r.cotasMax || 7)) + '">' +
        '<label style="display:flex;gap:.3rem;align-items:center;white-space:nowrap"><input type="checkbox" class="p-excl"' + (r.exclusividadeCategoria ? ' checked' : '') + '> por categoria</label>' +
        '<input class="fin-input p-desc" value="' + escHtml(r.descricao) + '" placeholder="descrição curta">' +
        '<button type="button" class="i-del" title="Remover" aria-label="Remover">×</button>' +
      '</div>';
    }).join('') +
    '<div class="pp-add"><button type="button" class="mini" data-add="1">+ Adicionar produto</button></div>';
  host.onclick = function(ev){
    var b = ev.target.closest('button'); if(!b) return;
    if(b.dataset.add){ COM_PROD_ROWS.push(comProdNova()); comProdRender(); }
    else if(b.classList.contains('i-del')){
      COM_PROD_ROWS.splice(+b.closest('.com-prow').getAttribute('data-i'), 1);
      if(!COM_PROD_ROWS.length) COM_PROD_ROWS.push(comProdNova());
      comProdRender();
    }
  };
  host.oninput = comProdInput;
  host.onchange = comProdInput; /* checkbox/select em navegador antigo */
}
function comProdInput(ev){
  var row = ev.target.closest('.com-prow'); if(!row) return;
  var r = COM_PROD_ROWS[+row.getAttribute('data-i')]; if(!r) return;
  var t = ev.target;
  if(t.classList.contains('p-nome')) r.nome = t.value;
  else if(t.classList.contains('p-tipo')) r.tipo = t.value;
  else if(t.classList.contains('p-valor')) r.valorMensal = t.value;
  else if(t.classList.contains('p-cotas')) r.cotasMax = t.value;
  else if(t.classList.contains('p-excl')) r.exclusividadeCategoria = t.checked;
  else if(t.classList.contains('p-desc')) r.descricao = t.value;
}
function comProdSalvar(){
  if(!canRe()) return;
  var vistos = {};
  var produtos = COM_PROD_ROWS.filter(function(r){ return (r.nome || '').trim(); }).map(function(r){
    /* linha nova ganha id = slug do nome; linha existente preserva o id
       (contratos referenciam produtoId — renomear produto não quebra vínculo) */
    var id = (r.id || '').trim() || comSlug(r.nome), base = id, n = 2;
    while(vistos[id]){ id = base + '-' + n; n++; }
    vistos[id] = 1;
    return {
      id: id,
      nome: r.nome.trim(),
      tipo: r.tipo || 'quadro',
      valorMensal: +r.valorMensal || 0,
      cotasMax: parseInt(r.cotasMax, 10) || 7,
      exclusividadeCategoria: !!r.exclusividadeCategoria,
      descricao: (r.descricao || '').trim()
    };
  });
  var categorias = document.getElementById('comCats').value.split(/\r?\n/)
    .map(function(c){ return c.trim(); })
    .filter(function(c){ return c; });
  var regras = {
    contratoMinMeses: parseInt(document.getElementById('comRegraMin').value, 10) || 3,
    avisoPrevioDias: parseInt(document.getElementById('comRegraAviso').value, 10) || 30,
    relatorioMensalIncluso: document.getElementById('comRegraRel').checked
  };
  var metaMensal = +document.getElementById('comMeta').value || 0;
  var btn = document.getElementById('comTabSalvar');
  btnBusy(btn, true);
  col('config').doc('comercial').set({
    produtos: produtos,
    categorias: categorias,
    regras: regras,
    metaMensal: metaMensal,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    atualizadoPor: ME.nome || ME.email
  }).then(function(){
    auditar('editar', 'config', 'comercial', 'Tabela comercial');
    flashMsg('comMsg', 'Tabela comercial salva.');
    return comCfgCarregar(true);
  }).then(function(){
    comProdFormCarregar();
    comRenderVisao();
  }).catch(function(){
    flashMsg('comMsg', 'Não deu pra salvar — só a diretoria edita a tabela.');
  }).finally(function(){ btnBusy(btn, false); });
}
