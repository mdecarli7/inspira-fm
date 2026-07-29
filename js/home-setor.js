'use strict';
/* =====================================================================
 * home-setor.js — card "Seu dia" no topo da Home, por setor + permissões,
 * e a linha "desde o seu último acesso" (usa o ultimoAcesso anterior que
 * o runtime guardou no localStorage no login).
 * Extensão da view 'inicio': roda junto do homeInit a cada visita à Home.
 * Leituras extras pontuais e 1× por sessão (get, nunca onSnapshot).
 * ===================================================================== */

registrarModulo({ id: 'home-setor', extensaoDe: 'inicio', init: hsInit });

var hsCard = null, hsComDados = null, hsBuscandoCom = false, hsGrade = null, hsBuscandoGrade = false;

function hsInit(){
  if(!ME) return;
  var grid = document.querySelector('#view-inicio .home-grid');
  if(!grid) return;
  if(!hsCard){
    hsCard = document.createElement('div');
    hsCard.className = 'home-card hc-wide';
    hsCard.id = 'homeSetor';
    grid.insertBefore(hsCard, grid.firstChild);
  }
  /* dados sob demanda, 1× por sessão, só de quem interessa ao papel */
  if(typeof canCom === 'function' && canCom() && !hsComDados && !hsBuscandoCom) hsBuscarComercial();
  if(ME.setor === 'Rádio Ao Vivo' && !hsGrade && !hsBuscandoGrade) hsBuscarGrade();
  hsRender();
  /* os streams da Home (campanhas, ideias) chegam async — refaz a linha de
     novidades quando eles já povoaram */
  setTimeout(hsRender, 2500);
}

/* ---- coletas pontuais ---- */
function hsBuscarComercial(){
  hsBuscandoCom = true;
  Promise.all([
    col('agenda_comercial').get().then(function(qs){
      var rows = []; qs.forEach(function(d){ rows.push(d.data()); }); return rows;
    }),
    col('contratos').get().then(function(qs){
      var rows = []; qs.forEach(function(d){ rows.push(d.data()); }); return rows;
    })
  ]).then(function(r){
    var hoje = comHoje(), agenda = r[0], contratos = r[1];
    var aviso = (COM_CFG && COM_CFG.regras && COM_CFG.regras.avisoPrevioDias) || 30;
    hsComDados = {
      atrasados: agenda.filter(function(a){ return !a.feito && a.data && a.data < hoje; }).length,
      deHoje: agenda.filter(function(a){ return !a.feito && a.data === hoje; }).length,
      renovar: contratos.filter(function(c){
        if(c.status !== 'ativo') return false;
        var d = comDiasAte(c.fim);
        return d !== null && d <= aviso;
      }).length
    };
    hsRender();
  }).catch(function(){
    /* sem permissão/offline: libera pra tentar de novo na próxima visita à Home */
    hsBuscandoCom = false;
  });
}
function hsBuscarGrade(){
  hsBuscandoGrade = true;
  db.collection('programacao').doc('radio-ao-vivo').get().then(function(s){
    hsGrade = (s.exists && s.data().itens) || [];
    hsRender();
  }).catch(function(){ hsGrade = []; });
}

