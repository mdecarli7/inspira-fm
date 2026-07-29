'use strict';
/* =====================================================================
 * nav-setores.js — gates de VISIBILIDADE do menu por setor (29/07/2026).
 * ATENÇÃO: 'setor' é editável pela própria pessoa (Minha conta), então
 * isto é organização de menu (UX), NUNCA controle de acesso. O dado por
 * trás das views que estes gates escondem (programação, campanhas,
 * quadros, planejamento, radar) continua legível por todo aprovado nas
 * rules — quem trocar o próprio setor só muda o que vê no menu.
 * O que é restrito de verdade (comercial, financeiro, admin) segue nos
 * gates com/fin/admin, espelhados no firestore.rules.
 * Carrega depois de comercial-core.js (usa canCom no matcom/mktcom).
 * ===================================================================== */

function setorEh(s){ return !!(ME && ME.setor === s); }

/* Radar: Marketing + diretoria */
GATES.mkt = function(){ return canRe() || setorEh('Marketing'); };

/* Planejamento: Marketing, Agência Externa + diretoria (a agência opera o
   calendário das redes) */
GATES.plan = function(){ return canRe() || setorEh('Marketing') || setorEh('Agência Externa'); };

/* Campanhas e Quadros: Marketing, Comercial + diretoria */
GATES.mktcom = function(){
  return canRe() || canCom() || setorEh('Marketing') || setorEh('Comercial');
};

/* Programação: mktcom + Rádio Ao Vivo (a grade do ar é deles) */
GATES.prog = function(){ return GATES.mktcom() || setorEh('Rádio Ao Vivo'); };

/* título "Marketing" do menu: união de todo mundo que vê algo da seção */
GATES.mktcap = function(){
  return GATES.mktcom() || setorEh('Rádio Ao Vivo') || setorEh('Agência Externa');
};

/* Materiais comerciais (e o título "Comercial" do menu): comercial de
   verdade (flag/diretoria) + Marketing, que consome mídia kit e
   apresentações aprovadas */
GATES.matcom = function(){ return canCom() || setorEh('Marketing'); };
