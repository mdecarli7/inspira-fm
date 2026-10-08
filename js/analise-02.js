'use strict';
/* =====================================================================
 * analise-02.js — Análise Redes Sociais · Relatório 02 (08/10/2026).
 * View própria #analise-02 (section vazia no index; markup injetado aqui no
 * 1º init). O item "Redes Sociais" do menu aponta pra cá; o Relatório 01
 * (#analise, HTML em content/base.analise no Firestore) segue acessível
 * como histórico pelo link "← Relatório 01 · jul/2026" e ganha, via
 * extensão, uma faixa no topo apontando pro relatório novo.
 *
 * Dados: estáticos neste arquivo (como o PERFIS do Relatório 01 no runtime).
 * São números públicos (SocialBlade + Insights da própria conta) — nada
 * sensível. O bloco "Comparativo" cruza AN02_PERFIS com o PERFIS global
 * (jul/2026) pelo handle do perfil e calcula os deltas em tempo de render.
 * Usa os globais do runtime: registrarModulo, PERFIS, TIPO_COLOR, ALERTA_LBL,
 * escAttr, escHtml, fmtInt, bindTips.
 * ===================================================================== */

registrarModulo({ id: 'analise-02', init: an02Init });
registrarModulo({ id: 'an01-aviso', extensaoDe: 'analise', init: an01Aviso });

/* =================== dados — coleta 08/10/2026 =================== */
/* r = posição geral; seg = seguidores; eng = engajamento em % (curtidas médias
   dos posts recentes ÷ seguidores); curt = curtidas médias/post (texto). */
var AN02_PERFIS = [
 {r:1, nome:'Kiss FM 107,9', perfil:'@kissfm92.5', tipo:'rede', seg:538300, segTxt:'538,3 mil', curt:'952', engTxt:'0,18%', eng:0.18, alerta:null, obs:'Perfil da rede nacional. Local: @kissfmcampinas (3,5 mil).'},
 {r:2, nome:'Antena 1 107,5', perfil:'@antena1', tipo:'rede', seg:262700, segTxt:'262,7 mil', curt:'671', engTxt:'0,26%', eng:0.26, alerta:null, obs:'Rede nacional. Líder no Kantar Ibope de Campinas (jun–ago). Conta local sem dados nesta coleta.'},
 {r:3, nome:'Educadora FM 91,7', perfil:'@educadorafm', tipo:'local', seg:154900, segTxt:'154,9 mil', curt:'253', engTxt:'0,16%', eng:0.16, alerta:'medio', obs:'Maior base local. Voltou ao top 3 do Ibope.'},
 {r:4, nome:'CBN Campinas 99,1', perfil:'@cbncampinas', tipo:'local', seg:99700, segTxt:'99,7 mil', curt:'62', engTxt:'0,06%', eng:0.06, alerta:'alto', obs:'+11 mil seguidores sem ganho de interação. Alerta reforçado.'},
 {r:5, nome:'Band FM 106,7', perfil:'@bandfmcampinas', tipo:'local', seg:96800, segTxt:'96,8 mil', curt:'72', engTxt:'0,07%', eng:0.07, alerta:'medioalto', obs:'Base parada, engajamento caindo. Depende de sorteio.'},
 {r:6, nome:'Nativa FM 89,3', perfil:'@nativacampinas', tipo:'local', seg:94700, segTxt:'94,7 mil', curt:'98', engTxt:'0,10%', eng:0.10, alerta:'medio', obs:'16,9 mil posts; base antiga.'},
 {r:7, nome:'Rede Aleluia 98,3', perfil:'@redealeluia', tipo:'rede', seg:85000, segTxt:'85,0 mil', curt:'656', engTxt:'0,77%', eng:0.77, alerta:null, obs:'Rede nacional; sem Instagram local.'},
 {r:8, nome:'Top FM 96,5', perfil:'@topfmsp', tipo:'rede', seg:83900, segTxt:'83,9 mil', curt:'34', engTxt:'0,04%', eng:0.04, alerta:null, obs:'Perfil da rede (SP); filial sem perfil próprio.'},
 {r:9, nome:'Jovem Pan FM 89,9', perfil:'@jovempancampinas', tipo:'local', seg:44400, segTxt:'44,4 mil', curt:'65', engTxt:'0,15%', eng:0.15, alerta:'medio', obs:'Base estável.'},
 {r:10, nome:'Conecta FM 105,5', perfil:'@fmconecta', tipo:'local', seg:41500, segTxt:'41,5 mil', curt:'801', engTxt:'1,93%', eng:1.93, alerta:'alto', alertaTxt:'ALTO (rever)', obs:'Média saltou de ~14 para 801 curtidas. Conferir se é viral ou sorteio.'},
 {r:11, nome:'INSPIRA FM 97,7', perfil:'@inspirafm', tipo:'inspira', seg:36311, segTxt:'36,3 mil', curt:'51 (últ. 10) · 80 (período)', engTxt:'0,14%', eng:0.14, alerta:'baixo', obs:'Maior ganho absoluto do mercado (+12,3 mil). Virais em 03/08 e 02/09.'},
 {r:12, nome:'Massa FM 97,1', perfil:'@massafmcampinas', tipo:'local', seg:19900, segTxt:'19,9 mil', curt:'66', engTxt:'0,33%', eng:0.33, alerta:'medioalto', obs:'117 comentários/post vindos de sorteio.'},
 {r:13, nome:'EP FM 84,9', perfil:'@epfmcampinas', tipo:'local', seg:15400, segTxt:'15,4 mil', curt:'101', engTxt:'0,65%', eng:0.65, alerta:'baixo', obs:'Grupo EP (EPTV/Globo). Referência de conversa local.'},
 {r:14, nome:'Play FM 99,7', perfil:'@playradio997', tipo:'local', seg:12900, segTxt:'12,9 mil', curt:'63', engTxt:'0,49%', eng:0.49, alerta:'baixo', obs:'Grupo Bandeirantes, estreia abr/2026. Concorrente direta de posicionamento.'},
 {r:15, nome:'Jovem Pan News 100,3', perfil:'@jovempannewscampinas100.3', tipo:'local', seg:12500, segTxt:'12,5 mil', curt:'20', engTxt:'0,16%', eng:0.16, alerta:'baixo', obs:'Também na 92,1 FM desde jan/2026.'},
 {r:16, nome:'Cidade FM 92,5', perfil:'@cidade925', tipo:'local', seg:12300, segTxt:'12,3 mil', curt:'18', engTxt:'0,15%', eng:0.15, alerta:'medio', obs:'Quase não posta.'},
 {r:17, nome:'Bandeirantes 85,7', perfil:'@bandeirantescampinas', tipo:'local', seg:10200, segTxt:'10,2 mil', curt:'251', engTxt:'2,46%', eng:2.46, alerta:'baixo', obs:'Futebol local (Ponte e Guarani) puxa o engajamento.'},
 {r:18, nome:'Laser 93,3', perfil:'@laser933', tipo:'local', seg:7400, segTxt:'7,4 mil', curt:'33', engTxt:'0,45%', eng:0.45, alerta:'baixo', obs:'Maior alta no Ibope (+13,8%), mas pouco ativa no Instagram.'},
 {r:19, nome:'Novabrasil 103,7', perfil:'@novabrasilcampinas', tipo:'local', seg:6100, segTxt:'6,1 mil', curt:'42', engTxt:'0,69%', eng:0.69, alerta:'baixo', obs:'Perfil local pequeno.'},
 {r:20, nome:'Cidade Gospel 97,5', perfil:'@cidadegospel975', tipo:'local', seg:4000, segTxt:'4,0 mil', curt:'2', engTxt:'0,05%', eng:0.05, alerta:'medio', obs:'Antes sem dados; engajamento quase nulo.'},
 {r:21, nome:'Mix FM 101,1', perfil:'@mixfmcampinas', tipo:'local', seg:3800, segTxt:'3,8 mil', curt:'6', engTxt:'0,16%', eng:0.16, alerta:'medio', obs:'Ativa, mas engajamento muito baixo.'},
 {r:22, nome:'Kiss FM (local) 107,9', perfil:'@kissfmcampinas', tipo:'local', seg:3500, segTxt:'3,5 mil', curt:'29', engTxt:'0,82%', eng:0.82, alerta:'baixo', obs:'Posta em rajadas.'},
 {r:23, nome:'Educativa FM 101,9', perfil:'@educativacampinas', tipo:'local', seg:579, segTxt:'579', curt:'18', engTxt:'3,1%', eng:3.10, alerta:'baixo', obs:'Rádio pública; alcance muito pequeno.'}
];

