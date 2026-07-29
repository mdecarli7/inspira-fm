'use strict';
/* =====================================================================
 * comercial-produtos.js — página "Nossos Produtos" (29/07/2026).
 * Catálogo de tudo que a Inspira vende, agrupado por canal de divulgação
 * (Rádio · Instagram/TikTok/Facebook · YouTube · Site/App), com valor de
 * tabela e desconto máximo por produto.
 * Dados: config/comercial.produtos — o MESMO array da aba "Produtos e
 * tabela" do Painel comercial (editar num lugar reflete no outro; o
 * comercial-painel.js preserva os campos canal/descontoMax que só esta
 * página edita). Preço NUNCA em código: o repositório é público.
 * Leitura: gate com (rules: canComercial). Escrita: só diretoria
 * (rules de config/comercial) — sem canRe() os botões nem aparecem.
 * Carrega depois de comercial-painel.js (usa COM_TIPOS e comSlug).
 * ===================================================================== */

registrarModulo({ id: 'produtos-comerciais', need: 'com', init: prodInit });

var PROD_CANAIS = [
  ['radio', 'Rádio'],
  ['redes', 'Instagram · TikTok · Facebook'],
  ['youtube', 'YouTube'],
  ['siteapp', 'Site / App'],
  ['', 'Sem canal definido']
];
var prodBound = false, PROD_EDIT = null; /* id do produto em edição; '' = novo */

