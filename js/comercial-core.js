'use strict';
/* =====================================================================
 * comercial-core.js — base compartilhada do módulo comercial
 * Gate, constantes e a tabela de produtos/preços (config/comercial).
 * PREÇO NUNCA entra em código: o repositório é público. Tudo que é valor
 * vive no doc Firestore config/comercial, editado dentro do app.
 * Carrega depois de base-org.js e antes dos comercial-*.js.
 * ===================================================================== */

/* diretoria inteira + quem tem a flag verComercial (dada pelo admin em Usuários).
   Nunca por setor: setor é editável pela própria pessoa. */
function canCom(){
  return !!(ME && (ME.role === 'admin' || ME.role === 'diretor' || ME.verComercial === true));
}
GATES.com = canCom;

/* etapas do pipeline de negócios (ordem = ordem do funil) */
var COM_ETAPAS = [
  ['novo', 'Novo contato'],
  ['qualificado', 'Qualificado'],
  ['proposta_enviada', 'Proposta enviada'],
  ['negociacao', 'Em negociação'],
  ['ganho', 'Fechado — ganho'],
  ['perdido', 'Perdido']
];
/* status do cliente na carteira */
var CLI_STATUS = [
  ['prospecto', 'Prospecto'],
  ['contato', 'Em contato'],
  ['proposta', 'Proposta'],
  ['negociacao', 'Negociação'],
  ['ativo', 'Cliente ativo'],
  ['pausado', 'Pausado'],
  ['perdido', 'Perdido']
];
var CLI_ORIGENS = [
  ['prospeccao', 'Prospecção ativa'],
  ['indicacao', 'Indicação'],
  ['inbound', 'Chegou até nós'],
  ['evento', 'Evento']
];

function comRotulo(lista, k){
  for(var i = 0; i < lista.length; i++) if(lista[i][0] === k) return lista[i][1];
  return k || '';
}

/* ---- config/comercial: produtos, categorias, regras, meta ---- */
var COM_CFG = null, COM_CFG_P = null;
function comCfgCarregar(force){
  if(force) COM_CFG_P = null;
  if(COM_CFG_P) return COM_CFG_P;
  COM_CFG_P = col('config').doc('comercial').get().then(function(s){
    COM_CFG = s.exists ? (s.data() || {}) : {};
    COM_CFG.produtos = COM_CFG.produtos || [];
    COM_CFG.categorias = COM_CFG.categorias || [];
    COM_CFG.regras = COM_CFG.regras || {};
    if(!COM_CFG.regras.contratoMinMeses) COM_CFG.regras.contratoMinMeses = 3;
    if(!COM_CFG.regras.avisoPrevioDias) COM_CFG.regras.avisoPrevioDias = 30;
    return COM_CFG;
  }).catch(function(){
    /* sem permissão/offline: fallback vazio e tenta de novo na próxima */
    COM_CFG_P = null;
    COM_CFG = { produtos: [], categorias: [], regras: { contratoMinMeses: 3, avisoPrevioDias: 30 } };
    return COM_CFG;
  });
  return COM_CFG_P;
}
function comProduto(id){
  if(!COM_CFG) return null;
  for(var i = 0; i < COM_CFG.produtos.length; i++) if(COM_CFG.produtos[i].id === id) return COM_CFG.produtos[i];
  return null;
}

/* dias até uma data YYYY-MM-DD (negativo = já passou); null sem data */
function comDiasAte(iso){
  if(!iso) return null;
  var alvo = new Date(iso + 'T12:00:00');
  if(isNaN(alvo)) return null;
  return Math.round((alvo - new Date()) / 864e5);
}
/* hoje em YYYY-MM-DD (fuso local) */
function comHoje(){
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---- anexos em PDF (coleção arquivos) ----
   Plano Spark não tem Storage. Um PDF pequeno (até 700 KB) vira base64 num
   doc próprio da coleção `arquivos`, separado do registro que o referencia
   (documentos/contratos): assim a lista do Painel e dos Contratos continua
   leve — o conteúdo só baixa no clique em "Abrir PDF". Acima do limite, o
   caminho é o link do Drive, como sempre. Rules: `arquivos` atrás de
   canComercial() (ler/criar), excluir só diretoria. */
var COM_ARQ_MAX = 700 * 1024;
var COM_ARQ_MSG_REGRAS = 'Anexar PDF depende das regras novas (coleção arquivos) publicadas no Console do Firebase.';

/* markup do campo de anexo: input + estado + botão de remover.
   pfx = prefixo dos ids (ex.: 'docrArq' gera docrArqInput, docrArqInfo, docrArqRemover) */
function comArqCampo(pfx, rotulo){
  return '<label style="display:block">' + escHtml(rotulo || 'Anexar PDF (até 700 KB)') +
    '<input class="fin-input" type="file" id="' + pfx + 'Input" accept="application/pdf,.pdf"></label>' +
    '<p id="' + pfx + 'Info" style="margin:.3rem 0 0;font-size:.85rem;color:var(--muted)"></p>' +
    '<button type="button" class="mini" id="' + pfx + 'Remover" hidden>Remover PDF anexado</button>';
}
/* lê o arquivo escolhido → {nome, tam, b64}; rejeita o que não é PDF ou passa do limite */
function comArqLer(file){
  return new Promise(function(res, rej){
    if(!file) return res(null);
    var pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    if(!pdf) return rej(new Error('Só PDF.'));
    if(file.size > COM_ARQ_MAX) return rej(new Error('PDF com ' + Math.round(file.size / 1024) + ' KB — o limite é 700 KB. Acima disso, suba no Drive e cole o link.'));
    var fr = new FileReader();
    fr.onload = function(){ res({ nome: file.name, tam: file.size, b64: String(fr.result).split(',')[1] || '' }); };
    fr.onerror = function(){ rej(new Error('Não foi possível ler o arquivo.')); };
    fr.readAsDataURL(file);
  });
}
/* grava em arquivos/{id}; refCol/refId dizem quem usa o anexo (pra auditoria e limpeza) */
function comArqSalvar(arq, refCol, refId){
  return col('arquivos').add({
    nome: arq.nome, tipo: 'application/pdf', tam: arq.tam, b64: arq.b64,
    refCol: refCol || '', refId: refId || '',
    criadoPor: ME.nome || ME.email,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(ref){ return ref.id; });
}
/* abre o PDF numa aba nova (blob local — nada sai do navegador) */
function comArqAbrir(id, msgId){
  if(!id) return;
  var janela = window.open('', '_blank'); /* abre antes do await: bloqueador de popup */
  col('arquivos').doc(id).get().then(function(s){
    if(!s.exists) throw new Error('nf');
    var d = s.data();
    var bin = atob(d.b64 || ''), u8 = new Uint8Array(bin.length);
    for(var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([u8], { type: 'application/pdf' }));
    if(janela) janela.location = url; else window.open(url, '_blank');
  }).catch(function(){
    if(janela) janela.close();
    if(msgId) flashMsg(msgId, 'Não foi possível abrir o PDF — anexo removido ou regras não publicadas.');
  });
}
function comArqExcluir(id){
  if(!id) return Promise.resolve();
  return col('arquivos').doc(id).delete().catch(function(){});
}
function comArqTam(tam){ return Math.round((tam || 0) / 1024) + ' KB'; }