/* posts que mais renderam no período (Instagram Insights) */
var AN02_POSTS = [
  {d:'02/09', t:'Inspira News: Safira Louise e o povo Parintintin', c:1713, co:85, a:17308},
  {d:'03/08', t:'Inspira News: a história do Romeu', c:1160, co:32, a:12439},
  {d:'15/09', t:'Moda sustentável com material reciclado', c:460, co:22, a:6002},
  {d:'11/09', t:'Drones recriam as Torres Gêmeas', c:239, co:7, a:4142},
  {d:'07/10', t:'Cachorrinho canta Whitney Houston', c:202, co:11, a:1173}
];

var an02Bound = false;

/* =================== helpers =================== */
function an02Mil(n){
  if(n === null || n === undefined) return 's/d';
  if(Math.abs(n) >= 1000) return (n / 1000).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1}) + ' mil';
  return fmtInt(n);
}
function an02Pct(v, casas){
  var s = v.toLocaleString('pt-BR', {minimumFractionDigits: casas, maximumFractionDigits: casas});
  return (v > 0 ? '+' : '') + s + '%';
}
function an02Delta(n){
  if(n === null) return '<span class="an02-delta nd">novo dado</span>';
  var cls = n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
  return '<span class="an02-delta ' + cls + '">' + (n > 0 ? '+' : '') + an02Mil(n) + '</span>';
}
function an02DeltaPct(p){
  if(p === null) return '<span class="an02-delta nd">—</span>';
  var cls = p > 0 ? 'up' : p < 0 ? 'down' : 'flat';
  return '<span class="an02-delta ' + cls + '">' + an02Pct(p, Math.abs(p) >= 100 ? 0 : 1) + '</span>';
}
/* cruza os dois relatórios pelo handle; ganho = null quando julho não tinha número */
function an02Comparativo(){
  var jul = {};
  (typeof PERFIS !== 'undefined' ? PERFIS : []).forEach(function(p){ jul[p.perfil] = p; });
  return AN02_PERFIS.map(function(p){
    var a = jul[p.perfil];
    var seg0 = a && a.seg !== null ? a.seg : null;
    var ganho = seg0 === null ? null : p.seg - seg0;
    var pct = seg0 ? (p.seg - seg0) / seg0 * 100 : null;
    return { p:p, a:a, seg0:seg0, ganho:ganho, pct:pct, eng0: a && a.eng !== null ? a.eng : null };
  });
}

/* =================== markup =================== */
function an02Css(){
  return '<style id="an02-css">' +
    '.an02-delta{font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}' +
    '.an02-delta.up{color:var(--al-baixo)}.an02-delta.down{color:var(--al-medioalto)}' +
    '.an02-delta.flat,.an02-delta.nd{color:var(--muted);font-weight:600}' +
    '.an02-faixa{display:flex;flex-wrap:wrap;gap:.6rem 1rem;align-items:center;justify-content:space-between;' +
      'border:1px solid var(--line);border-left:4px solid var(--teal-700);border-radius:.8rem;background:var(--surface);' +
      'padding:.8rem 1.1rem;margin:0 0 1.2rem;font-size:.92rem}' +
    '.an02-faixa b{font-family:var(--display);color:var(--teal-900)}' +
    '.an02-faixa a{font-weight:800;color:var(--teal-700);text-decoration:none;white-space:nowrap}' +
    '.an02-faixa a:hover{text-decoration:underline}' +
    '.an02-cmp .kpis{margin-top:1.2rem}' +
    '.an02-cmp .kpi .k small{display:block;margin-top:.25rem;color:var(--muted-inverse);opacity:.85}' +
    '.an02-sub{font-family:var(--display);font-weight:800;color:var(--teal-900);font-size:1.05rem;margin:1.8rem 0 .4rem}' +
    '</style>';
}