function prodCanalRotulo(k){
  for(var i = 0; i < PROD_CANAIS.length; i++) if(PROD_CANAIS[i][0] === k) return PROD_CANAIS[i][1];
  return PROD_CANAIS[PROD_CANAIS.length - 1][1];
}
function prodBRL(v){
  v = +v || 0;
  if(!v) return '—';
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

function prodInit(){
  var sec = document.getElementById('view-produtos-comerciais');
  if(!sec) return;
  if(!prodBound){
    prodBound = true;
    sec.innerHTML =
      '<div class="page-hero"><p class="crumb">Comercial</p><h2 id="prod-title">Nossos Produtos</h2>' +
        '<p class="sub">Tudo que a Inspira tem à venda, separado por canal de divulgação — com valor de tabela e ' +
        'desconto máximo autorizado. O preço fechado de cada venda vive no contrato.</p></div>' +
      '<p id="prodMsg" class="load-note" aria-live="polite"></p>' +
      '<div style="display:flex;justify-content:flex-end;margin:.4rem 0 .8rem">' +
        '<button type="button" class="btn primary" id="prodNovo" hidden>+ Novo produto</button>' +
      '</div>' +
      '<div id="prodForm" class="bs-card" hidden style="margin-bottom:1rem"></div>' +
      '<div id="prodLista"><p class="load-note">Carregando o catálogo…</p></div>';
    document.getElementById('prodNovo').addEventListener('click', function(){ prodAbrir(''); });
    sec.addEventListener('click', function(ev){
      var b = ev.target.closest('[data-prod-edit]');
      if(b) prodAbrir(b.getAttribute('data-prod-edit'));
    });
  }
  document.getElementById('prodNovo').hidden = !canRe();
  /* recarrega a cada visita: pega edição feita na aba do Painel (1 leitura) */
  comCfgCarregar(true).then(prodRender).catch(function(){
    document.getElementById('prodLista').innerHTML = '<p class="load-note">' + COM_SEM_ACESSO + '</p>';
  });
}

/* ---- catálogo ---- */
function prodRender(){
  var host = document.getElementById('prodLista');
  if(!host || !COM_CFG) return;
  var todos = COM_CFG.produtos || [];
  if(!todos.length){
    host.innerHTML = '<p class="load-note">Nenhum produto cadastrado ainda' +
      (canRe() ? ' — use o "+ Novo produto" pra montar o catálogo.' : '. A diretoria monta o catálogo.') + '</p>';
    return;
  }
  var html = '';
  /* combos e pacotes primeiro — são a âncora da venda (o avulso conduz pro combo) */
  var combos = todos.filter(prodEhCombo);
  if(combos.length){
    html += '<h3 style="margin:1.3rem 0 .55rem">Combos mensais' +
      ' <small style="opacity:.6;font-weight:400">' + combos.length + ' pacote' + (combos.length > 1 ? 's' : '') + '</small></h3>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:.8rem">' +
      combos.map(prodCard).join('') + '</div>';
  }
  PROD_CANAIS.forEach(function(c){
    var doCanal = todos.filter(function(p){
      if(prodEhCombo(p)) return false;
      return (c[0] ? (p.canal || '') === c[0] : !prodCanalTem(p.canal));
    });
    if(!doCanal.length) return;
    html += '<h3 style="margin:1.3rem 0 .55rem">' + escHtml(c[1]) +
      ' <small style="opacity:.6;font-weight:400">' + doCanal.length + ' produto' + (doCanal.length > 1 ? 's' : '') + '</small></h3>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:.8rem">' +
      doCanal.map(prodCard).join('') + '</div>';
  });
  host.innerHTML = html;
}
/* canal gravado é um dos conhecidos? (senão cai no grupo "Sem canal definido") */
function prodCanalTem(k){
  if(!k) return false;
  for(var i = 0; i < PROD_CANAIS.length - 1; i++) if(PROD_CANAIS[i][0] === k) return true;
  return false;
}
function prodEhCombo(p){ return p.tipo === 'combo' || p.tipo === '360'; }
function prodCard(p){
  var valor = +p.valorMensal || 0;
  var desc = +p.descontoMax || 0;
  var avulso = +p.valorAvulso || 0;
  var minimo = desc > 0 ? valor * (1 - desc / 100) : 0;
  var meta = [];
  if(p.tipo === 'quadro' || p.tipo === 'cota_master') meta.push('Cotas máx.: ' + (parseInt(p.cotasMax, 10) || 1));
  if(p.exclusividadeCategoria !== false) meta.push('exclusividade por categoria');
  return '<div class="bs-card" style="margin-bottom:0">' +
    '<b>' + escHtml(p.nome || '') + '</b> <span class="pill">' + escHtml(comRotulo(COM_TIPOS, p.tipo)) + '</span>' +
    (valor > 0
      ? '<p style="margin:.45rem 0 .2rem"><b>' + prodBRL(valor) + '</b><small>/mês (tabela)</small></p>'
      : '<p style="margin:.45rem 0 .2rem"><b>Sob consulta</b></p>') +
    (prodEhCombo(p) && avulso > valor && valor > 0
      ? '<p style="margin:.2rem 0;font-size:.88em">Avulso ' + prodBRL(avulso) +
        ' · <b>economia de aprox. ' + Math.round((1 - valor / avulso) * 100) + '%</b></p>'
      : '') +
    (valor > 0
      ? (desc > 0
          ? '<p style="margin:.2rem 0;font-size:.88em">Desconto máx.: <b>' + desc + '%</b> → mín. ' + prodBRL(minimo) + '</p>'
          : '<p style="margin:.2rem 0;font-size:.88em;opacity:.7">Sem desconto autorizado</p>')
      : '') +
    (meta.length ? '<p style="margin:.2rem 0;font-size:.85em;opacity:.8">' + meta.join(' · ') + '</p>' : '') +
    (p.descricao ? '<p style="margin:.3rem 0 0;font-size:.85em">' + escHtml(p.descricao) + '</p>' : '') +
    (canRe() ? '<p style="margin:.55rem 0 0"><button type="button" class="mini" data-prod-edit="' + escHtml(p.id || '') + '">Editar</button></p>' : '') +
  '</div>';
}

/* ---- editor (só diretoria — rules negam o resto) ---- */
function prodAbrir(id){
  if(!canRe()) return;
  PROD_EDIT = id;
  var p = null;
  if(id && COM_CFG){
    (COM_CFG.produtos || []).forEach(function(x){ if(x.id === id) p = x; });
  }
  p = p || { nome: '', canal: '', tipo: 'quadro', valorMensal: '', descontoMax: '', cotasMax: 2, exclusividadeCategoria: true, descricao: '', valorAvulso: '' };
  var f = document.getElementById('prodForm');
  var campo = 'display:block;margin:.55rem 0 .15rem;font-size:.85em;font-weight:700';
  f.innerHTML =
    '<b>' + (id ? 'Editar produto' : 'Novo produto') + '</b>' +
    '<label style="' + campo + '">Nome</label><input class="fin-input" id="prodNome" value="' + escHtml(p.nome || '') + '" placeholder="ex.: Patrocínio Inspira News">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">' +
      '<div><label style="' + campo + '">Canal de divulgação</label><select class="fin-input" id="prodCanal">' +
        PROD_CANAIS.map(function(c){
          return '<option value="' + c[0] + '"' + ((p.canal || '') === c[0] ? ' selected' : '') + '>' + escHtml(c[1]) + '</option>';
        }).join('') + '</select></div>' +
      '<div><label style="' + campo + '">Tipo</label><select class="fin-input" id="prodTipo">' +
        COM_TIPOS.map(function(t){
          return '<option value="' + t[0] + '"' + (p.tipo === t[0] ? ' selected' : '') + '>' + escHtml(t[1]) + '</option>';
        }).join('') + '</select></div>' +
      '<div><label style="' + campo + '">Valor de tabela (R$/mês)</label><input class="fin-input" id="prodValor" type="number" min="0" step="0.01" value="' + escHtml(String(+p.valorMensal || '')) + '" placeholder="0,00"></div>' +
      '<div><label style="' + campo + '">Desconto máximo (%)</label><input class="fin-input" id="prodDesc" type="number" min="0" max="100" step="1" value="' + escHtml(String(+p.descontoMax || '')) + '" placeholder="0"></div>' +
      '<div><label style="' + campo + '">Valor avulso de referência (R$)</label><input class="fin-input" id="prodAvulso" type="number" min="0" step="0.01" value="' + escHtml(String(+p.valorAvulso || '')) + '" placeholder="só pra combo — calcula a economia"></div>' +
      '<div><label style="' + campo + '">Cotas máx.</label><input class="fin-input" id="prodCotas" type="number" min="1" step="1" value="' + escHtml(String(parseInt(p.cotasMax, 10) || 2)) + '"></div>' +
      '<div style="align-self:end"><label style="display:flex;gap:.35rem;align-items:center;font-size:.88em"><input type="checkbox" id="prodExcl"' + (p.exclusividadeCategoria !== false ? ' checked' : '') + '> Exclusividade por categoria</label></div>' +
    '</div>' +
    '<label style="' + campo + '">Descrição</label><textarea class="fin-input" id="prodDescricao" rows="2" placeholder="o que está incluso, formato, frequência…">' + escHtml(p.descricao || '') + '</textarea>' +
    '<div style="display:flex;gap:.5rem;margin-top:.7rem;flex-wrap:wrap">' +
      '<button type="button" class="btn primary" id="prodSalvarBtn">Salvar</button>' +
      '<button type="button" class="mini" id="prodCancelar">Cancelar</button>' +
      (id ? '<button type="button" class="mini" id="prodExcluir" style="margin-left:auto">Excluir produto</button>' : '') +
    '</div>';
  f.hidden = false;
  document.getElementById('prodSalvarBtn').addEventListener('click', prodSalvar);
  document.getElementById('prodCancelar').addEventListener('click', function(){ f.hidden = true; PROD_EDIT = null; });
  var ex = document.getElementById('prodExcluir');
  if(ex) ex.addEventListener('click', prodExcluir);
  document.getElementById('prodNome').focus();
}

function prodColeta(){
  var desc = Math.max(0, Math.min(100, +document.getElementById('prodDesc').value || 0));
  return {
    nome: document.getElementById('prodNome').value.trim(),
    canal: document.getElementById('prodCanal').value,
    tipo: document.getElementById('prodTipo').value || 'quadro',
    valorMensal: +document.getElementById('prodValor').value || 0,
    descontoMax: desc,
    valorAvulso: +document.getElementById('prodAvulso').value || 0,
    cotasMax: parseInt(document.getElementById('prodCotas').value, 10) || 2,
    exclusividadeCategoria: document.getElementById('prodExcl').checked,
    descricao: document.getElementById('prodDescricao').value.trim()
  };
}

/* grava o array inteiro de volta (merge: categorias/regras/meta intactos) */
function prodGravar(produtos, rotulo, acao){
  return col('config').doc('comercial').set({
    produtos: produtos,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    atualizadoPor: ME.nome || ME.email
  }, { merge: true }).then(function(){
    auditar(acao, 'config', 'comercial', rotulo);
    return comCfgCarregar(true);
  }).then(function(){
    document.getElementById('prodForm').hidden = true;
    PROD_EDIT = null;
    prodRender();
  });
}

function prodSalvar(){
  if(!canRe()) return;
  var d = prodColeta();
  if(!d.nome){ flashMsg('prodMsg', 'Dá um nome pro produto antes de salvar.'); return; }
  var btn = document.getElementById('prodSalvarBtn');
  btnBusy(btn, true);
  /* relê antes de gravar: não sobrescreve edição recém-feita na aba do Painel */
  comCfgCarregar(true).then(function(cfg){
    var arr = (cfg.produtos || []).slice();
    if(PROD_EDIT){
      for(var i = 0; i < arr.length; i++){
        if(arr[i].id === PROD_EDIT){
          /* preserva o id (contratos referenciam produtoId) e campos que esta
             página não conhece */
          var novo = {}, k;
          for(k in arr[i]) novo[k] = arr[i][k];
          for(k in d) novo[k] = d[k];
          arr[i] = novo;
        }
      }
    } else {
      var vistos = {}, j;
      for(j = 0; j < arr.length; j++) vistos[arr[j].id] = 1;
      var id = comSlug(d.nome), base = id, n = 2;
      while(vistos[id]){ id = base + '-' + n; n++; }
      d.id = id;
      arr.push(d);
    }
    return prodGravar(arr, d.nome, PROD_EDIT ? 'editar' : 'criar');
  }).then(function(){
    flashMsg('prodMsg', 'Produto salvo.');
  }).catch(function(){
    flashMsg('prodMsg', 'Não deu pra salvar — só a diretoria edita o catálogo.');
  }).finally(function(){ btnBusy(btn, false); });
}

function prodExcluir(){
  if(!canRe() || !PROD_EDIT) return;
  if(!confirm('Excluir este produto do catálogo? Contratos existentes que o referenciam não são apagados.')) return;
  var btn = document.getElementById('prodExcluir');
  btnBusy(btn, true);
  var nome = document.getElementById('prodNome').value.trim() || PROD_EDIT;
  comCfgCarregar(true).then(function(cfg){
    var arr = (cfg.produtos || []).filter(function(p){ return p.id !== PROD_EDIT; });
    return prodGravar(arr, nome, 'apagar');
  }).then(function(){
    flashMsg('prodMsg', 'Produto excluído.');
  }).catch(function(){
    flashMsg('prodMsg', 'Não deu pra excluir — só a diretoria edita o catálogo.');
    btnBusy(btn, false);
  });
}