/* ---- render ---- */
function hsRender(){
  if(!hsCard || !ME) return;
  var linhas = [];

  /* bloco por setor / permissão */
  if(typeof canCom === 'function' && canCom()){
    if(hsComDados){
      linhas.push('<li>' +
        (hsComDados.atrasados ? '<b style="color:#c62828">' + hsComDados.atrasados + ' compromisso(s) atrasado(s)</b>' : 'Nenhum atraso na agenda') +
        ' · ' + hsComDados.deHoje + ' para hoje — <a class="mini-link" href="#agenda-comercial">abrir agenda →</a></li>');
      linhas.push('<li>' +
        (hsComDados.renovar ? '<b>' + hsComDados.renovar + ' contrato(s) na janela de renovação</b>' : 'Nenhum contrato a renovar') +
        ' — <a class="mini-link" href="#contratos">ver contratos →</a></li>');
      linhas.push('<li><a class="mini-link" href="#comercial">Painel comercial: funil e meta do mês →</a></li>');
    } else {
      linhas.push('<li>Carregando o resumo do comercial…</li>');
    }
  }
  if(ME.setor === 'Rádio Ao Vivo'){
    if(hsGrade && hsGrade.length){
      hsGrade.slice(0, 4).forEach(function(it){
        linhas.push('<li>' + escHtml(it.h || '') + ' · <b>' + escHtml(it.t || '') + '</b> <small>' + escHtml(it.d || '') + '</small></li>');
      });
      linhas.push('<li><a class="mini-link" href="#programacao">grade completa →</a></li>');
    } else {
      linhas.push('<li><a class="mini-link" href="#programacao">Ver a grade do ar →</a></li>');
    }
  }
  if(ME.setor === 'Marketing' || ME.setor === 'Agência Externa'){
    var nRasc = 0, nCom = 0;
    if(typeof campRows !== 'undefined' && campRows.length){
      campRows.forEach(function(r){
        if(r.d.status === 'rascunho') nRasc++;
        if(r.d.status === 'comercializacao') nCom++;
      });
    }
    linhas.push('<li>' + nRasc + ' campanha(s) em discussão · ' + nCom + ' em comercialização — <a class="mini-link" href="#campanhas">abrir →</a></li>');
    linhas.push('<li><a class="mini-link" href="#planejamento">Planejamento das redes desta semana →</a></li>');
  }
  if(ME.setor === 'Eventos'){
    linhas.push('<li>Os eventos da semana estão no card ao lado — <a class="mini-link" href="#planejamento">ver o calendário →</a></li>');
  }
  if(ME.setor === 'Adm/Financeiro' && typeof canFin === 'function' && canFin()){
    linhas.push('<li><a class="mini-link" href="#financeiro">Equipe: folha e custo →</a></li>');
  }
  if(!linhas.length){
    linhas.push('<li>Explore o menu ao lado — Campanhas, Planejamento e Brainstorm são de todos.</li>');
  }

  hsCard.innerHTML =
    '<header><h3><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Seu dia' +
      (ME.setor ? ' — ' + escHtml(ME.setor) : '') + '</h3></header>' +
    '<div class="hc-body">' +
      '<ul class="hc-list">' + linhas.join('') + '</ul>' +
      '<p style="margin:.6rem 0 0;color:var(--muted);font-size:.85rem">' + hsNovidadesTexto() + '</p>' +
    '</div>';
}

/* "desde o seu último acesso": compara os streams que a Home já carrega
   (campanhas e ideias) com o ultimoAcesso anterior guardado no login */
function hsNovidadesTexto(){
  var lastMs = 0;
  try{ lastMs = parseInt(localStorage.getItem('ultimoAcessoAnterior'), 10) || 0; }catch(e){}
  if(!lastMs) return 'Primeiro acesso registrado — a partir de agora este card conta as novidades pra você.';
  function novos(rows, campo){
    var n = 0;
    (rows || []).forEach(function(r){
      var t = r.d && r.d[campo];
      if(t && t.toMillis && t.toMillis() > lastMs) n++;
    });
    return n;
  }
  var ideias = typeof BS_ROWS !== 'undefined' ? novos(BS_ROWS, 'criadoEm') : 0;
  var camps = typeof campRows !== 'undefined' ? novos(campRows, 'atualizadoEm') : 0;
  if(!ideias && !camps) return 'Nada novo desde o seu último acesso.';
  var p = [];
  if(ideias) p.push(ideias + ' ideia(s) nova(s) no Brainstorm');
  if(camps) p.push(camps + ' campanha(s) atualizada(s)');
  return 'Desde o seu último acesso: ' + p.join(' · ') + '.';
}