function an02Hero(){
  return '<div class="page-hero">' +
    '<svg class="waves" viewBox="0 0 1440 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<path class="wave-drift" d="M-80,110 C320,30 620,200 980,120 C1220,68 1380,140 1520,90 L1520,-60 L-80,-60 Z" fill="#06443C"/>' +
      '<path class="wave-drift w2" d="M-100,560 C300,480 660,640 1040,550 C1260,500 1420,570 1540,530 L1540,720 L-100,720 Z" fill="#032723"/>' +
      '<g class="arcs" fill="none" stroke="#EE9D67" stroke-width="18" stroke-linecap="round" opacity=".85">' +
        '<path d="M1280,150 a64,64 0 0 1 0,108"/><path d="M1328,128 a100,100 0 0 1 0,152"/></g></svg>' +
    '<div class="wrap">' +
      '<p class="crumb">Relatório 02 · Inteligência Competitiva</p>' +
      '<h2 id="an02-title">Análise Redes Sociais</h2>' +
      '<p class="sub">23 perfis analisados, 20 emissoras FM. Período de 14/07 a 08/10/2026. Inspira: dados oficiais do Instagram (Insights). ' +
        'Concorrentes: dados públicos do SocialBlade coletados em 08/10/2026 — engajamento estimado pela média de curtidas dos posts recentes ÷ seguidores.</p>' +
      '<p class="meta">Diretoria Comercial e de Marketing · uso interno</p>' +
      '<div class="kpis">' +
        '<div class="kpi"><div class="v">36,3 mil</div><div class="k">seguidores da Inspira em 08/10 (eram 23.991 em 14/07)</div></div>' +
        '<div class="kpi"><div class="v">+51%</div><div class="k">de base em 86 dias — maior ganho absoluto do mercado local (+12,3 mil)</div></div>' +
        '<div class="kpi"><div class="v">7º lugar</div><div class="k">entre os perfis locais — distância para a Conecta caiu de 13,7 mil para 5,2 mil</div></div>' +
        '<div class="kpi"><div class="v">1 alerta reforçado</div><div class="k">CBN ganhou 11 mil seguidores sem ganhar interação (0,06%)</div></div>' +
      '</div>' +
    '</div></div>';
}

function an02Numeros(){
  return '<div class="section"><div class="wrap">' +
    '<div class="an02-faixa"><span><b>Histórico:</b> este é o segundo relatório da série. O primeiro, de 14/07/2026, segue disponível na íntegra.</span>' +
      '<a href="#analise">← Relatório 01 · jul/2026</a></div>' +
    '<h3>O que os números dizem</h3>' +
    '<ul class="warn-list" style="margin-top:1rem">' +
      '<li><span class="who" style="color:var(--teal-700)">Tamanho ≠ força</span><p>As 4 maiores bases locais (Educadora 154,9 mil, CBN 99,7 mil, Band 96,8 mil, Nativa 94,7 mil) seguem engajando entre 0,06% e 0,16%. A CBN ganhou 11 mil seguidores em 3 meses sem ganhar conversa.</p></li>' +
      '<li><span class="who" style="color:var(--teal-700)">Inspira acelera</span><p>+12,3 mil seguidores em 86 dias (+51%), o maior ganho absoluto do mercado local. Não foi um viral só: o Inspira News emplacou o Romeu (03/08, 1.160 curtidas) e a Safira Louise (02/09, 1.713 curtidas e 17 mil de alcance).</p></li>' +
      '<li><span class="who" style="color:var(--teal-700)">Setembro, o melhor mês</span><p>42 posts, média de 116 curtidas e 10,5 comentários por post, 112 mil visualizações e 587 compartilhamentos. Outubro começou abaixo desse ritmo.</p></li>' +
      '<li><span class="who" style="color:var(--teal-700)">Play FM 99,7</span><p>Quase triplicou: de 4,7 para 12,9 mil seguidores (+175%) com só 242 posts. Mesmo território da Inspira (adulto-contemporâneo, bem-estar). A Inspira segue 2,8× à frente em base.</p></li>' +
      '<li><span class="who" style="color:var(--teal-700)">EP FM e Bandeirantes</span><p>Seguem como referência de conversa local: EP com 101 curtidas por post (0,65%) e Bandeirantes com 251 (2,46%), puxada pelo futebol de Campinas.</p></li>' +
    '</ul></div></div>';
}

