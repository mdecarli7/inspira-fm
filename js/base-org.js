'use strict';
/* =====================================================================
 * base-org.js — organização e utilidades comuns dos módulos novos (js/*.js)
 * Carrega DEPOIS do runtime.js: enxerga os globais dele (db, ME, escHtml,
 * btnBusy, flashMsg, registrarModulo, GATES...).
 *
 * Regra de ouro: código novo NUNCA hardcoda dado da organização (nome, CNPJ,
 * cidade, preço). Tudo vem do doc Firestore config/org — com fallback pras
 * constantes do runtime enquanto o doc não existe. Num futuro multi-tenant,
 * este arquivo é o único ponto que muda.
 * ===================================================================== */

/* fallback local: espelho do que o runtime já assume hoje */
var ORG = {
  nome: 'Inspira FM 97.7',
  cidade: 'Campinas/SP',
  cnpj: '',
  setores: SETORES.slice()
};

var ORG_PROMISE = null;
/* orgCarregar(): promessa cacheada do config/org. Módulo que precisa de dado
   da org chama no próprio init: orgCarregar().then(function(org){ ... }).
   Falha de leitura (doc ausente, sem permissão) NÃO cacheia — devolve o
   fallback e tenta de novo na próxima chamada. */
function orgCarregar(){
  if(ORG_PROMISE) return ORG_PROMISE;
  ORG_PROMISE = db.collection('config').doc('org').get().then(function(s){
    if(s.exists){
      var d = s.data() || {};
      Object.keys(d).forEach(function(k){ ORG[k] = d[k]; });
    }
    return ORG;
  }).catch(function(){
    ORG_PROMISE = null;
    return ORG;
  });
  return ORG_PROMISE;
}

/* Acesso a coleção SEMPRE por aqui nos módulos novos. Hoje é um repasse;
   num futuro multi-tenant vira orgs/{id}/<nome> trocando só esta função. */
function col(nome){ return db.collection(nome); }
