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