/* ---------- Comparativo Relatório 01 × 02 (bloco pedido pela diretoria) ---------- */
function an02ComparativoHtml(){
  var cmp = an02Comparativo();
  var locais = cmp.filter(function(c){ return c.p.tipo !== 'rede' && c.ganho !== null; });
  var porGanho = locais.slice().sort(function(a,b){ return b.ganho - a.ganho; });
  var porPct = locais.slice().sort(function(a,b){ return b.pct - a.pct; });
  var maxG = porGanho[0].ganho;

  /* barras: ganho absoluto de seguidores entre os perfis locais */
  var barras = porGanho.map(function(c){
    var p = c.p;
    var w = Math.max(c.ganho / maxG * 100, 0.8);
    var inside = w > 76 ? ' inside' : '';
    var tipHtml = '<b>' + p.nome + '</b> · ' + p.perfil + '<br>Jul: ' + an02Mil(c.seg0) + ' → Out: ' + p.segTxt +
      '<br>Ganho: +' + fmtInt(c.ganho) + ' (' + an02Pct(c.pct, 1) + ')' +
      '<br>Engajamento: ' + (c.eng0 === null ? 's/d' : c.a.engTxt) + ' → ' + p.engTxt;
    return '<div class="bar-row' + (p.tipo === 'inspira' ? ' is-inspira' : '') + '" tabindex="0" data-tip="' + escAttr(tipHtml) + '">' +
      '<span class="name">' + p.nome + '</span>' +
      '<span class="bar-track"><span class="bar-fill" style="width:' + w.toFixed(2) + '%;background:' + TIPO_COLOR[p.tipo] + '"></span>' +
      '<span class="bar-val' + inside + '">+' + an02Mil(c.ganho) + ' · ' + an02Pct(c.pct, Math.abs(c.pct) >= 100 ? 0 : 1) + '</span></span></div>';
  }).join('');

  /* tabela: todos os perfis (rede inclusive), ordenada pelo ranking de outubro */
  var linhas = cmp.map(function(c){
    var p = c.p;
    var engCel = (c.eng0 === null ? 's/d' : c.a.engTxt) + ' → <b>' + p.engTxt + '</b>';
    var al0 = c.a && c.a.alerta ? ALERTA_LBL[c.a.alerta][0] : '—';
    var al1 = p.alerta ? (p.alertaTxt || ALERTA_LBL[p.alerta][0]) : '—';
    return '<tr' + (p.tipo === 'inspira' ? ' class="hl-inspira"' : '') + '><td>' + p.r + '</td><td><b>' + p.nome + '</b><br><small style="color:var(--muted)">' + p.perfil + '</small></td>' +
      '<td class="num">' + an02Mil(c.seg0) + '</td><td class="num">' + p.segTxt + '</td>' +
      '<td class="num">' + an02Delta(c.ganho) + '</td><td class="num">' + an02DeltaPct(c.pct) + '</td>' +
      '<td style="white-space:nowrap">' + engCel + '</td>' +
      '<td style="white-space:nowrap">' + al0 + ' → ' + al1 + '</td></tr>';
  }).join('');

  var top3 = porGanho.slice(0, 3).map(function(c){ return c.p.nome.replace(' 97,7', '') + ' (+' + an02Mil(c.ganho) + ')'; }).join(', ');
  var topPct = porPct.slice(0, 3).map(function(c){ return c.p.nome + ' (' + an02Pct(c.pct, 0) + ')'; }).join(', ');

  return '<div class="section alt an02-cmp" id="an02-comparativo"><div class="wrap">' +
    '<h3>Comparativo — Relatório 01 (14/07) × Relatório 02 (08/10)</h3>' +
    '<p class="lead">O que mudou em 86 dias: a Inspira, os concorrentes e para onde o mercado está indo. Deltas calculados sobre os mesmos perfis dos dois relatórios.</p>' +
    '<div class="kpis kpis-light">' +
      '<div class="kpi"><div class="v">24,0 → 36,3 mil</div><div class="k">seguidores da Inspira <small>+12.320 (+51,4%) — 1º em ganho absoluto no dial</small></div></div>' +
      '<div class="kpi"><div class="v">0,20% → 0,14%</div><div class="k">engajamento nos últimos 10 posts <small>0,22% no período inteiro; pico de 0,32% em setembro</small></div></div>' +
      '<div class="kpi"><div class="v">7º → 7º</div><div class="k">posição entre os locais <small>distância para a Conecta (6ª) caiu de 13,7 mil para 5,2 mil</small></div></div>' +
      '<div class="kpi"><div class="v">4 → 4 alertas</div><div class="k">de base inflada <small>CBN reforçado; Conecta em revisão; Band e Massa mantidos</small></div></div>' +
    '</div>' +

    '<p class="an02-sub">Quem mais cresceu em seguidores (perfis locais, 14/07 → 08/10)</p>' +
    '<div class="chart" id="an02GanhoChart">' +
      '<div class="legend"><span><i style="background:var(--dv-teal)"></i>Perfil local</span><span><i style="background:var(--dv-green)"></i>Inspira FM</span></div>' +
      '<div class="bar-chart" id="an02GanhoBars" role="img" aria-label="Gráfico de barras: ganho absoluto de seguidores dos perfis locais entre 14 de julho e 8 de outubro de 2026. Inspira FM em primeiro, com mais 12,3 mil."></div>' +
      '<p class="chart-note">Cidade Gospel e a conta comercial da Antena 1 ficam fora: sem número de julho para comparar. Passe o mouse ou toque nas barras para ver julho, outubro e engajamento.</p>' +
    '</div>' +

    '<ul class="warn-list" style="margin-top:1.6rem">' +
      '<li><span class="who" style="color:var(--teal-700)">O que melhorou</span><p>A Inspira foi quem mais ganhou seguidores em números absolutos (' + top3 + '). Setembro foi o melhor mês da conta (42 posts, 112 mil visualizações). Dois virais novos do Inspira News, com 17 mil contas alcançadas num único post. A distância para a 6ª colocada caiu pela metade e a Inspira está 2,8× à frente da Play FM, sua concorrente direta de posicionamento.</p></li>' +
      '<li><span class="who" style="color:var(--al-medioalto)">O que piorou</span><p>O engajamento do dia a dia não acompanhou a base: 0,20% em julho contra 0,14% nos últimos 10 posts, e comentários caindo de 10,5 para 5,5 por post em outubro. Os virais foram nacionais (Romeu e Safira), não de Campinas. Outubro começou abaixo do ritmo de setembro.</p></li>' +
      '<li><span class="who" style="color:var(--teal-700)">Quem mais performou entre os concorrentes</span><p>Em velocidade: ' + topPct + '. A Play FM quase triplicou e já está em 14º geral. A Bandeirantes virou a melhor taxa de conversa do dial (0,32% → 2,46%) com futebol local. A EP FM subiu de 0,38% para 0,65% e segue referência de conversa orgânica. A CBN ganhou 11 mil seguidores sem mexer no engajamento (0,05% → 0,06%): alerta reforçado.</p></li>' +
      '<li><span class="who" style="color:var(--teal-700)">Para onde olhar</span><p>Play FM (território igual, ritmo de 3×), EP FM e Bandeirantes (conversa) e Conecta (salto de engajamento a conferir antes de qualquer uso comercial). A meta do próximo relatório é engajamento: voltar a 10 comentários por post sem perder o ritmo de ~84 seguidores novos por dia.</p></li>' +
    '</ul>' +

    '<p class="an02-sub">Tabela comparativa — os 23 perfis</p>' +
    '<div class="tbl-scroll"><table><thead><tr><th scope="col">#</th><th scope="col">Rádio (FM)</th><th scope="col" class="num">Jul/26</th><th scope="col" class="num">Out/26</th>' +
      '<th scope="col" class="num">Ganho</th><th scope="col" class="num">Variação</th><th scope="col">Engaj. jul → out</th><th scope="col">Alerta jul → out</th></tr></thead>' +
      '<tbody>' + linhas + '</tbody></table></div>' +
    '<p class="chart-note">Antena 1 (conta comercial local, 958 seguidores em julho) saiu da amostra: não retornou dados nesta coleta. "Novo dado" = perfil que em julho não tinha contador público.</p>' +
  '</div></div>';
}

function an02Seguidores(){
  return '<div class="section"><div class="wrap">' +
    '<h3>Seguidores — o mapa completo do dial</h3>' +
    '<p class="lead">Perfis de rede seguem liderando em volume, mas não medem audiência campineira. Entre os locais, a Inspira continua em 7º, agora com 36,3 mil, e encostou na Conecta FM (41,5 mil).</p>' +
    '<div class="chart" id="an02FollowersChart">' +
      '<div class="legend"><span><i style="background:var(--dv-teal)"></i>Perfil local (Campinas)</span><span><i style="background:var(--dv-green)"></i>Inspira FM</span><span><i style="background:var(--dv-blue)"></i>Perfil de rede (não exclusivo)</span></div>' +
      '<div class="bar-chart" id="an02FollowersBars" role="img" aria-label="Gráfico de barras: seguidores no Instagram dos 23 perfis em 8 de outubro de 2026, do maior (Kiss FM rede, 538,3 mil) ao menor (Educativa, 579). Inspira FM em 11º geral e 7º entre locais, com 36,3 mil."></div>' +
      '<p class="chart-note">Inspira: Instagram Insights, 08/10/2026 · demais: SocialBlade, 08/10/2026. Antena 1 (local) sem dados nesta coleta. A Cidade Gospel, que em julho estava sem dados, aparece com 4,0 mil. Valores exatos na tabela abaixo.</p>' +
    '</div></div></div>';
}

function an02Engajamento(){
  return '<div class="section alt"><div class="wrap">' +
    '<h3>Engajamento — quem realmente conversa com a audiência</h3>' +
    '<p class="lead">Curtidas médias dos posts recentes ÷ seguidores, só perfis locais. O engajamento cai conforme a base cresce: as quatro maiores bases locais ficam entre 0,06% e 0,16%.</p>' +
    '<div class="chart" id="an02EngChart">' +
      '<div class="legend"><span><i style="background:var(--dv-teal)"></i>Perfil local</span><span><i style="background:var(--dv-green)"></i>Inspira FM</span></div>' +
      '<div class="bar-chart" id="an02EngBars" role="img" aria-label="Gráfico de barras: taxa de engajamento estimada dos perfis locais, de Educativa (3,1%) a Cidade Gospel (0,05%). Inspira FM com 0,14%."></div>' +
      '<p class="chart-note">Inspira: Instagram Insights, últimos 10 posts até 08/10/2026 · demais: SocialBlade, 08/10/2026. O 0,14% da Inspira usa os 10 posts mais recentes. No período todo (119 posts) a média foi de 80 curtidas por post, ou 0,22%, com pico de 0,32% em setembro. A base cresceu 51% e o engajamento do dia a dia ainda não acompanhou. O número da Conecta (1,9%) saltou em relação a julho e precisa ser conferido antes de uso comercial.</p>' +
    '</div></div></div>';
}

function an02Ranking(){
  return '<div class="section"><div class="wrap">' +
    '<h3>Ranking completo — 23 perfis</h3>' +
    '<p class="lead">Ordenado por seguidores. Engajamento = curtidas médias dos posts recentes ÷ seguidores. Variação = desde 14/07/2026. Mesmas colunas do Relatório 01, mais a coluna Variação.</p>' +
    '<div class="tbl-scroll" id="an02RankTable"></div>' +
    '</div></div>';
}

function an02Alertas(){
  return '<div class="section alt"><div class="wrap">' +
    '<h3>Alerta: seguidores possivelmente comprados ou inflados</h3>' +
    '<p class="lead">Onde o número de seguidores não corresponde à audiência real. Os quatro alertas de julho continuam; o da CBN ficou mais forte.</p>' +
    '<ul class="alert-list">' +
      '<li><span class="who">CBN Campinas <small>@cbncampinas</small></span><p>99,7 mil seguidores (+11 mil desde julho) com 62 curtidas por post (0,06%). Crescer 12% em três meses sem ganhar nenhuma interação é compatível com base comprada ou campanha paga de seguidores.</p><span class="pill alto">ALTO</span></li>' +
      '<li><span class="who">Conecta FM <small>@fmconecta</small></span><p>41,5 mil seguidores. A média de curtidas saltou de ~14 para 801 por post. Pode ser um viral ou sorteio puxando a média: o alerta fica em revisão até conferirmos os posts.</p><span class="pill alto">ALTO (em revisão)</span></li>' +
      '<li><span class="who">Band FM <small>@bandfmcampinas</small></span><p>96,8 mil seguidores, base praticamente parada (+0,9%) e engajamento caindo para 0,07%. Interação segue dependente de sorteios.</p><span class="pill medioalto">MÉDIO-ALTO</span></li>' +
      '<li><span class="who">Massa FM <small>@massafmcampinas</small></span><p>19,9 mil seguidores e média de 117 comentários contra 66 curtidas por post: a conversa vem de sorteio com comentário obrigatório.</p><span class="pill medioalto">MÉDIO-ALTO</span></li>' +
    '</ul>' +
    '<p class="note-box"><b>Nota de responsabilidade:</b> engajamento baixo não prova compra de seguidores — em rádio, é comum a base ser herança de promoções antigas. O alerta sinaliza onde o número de seguidores <b>não</b> deve ser usado como métrica de audiência digital em propostas comerciais.</p>' +
    '</div></div>';
}

function an02Trajetoria(){
  var posts = AN02_POSTS.map(function(p){
    return '<tr><td>' + p.d + '</td><td><b>' + escHtml(p.t) + '</b></td><td class="num">' + fmtInt(p.c) + '</td><td class="num">' + fmtInt(p.co) + '</td><td class="num">' + fmtInt(p.a) + '</td></tr>';
  }).join('');
  return '<div class="section"><div class="wrap">' +
    '<h3>Inspira FM — trajetória dos 9 primeiros meses</h3>' +
    '<p class="lead">De zero a 36.311 seguidores entre janeiro e 8 de outubro de 2026. Depois do salto de julho, a conta seguiu crescendo com novos virais do Inspira News em agosto e setembro.</p>' +
    '<div class="growth-wrap" id="an02GrowthChart"></div>' +
    '<p class="chart-note">Pontos verificados: ~15 mil em 08/07 (espelho público), 23.991 em 14/07 (Social Blade) e 36.311 em 08/10 (Instagram Insights, dado oficial da conta). Nos 30 dias até 07/10 entraram 2.519 seguidores novos (bruto, ~84 por dia). Pontos mensais intermediários de jan a jun são estimativas ilustrativas.</p>' +
    '<p class="an02-sub">Posts que mais renderam (14/07 a 08/10)</p>' +
    '<div class="tbl-scroll"><table><thead><tr><th scope="col">Data</th><th scope="col">Post</th><th scope="col" class="num">Curtidas</th><th scope="col" class="num">Comentários</th><th scope="col" class="num">Alcance</th></tr></thead><tbody>' + posts + '</tbody></table></div>' +
    '<p class="chart-note">Fonte: Instagram Insights da @inspirafm via Windsor.ai, 08/10/2026.</p>' +
    '</div></div>';
}

function an02Atencao(){
  return '<div class="lime-band">' +
    '<svg class="waves" viewBox="0 0 1440 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<path class="wave-drift" d="M-80,90 C340,10 660,170 1040,90 C1260,45 1420,110 1540,70 L1540,-60 L-80,-60 Z" fill="#032723" opacity=".13"/>' +
      '<path class="wave-drift w2" d="M-100,460 C300,380 660,540 1040,450 C1260,400 1420,470 1540,430 L1540,620 L-100,620 Z" fill="#056250" opacity=".2"/></svg>' +
    '<div class="wrap"><h3>Pontos de atenção para o próximo trimestre</h3><ul>' +
      '<li><b>Engajamento não acompanhou a base.</b> Média de 51 curtidas nos últimos 10 posts (0,14%) e comentários caindo de 10,5 para 5,5 por post em outubro. A prioridade agora é conversa, não volume.</li>' +
      '<li><b>Os virais são nacionais.</b> Romeu e Safira trouxeram alcance, mas não são de Campinas. Falta a série local recorrente recomendada em julho.</li>' +
      '<li><b>Play FM 99,7 quase triplicou</b> e disputa o mesmo território (adulto-contemporâneo, bem-estar). Segue no radar mensal.</li>' +
      '<li><b>Não usar o número da Conecta</b> em comparação comercial até conferir de onde veio o salto de engajamento.</li>' +
    '</ul></div></div>';
}

function an02Conclusoes(){
  return '<div class="section"><div class="wrap duo">' +
    '<div><h3>Conclusões</h3><ul class="warn-list" style="margin-top:1rem">' +
      '<li><p>A tese de julho se confirmou: o mercado digital de rádio em Campinas é grande em números e fraco em engajamento, e a Inspira foi quem mais ganhou seguidores no período — +12,3 mil seguidores em 86 dias.</p></li>' +
      '<li><p>O desafio mudou de crescer para engajar. Com 36 mil seguidores, cada post precisa render mais conversa para a conta não repetir o padrão das grandes bases paradas.</p></li>' +
      '<li><p>Nas propostas comerciais, o argumento é velocidade e alcance real: crescimento de 51% em 3 meses, 112 mil visualizações em setembro e um post com 17 mil contas alcançadas.</p></li>' +
    '</ul></div>' +
    '<div><h3>Recomendações práticas</h3><ul class="warn-list" style="margin-top:1rem">' +
      '<li><p><b>Inspira News local, toda semana:</b> manter o formato de história humana positiva, com pelo menos uma história de Campinas e região por semana.</p></li>' +
      '<li><p><b>Rosto da casa em vídeo:</b> o react da Rafa (07/09) rendeu 21 comentários. Testar um quadro fixo semanal com apresentadores.</p></li>' +
      '<li><p><b>Todo post com pergunta ou “marque alguém”:</b> meta de voltar a 10 comentários por post.</p></li>' +
      '<li><p><b>Humor musical para compartilhamento:</b> o cachorro cantando Whitney teve 121 compartilhamentos com 1,2 mil de alcance.</p></li>' +
      '<li><p><b>Menos imagem estática:</b> alcance mediano de 285 contas, contra 936 dos reels. Usar só para avisos e parceiros.</p></li>' +
      '<li><p><b>Monitorar mensalmente</b> esta tabela, com atenção a Play FM, EP FM e Bandeirantes.</p></li>' +
      '<li><p><b>Nunca comprar seguidores:</b> o caso da CBN mostra como base sem conversa fica evidente para anunciantes atentos.</p></li>' +
    '</ul></div></div>' +
    '<div class="wrap">' +
      '<p class="chart-note" style="margin-top:2rem"><b>Principais fontes:</b> Instagram Insights da @inspirafm (via Windsor.ai, 08/10/2026) · SocialBlade (08/10/2026) · Panorama Kantar Ibope Campinas jun–ago/2026 (tudoradio.com, 18/09/2026) · Estreia da Play FM 99,7 (Grandes Nomes da Propaganda) · Pan News Campinas completa 5 anos (tudoradio) · Relatório 01 (14/07/2026).</p>' +
      '<p class="chart-note"><b>Limitações:</b> os números do SocialBlade podem ter alguns dias de defasagem e a média de curtidas é calculada pelo próprio site. O engajamento da Inspira (Insights) e o dos concorrentes não são medidos exatamente igual — comparar como ordem de grandeza.</p>' +
      '<div class="backrow"><a href="#analise">← Relatório 01 · jul/2026</a><a href="#inicio">Início →</a></div>' +
    '</div></div>';
}

function an02Markup(){
  return an02Css() + an02Hero() + an02Numeros() + an02ComparativoHtml() + an02Seguidores() + an02Engajamento() +
    an02Ranking() + an02Alertas() + an02Trajetoria() + an02Atencao() + an02Conclusoes();
}

/* =================== gráficos (mesmo desenho do Relatório 01) =================== */
function an02BuildFollowers(){
  var host = document.getElementById('an02FollowersBars');
  if(!host) return;
  var max = 538300;
  host.innerHTML = AN02_PERFIS.map(function(p){
    var w = Math.max(p.seg / max * 100, 0.35);
    var inside = w > 76 ? ' inside' : '';
    var tipHtml = '<b>' + p.nome + '</b> · ' + p.perfil + '<br>Seguidores: ' + p.segTxt +
      '<br>Curtidas méd./post: ' + p.curt + '<br>Engajamento: ' + p.engTxt +
      (p.alerta ? '<br>Alerta: ' + (p.alertaTxt || ALERTA_LBL[p.alerta][0]) : '') + '<br>' + p.obs;
    return '<div class="bar-row' + (p.tipo === 'inspira' ? ' is-inspira' : '') + '" tabindex="0" data-tip="' + escAttr(tipHtml) + '">' +
      '<span class="name">' + p.nome + '</span>' +
      '<span class="bar-track"><span class="bar-fill" style="width:' + w.toFixed(2) + '%;background:' + TIPO_COLOR[p.tipo] + '"></span>' +
      '<span class="bar-val' + inside + '">' + p.segTxt + '</span></span></div>';
  }).join('');
  bindTips(host);
}
function an02BuildEngagement(){
  var host = document.getElementById('an02EngBars');
  if(!host) return;
  var rows = AN02_PERFIS.filter(function(p){ return p.tipo !== 'rede' && p.eng !== null; })
    .sort(function(a,b){ return b.eng - a.eng; });
  var max = 3.2;
  host.innerHTML = rows.map(function(p){
    var w = Math.max(p.eng / max * 100, 0.8);
    var color = p.tipo === 'inspira' ? 'var(--dv-green)' : 'var(--dv-teal)';
    var inside = w > 76 ? ' inside' : '';
    var tipHtml = '<b>' + p.nome + '</b> · ' + p.perfil + '<br>Engajamento estimado: ' + p.engTxt +
      '<br>Base: ' + p.segTxt + ' seguidores<br>' + p.obs;
    return '<div class="bar-row' + (p.tipo === 'inspira' ? ' is-inspira' : '') + '" tabindex="0" data-tip="' + escAttr(tipHtml) + '">' +
      '<span class="name">' + p.nome + '</span>' +
      '<span class="bar-track"><span class="bar-fill" style="width:' + w.toFixed(2) + '%;background:' + color + '"></span>' +
      '<span class="bar-val' + inside + '">' + p.engTxt + '</span></span></div>';
  }).join('');
  bindTips(host);
}
function an02BuildRanking(){
  var host = document.getElementById('an02RankTable');
  if(!host) return;
  var cmp = {};
  an02Comparativo().forEach(function(c){ cmp[c.p.perfil] = c; });
  var head = '<table><thead><tr><th scope="col">#</th><th scope="col">Rádio (FM)</th><th scope="col">Perfil</th><th scope="col">Tipo</th>' +
    '<th scope="col" class="num">Seguidores</th><th scope="col" class="num">Variação</th><th scope="col">Curtidas méd./post</th><th scope="col" class="num">Engaj.</th><th scope="col">Alerta</th><th scope="col">Observação</th></tr></thead><tbody>';
  var rows = AN02_PERFIS.map(function(p){
    var c = cmp[p.perfil];
    var tipoPill = p.tipo === 'inspira' ? '<span class="pill inspira">INSPIRA</span>' :
      p.tipo === 'rede' ? '<span class="pill rede">REDE</span>' : '<span class="pill local">LOCAL</span>';
    var al = p.alerta ? '<span class="pill ' + ALERTA_LBL[p.alerta][1] + '">' + (p.alertaTxt || ALERTA_LBL[p.alerta][0]) + '</span>' : '—';
    return '<tr' + (p.tipo === 'inspira' ? ' class="hl-inspira"' : '') + '><td>' + p.r + '</td><td><b>' + p.nome + '</b></td><td>' + p.perfil +
      '</td><td>' + tipoPill + '</td><td class="num">' + p.segTxt + '</td><td class="num">' + an02DeltaPct(c ? c.pct : null) + '</td><td>' + p.curt +
      '</td><td class="num">' + p.engTxt + '</td><td>' + al + '</td><td style="min-width:18rem">' + p.obs + '</td></tr>';
  }).join('');
  host.innerHTML = head + rows + '</tbody></table>';
}
function an02BuildGrowth(){
  var host = document.getElementById('an02GrowthChart');
  if(!host) return;
  var pts = [
    ['Jan/26', 0], ['Fev/26', 2500], ['Mar/26', 5500], ['Abr/26', 8000],
    ['Mai/26', 11000], ['Jun/26', 13500], ['08/Jul', 15000], ['14/Jul', 23991], ['Ago', 27500], ['Set', 32500], ['08/Out', 36311]
  ];
  var verificados = { '08/Jul':1, '14/Jul':1, '08/Out':1 };
  var W = 920, H = 340, padL = 56, padR = 190, padT = 34, padB = 44;
  var maxY = 40000;
  var iw = W - padL - padR, ih = H - padT - padB;
  function X(i){ return padL + i / (pts.length - 1) * iw; }
  function Y(v){ return padT + (1 - v / maxY) * ih; }
  var grid = '';
  [0, 10000, 20000, 30000, 40000].forEach(function(v){
    grid += '<line x1="' + padL + '" y1="' + Y(v) + '" x2="' + (W - padR) + '" y2="' + Y(v) + '" stroke="var(--line)" stroke-width="1"/>' +
      '<text x="' + (padL - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="12" fill="var(--muted)">' + (v/1000) + ' mil</text>';
  });
  var lineD = pts.map(function(p, i){ return (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ');
  var areaD = lineD + ' L' + X(pts.length - 1).toFixed(1) + ',' + Y(0) + ' L' + X(0) + ',' + Y(0) + ' Z';
  var dots = '', labels = '';
  pts.forEach(function(p, i){
    var vx = X(i), vy = Y(p[1]);
    var ver = !!verificados[p[0]];
    dots += '<circle cx="' + vx + '" cy="' + vy + '" r="' + (ver ? 6.5 : 4) + '" fill="' + (ver ? 'var(--dv-orange)' : 'var(--dv-teal)') + '" stroke="var(--surface)" stroke-width="2"><title>' + p[0] + ': ' + fmtInt(p[1]) + ' seguidores' + (ver ? ' (verificado)' : ' (estimativa)') + '</title></circle>';
    labels += '<text x="' + vx + '" y="' + (H - padB + 20) + '" text-anchor="middle" font-size="12" fill="var(--muted)">' + p[0] + '</text>';
  });
  /* marcas dos virais: 09/07 reel gospel-pop (entre 08 e 14/Jul), 03/08 Romeu, 02/09 Safira */
  var virais = [[6.5, '1'], [8.1, '2'], [9.05, '3']];
  var vlines = virais.map(function(v){
    var vx = padL + v[0] / (pts.length - 1) * iw;
    return '<line x1="' + vx.toFixed(1) + '" y1="' + padT + '" x2="' + vx.toFixed(1) + '" y2="' + (H - padB) + '" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 4" opacity=".6"/>' +
      '<text x="' + vx.toFixed(1) + '" y="' + (padT - 10) + '" text-anchor="middle" font-size="11" font-weight="800" fill="var(--muted)">' + v[1] + '</text>';
  }).join('');
  var annX = X(pts.length - 1), annY = Y(36311);
  var ann = '<g font-size="12.5" fill="var(--dv-orange-ink)">' +
    '<text x="' + (annX + 12) + '" y="' + (annY + 2) + '" font-weight="800">36.311 seguidores</text>' +
    '<text x="' + (annX + 12) + '" y="' + (annY + 18) + '">+12,3 mil desde 14/07</text>' +
    '<text x="' + (annX + 12) + '" y="' + (annY + 34) + '">(~84 por dia em set/out)</text></g>';
  var legenda = '<g font-size="11.5" fill="var(--muted)">' +
    '<text x="' + (padL + 10) + '" y="' + (padT + 14) + '"><tspan font-weight="800">1</tspan> 09/07 · Reel “O gospel que virou pop”</text>' +
    '<text x="' + (padL + 10) + '" y="' + (padT + 30) + '"><tspan font-weight="800">2</tspan> 03/08 · Inspira News: Romeu</text>' +
    '<text x="' + (padL + 10) + '" y="' + (padT + 46) + '"><tspan font-weight="800">3</tspan> 02/09 · Inspira News: Safira Louise</text></g>';
  host.innerHTML =
    '<p class="chart-title">De zero a 36,3 mil seguidores em nove meses</p>' +
    '<svg class="svg-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Gráfico de linha: crescimento da Inspira FM de 0 seguidores em janeiro de 2026 a 36.311 em 8 de outubro, com três virais marcados em julho, agosto e setembro.">' +
    grid + vlines + '<path d="' + areaD + '" fill="var(--dv-teal)" opacity="0.08"/>' +
    '<path d="' + lineD + '" fill="none" stroke="var(--dv-teal)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
    dots + labels + ann + legenda + '</svg>';
}
function an02BuildGanho(){
  var host = document.getElementById('an02GanhoBars');
  if(!host) return;
  /* as barras já vêm no markup do comparativo; aqui só liga os tooltips */
  bindTips(host);
}

/* =================== inits =================== */
function an02Init(){
  var sec = document.getElementById('view-analise-02');
  if(!sec) return;
  if(an02Bound) return;
  an02Bound = true;
  sec.innerHTML = an02Markup();
  an02BuildFollowers();
  an02BuildEngagement();
  an02BuildRanking();
  an02BuildGrowth();
  an02BuildGanho();
}

/* faixa no topo do Relatório 01 apontando pro 02 — o HTML do 01 vem do
   Firestore e não tem como saber que existe um relatório mais novo */
function an01Aviso(){
  var sec = document.getElementById('view-analise');
  if(!sec || sec.querySelector('.an02-faixa')) return;
  var hero = sec.querySelector('.page-hero');
  if(!hero) return;
  if(!document.getElementById('an02-css')) sec.insertAdjacentHTML('afterbegin', an02Css());
  var faixa = document.createElement('div');
  faixa.className = 'wrap';
  faixa.style.paddingTop = '1.4rem';
  faixa.innerHTML = '<div class="an02-faixa"><span><b>Histórico:</b> você está no Relatório 01 (14/07/2026). Há um relatório mais recente, com comparativo entre os dois.</span>' +
    '<a href="#analise-02">Relatório 02 · out/2026 →</a></div>';
  hero.insertAdjacentElement('afterend', faixa);
}
