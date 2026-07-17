'use strict';
/* =====================================================================
 * Inspira FM · Relatórios da Diretoria — runtime com Firebase
 * Login: Google ou e-mail/senha (recuperação automática por e-mail).
 * Conteúdo sensível vive no Firestore, protegido por Security Rules:
 *   content/base            → colaborador, diretor, admin
 *   content/reestruturacao  → diretor, admin
 *   content/financeiro      → admin ou verFinanceiro
 *   fin/folha               → leitura/edição: admin ou verFinanceiro
 *   users/{uid}             → perfil e papel de cada conta
 * ===================================================================== */

var firebaseConfig = {
  apiKey: "AIzaSyArw45z7IbzziWHhWpd25N3R8NA84pu890",
  authDomain: "inspira-fm-c2a06.firebaseapp.com",
  projectId: "inspira-fm-c2a06",
  storageBucket: "inspira-fm-c2a06.firebasestorage.app",
  messagingSenderId: "946317890768",
  appId: "1:946317890768:web:c03e8e317748da79e43ad5"
};
var ADMIN_EMAIL = 'mdecarli7contato@gmail.com';

firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var db = firebase.firestore();
auth.useDeviceLanguage();

/* =================== setores oficiais (organograma) =================== */
var SETORES = ['Marketing','Comercial','Adm/Financeiro','Rádio Ao Vivo','Eventos','Agência Externa'];
function setorSlug(s){
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

/* =================== estado =================== */
var ME = null;            // {uid,email,role,setor,verFinanceiro,nome}
var CONTENT = {};         // {base:{inicio,analise,organograma}, re:{html,cost}, fin:{html,defaults}}
var appInitDone = false;
var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =================== helpers de UI de login =================== */
var gate = document.getElementById('gate');
var app = document.getElementById('app');
var authBox = document.getElementById('authBox');
var pendingBox = document.getElementById('pendingBox');
var authMsg = document.getElementById('authMsg');

function msg(t, ok){ authMsg.textContent = t; authMsg.className = 'auth-msg ' + (ok ? 'ok' : 'err'); }
function authBusy(on){
  ['btnGoogle','btnLogin','btnSignup'].forEach(function(id){ document.getElementById(id).disabled = on; });
}
function ptError(e){
  var c = (e && e.code) || '';
  if(c.indexOf('wrong-password') > -1 || c.indexOf('invalid-credential') > -1) return 'E-mail ou senha incorretos.';
  if(c.indexOf('user-not-found') > -1) return 'Nenhuma conta com esse e-mail. Use “Criar conta”.';
  if(c.indexOf('invalid-email') > -1) return 'E-mail inválido.';
  if(c.indexOf('email-already-in-use') > -1) return 'Esse e-mail já tem conta. Use “Entrar” ou recupere a senha.';
  if(c.indexOf('weak-password') > -1) return 'Senha muito curta: use pelo menos 6 caracteres.';
  if(c.indexOf('popup-closed') > -1 || c.indexOf('cancelled-popup') > -1) return 'Janela do Google fechada antes de concluir.';
  if(c.indexOf('network') > -1) return 'Sem conexão. Verifique a internet.';
  if(c.indexOf('too-many-requests') > -1) return 'Muitas tentativas. Aguarde alguns minutos.';
  return 'Não foi possível entrar (' + (c || 'erro desconhecido') + ').';
}

document.getElementById('btnGoogle').addEventListener('click', function(){
  authBusy(true); msg('', true);
  auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
    .catch(function(e){ msg(ptError(e)); })
    .finally(function(){ authBusy(false); });
});
document.getElementById('btnLogin').addEventListener('click', function(){
  var em = document.getElementById('authEmail').value.trim();
  var pw = document.getElementById('authPass').value;
  if(!em || !pw){ msg('Preencha e-mail e senha.'); return; }
  authBusy(true); msg('', true);
  auth.signInWithEmailAndPassword(em, pw)
    .catch(function(e){ msg(ptError(e)); })
    .finally(function(){ authBusy(false); });
});
document.getElementById('btnSignup').addEventListener('click', function(){
  var em = document.getElementById('authEmail').value.trim();
  var pw = document.getElementById('authPass').value;
  if(!em || !pw){ msg('Preencha e-mail e a senha desejada.'); return; }
  authBusy(true); msg('', true);
  auth.createUserWithEmailAndPassword(em, pw)
    .then(function(){ msg('Conta criada! Aguarde a aprovação do administrador.', true); })
    .catch(function(e){ msg(ptError(e)); })
    .finally(function(){ authBusy(false); });
});
document.getElementById('btnReset').addEventListener('click', function(){
  var em = document.getElementById('authEmail').value.trim();
  if(!em){ msg('Digite seu e-mail no campo acima e clique de novo.'); return; }
  auth.sendPasswordResetEmail(em)
    .then(function(){ msg('E-mail de redefinição enviado para ' + em + '. Confira a caixa de entrada (e o spam).', true); })
    .catch(function(e){ msg(ptError(e)); });
});
document.getElementById('btnSairPend').addEventListener('click', function(){ auth.signOut(); });
document.getElementById('btnSair').addEventListener('click', function(){
  auth.signOut().then(function(){ location.hash = ''; location.reload(); });
});

/* =================== sessão =================== */
auth.onAuthStateChanged(function(user){
  if(!user){
    gate.style.display = 'flex';
    authBox.hidden = false; pendingBox.hidden = true;
    app.hidden = true;
    return;
  }
  var ref = db.collection('users').doc(user.uid);
  ref.get().then(function(snap){
    if(snap.exists) return snap;
    return ref.set({
      email: user.email, nome: user.displayName || '',
      setor: '', role: 'pendente', verFinanceiro: false,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(){ return ref.get(); });
  }).then(function(snap){
    var d = snap && snap.exists ? snap.data() : { role: 'pendente' };
    if(user.email === ADMIN_EMAIL){ d.role = 'admin'; d.verFinanceiro = true; }
    ME = { uid: user.uid, email: user.email, nome: d.nome || user.displayName || '',
           setor: d.setor || '', role: d.role || 'pendente', verFinanceiro: !!d.verFinanceiro };
    if(!ME.setor && ME.role !== 'admin'){ showSetorPicker(); return; }
    if(ME.role === 'pendente'){ showPending(); return; }
    loadContent();
  }).catch(function(){
    // sem permissão de criar/ler o próprio doc = regras ainda não publicadas
    showPending('Não foi possível verificar suas permissões. Se o problema persistir, avise o administrador.');
  });
});
function showPending(extra){
  gate.style.display = 'flex';
  authBox.hidden = true; pendingBox.hidden = false;
  document.getElementById('setorBox').hidden = true;
  document.getElementById('pendMail').textContent = (auth.currentUser && auth.currentUser.email) || '';
  if(extra) pendingBox.querySelector('p:nth-of-type(2)').textContent = extra;
  app.hidden = true;
}

/* cadastro: escolha do setor no primeiro acesso */
function showSetorPicker(){
  gate.style.display = 'flex';
  authBox.hidden = true; pendingBox.hidden = true;
  app.hidden = true;
  var box = document.getElementById('setorBox');
  box.hidden = false;
  var sel = document.getElementById('setorSelect');
  if(sel.options.length <= 1){
    sel.innerHTML = '<option value="">Selecione o setor…</option>' + SETORES.map(function(s){
      return '<option value="' + escHtml(s) + '">' + escHtml(s) + '</option>';
    }).join('');
  }
}
document.getElementById('setorSalvar').addEventListener('click', function(){
  var s = document.getElementById('setorSelect').value;
  var msgEl = document.getElementById('setorMsg');
  if(!s){ msgEl.textContent = 'Escolha um setor da lista.'; msgEl.className = 'auth-msg err'; return; }
  var btn = this; btn.disabled = true;
  db.collection('users').doc(ME.uid).update({ setor: s }).then(function(){
    ME.setor = s;
    document.getElementById('setorBox').hidden = true;
    if(ME.role === 'pendente') showPending(); else loadContent();
  }).catch(function(){
    msgEl.textContent = 'Não foi possível salvar. Tente de novo.'; msgEl.className = 'auth-msg err';
  }).finally(function(){ btn.disabled = false; });
});

function canRe(){ return ME && (ME.role === 'diretor' || ME.role === 'admin'); }
function canFin(){ return ME && (ME.role === 'admin' || ME.verFinanceiro === true); }
function isAdmin(){ return ME && ME.role === 'admin'; }

function loadContent(){
  var gets = [ db.collection('content').doc('base').get() ];
  if(canFin()) gets.push(db.collection('content').doc('financeiro').get()); else gets.push(Promise.resolve(null));
  Promise.all(gets).then(function(r){
    if(!r[0] || !r[0].exists) throw new Error('conteúdo não publicado');
    CONTENT.base = r[0].data();
    CONTENT.fin = r[1] && r[1].exists ? r[1].data() : null;
    enterApp();
  }).catch(function(){
    showPending('Seu acesso está aprovado, mas o conteúdo não pôde ser carregado. Avise o administrador.');
  });
}

function enterApp(){
  /* view-inicio agora é o painel do dia (markup fixo); o hero antigo do Instagram vive na Análise Social */
  document.getElementById('view-analise').innerHTML = CONTENT.base.analise;
  /* renomeada: Análise Social → Análise Redes Sociais (conteúdo vem do Firestore; título ajustado aqui) */
  var anH2 = document.querySelector('#view-analise .page-hero h2');
  if(anH2) anH2.textContent = 'Análise Redes Sociais';
  document.getElementById('view-organograma').innerHTML = CONTENT.base.organograma;
  if(CONTENT.fin) document.getElementById('view-financeiro').innerHTML = CONTENT.fin.html;
  /* Reestruturações: o hub é fixo; o relatório original (legado) injeta sob demanda */
  // nav conforme permissão
  document.querySelectorAll('[data-need="re"]').forEach(function(a){ a.hidden = !canRe(); });
  document.querySelectorAll('[data-need="fin"]').forEach(function(a){ a.hidden = !canFin(); });
  document.querySelectorAll('[data-need="admin"]').forEach(function(a){ a.hidden = !isAdmin(); });
  // esconde da Home os cartões de relatório sem permissão
  if(!canRe()) document.querySelectorAll('#view-inicio a[href="#reestruturacao"]').forEach(function(a){ a.remove(); });
  document.getElementById('chipEmail').textContent = ME.email;
  gate.style.display = 'none';
  app.hidden = false;
  initApp();
  route();
}

/* =================== router =================== */
var VIEWS = ['inicio','analise','dial','site','mobradio','processos','campanhas','reestruturacao','organograma','financeiro','usuarios','juridico','programacao','quadros','embaixadores'];
var counted = false;

function viewAllowed(id){
  if(id === 'reestruturacao' || id === 'juridico') return canRe();
  if(id === 'financeiro') return canFin();
  if(id === 'usuarios') return isAdmin();
  return true;
}
function route(){
  if(app.hidden) return;
  var id = (location.hash || '#inicio').slice(1);
  if(VIEWS.indexOf(id) < 0 || !viewAllowed(id)) id = 'inicio';
  VIEWS.forEach(function(v){
    var sec = document.getElementById('view-' + v);
    var active = v === id;
    sec.classList.toggle('active', active);
    document.querySelectorAll('[data-nav="' + v + '"]').forEach(function(a){
      if(active) a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    });
  });
  window.scrollTo(0,0);
  if(id === 'inicio') homeInit();
  if(id === 'usuarios') buildUsers();
  if(id === 'reestruturacao') projInit();
  if(id === 'processos') buildProcessos();
  if(id === 'campanhas') campInit();
  if(id === 'dial') dialInit();
  if(id === 'juridico') jurInit();
  if(id === 'programacao') progInit();
  if(id === 'quadros') qdInit();
  if(id === 'embaixadores') embInit();
  requestAnimationFrame(armCharts);
}
window.addEventListener('hashchange', route);

/* =================== count-up =================== */
function runCountUps(){
  if(counted) return;
  counted = true;
  document.querySelectorAll('[data-count]').forEach(function(el){
    var target = parseInt(el.getAttribute('data-count'), 10);
    if(reduceMotion){ el.textContent = fmtInt(target); return; }
    var dur = 1400, t0 = null;
    function step(ts){
      if(t0 === null) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 4);
      el.textContent = fmtInt(Math.round(target * eased));
      if(p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}
function fmtInt(n){ return n.toLocaleString('pt-BR'); }
function fmtBRL(v){ return v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}); }

/* =================== dados públicos (gráficos da análise) =================== */
var PERFIS = [
 {r:1, nome:'Kiss FM 107,9', perfil:'@kissfm92.5', tipo:'rede', seg:530500, segTxt:'530,5 mil', curt:'~500', engTxt:'0,09%', eng:0.09, alerta:null, obs:'Perfil da rede nacional — não exclusivo de Campinas. Local: @kissfmcampinas (3,4 mil).'},
 {r:2, nome:'Antena 1 107,5', perfil:'@antena1', tipo:'rede', seg:248900, segTxt:'248,9 mil', curt:'~250 (picos 1–9 mil)', engTxt:'~0,10%', eng:0.10, alerta:null, obs:'Perfil da rede nacional — não exclusivo. Local só conta comercial (958 seg.).'},
 {r:3, nome:'Educadora FM 91,7', perfil:'@educadorafm', tipo:'local', seg:153400, segTxt:'153,4 mil', curt:'mediana ~130; virais 2–14 mil', engTxt:'0,08%', eng:0.08, alerta:'medio', obs:'Maior base local. Engajamento orgânico baixo, mas virais frequentes indicam audiência real.'},
 {r:4, nome:'Band FM 106,7', perfil:'@bandfmcampinas', tipo:'local', seg:95900, segTxt:'95,9 mil', curt:'~88 (13–322)', engTxt:'0,09%', eng:0.09, alerta:'medioalto', obs:'Base construída em sorteios; comentários dependem de mecânicas promocionais.'},
 {r:5, nome:'Nativa FM 89,3', perfil:'@nativacampinas', tipo:'local', seg:93500, segTxt:'93,5 mil', curt:'~131 (43–566)', engTxt:'0,14%', eng:0.14, alerta:'medio', obs:'16,7 mil posts; muito ativa; base antiga com seguidores inativos.'},
 {r:6, nome:'CBN Campinas 99,1', perfil:'@cbncampinas', tipo:'local', seg:88600, segTxt:'88,6 mil', curt:'~42 (8–227)', engTxt:'0,05%', eng:0.05, alerta:'alto', obs:'88 mil seguidores com 8–40 curtidas/post: base não corresponde à audiência real.'},
 {r:7, nome:'Rede Aleluia 98,3', perfil:'@redealeluia', tipo:'rede', seg:83400, segTxt:'83,4 mil', curt:'~280', engTxt:'0,34%', eng:0.34, alerta:null, obs:'Perfil da rede nacional — não exclusivo. Sem Instagram local (só Facebook).'},
 {r:8, nome:'Top FM 96,5', perfil:'@topfmsp', tipo:'rede', seg:80700, segTxt:'80,7 mil', curt:'ocultas (sorteios: 33–86 mil coment.)', engTxt:'s/d', eng:null, alerta:null, obs:'Perfil da rede (SP) — não exclusivo. Filial Campinas sem perfil próprio.'},
 {r:9, nome:'Jovem Pan FM 89,9', perfil:'@jovempancampinas', tipo:'local', seg:44300, segTxt:'44,3 mil', curt:'~61 (1–388)', engTxt:'0,14%', eng:0.14, alerta:'medio', obs:'Bimodal: editorial rende 50–388; patrocinados rendem 1–5 curtidas.'},
 {r:10, nome:'Conecta FM 105,5', perfil:'@fmconecta', tipo:'local', seg:37700, segTxt:'37,7 mil', curt:'mediana ~14 (2–238)', engTxt:'0,13%', eng:0.13, alerta:'alto', obs:'37 mil seguidores com posts de 2–20 curtidas: forte indício de base inflada.'},
 {r:11, nome:'INSPIRA FM 97,7', perfil:'@inspirafm', tipo:'inspira', seg:23991, segTxt:'24,0 mil', curt:'~47 orgânico; reel viral 19 mil', engTxt:'~0,20%', eng:0.20, alerta:'baixo', obs:'Estreia jan/2026. +~9 mil seguidores na semana do reel viral (de 15 para 24 mil): maior salto do mercado em 2026.'},
 {r:12, nome:'Massa FM 97,1', perfil:'@massafmcampinas', tipo:'local', seg:19400, segTxt:'19,4 mil', curt:'~15 orgânico', engTxt:'0,08%', eng:0.08, alerta:'medioalto', obs:'Engajamento depende de sorteio com comentário obrigatório. Migrou 98,3 para 97,1.'},
 {r:13, nome:'EP FM 84,9', perfil:'@epfmcampinas', tipo:'local', seg:14900, segTxt:'14,9 mil', curt:'~57 (6–169)', engTxt:'0,38%', eng:0.38, alerta:'baixo', obs:'Grupo EP (EPTV/Globo), no ar desde out/2024. Comentários acima da média (~9/post).'},
 {r:14, nome:'Cidade FM 92,5', perfil:'@cidade925', tipo:'local', seg:12300, segTxt:'12,3 mil', curt:'~17 (7–26)', engTxt:'0,14%', eng:0.14, alerta:'medio', obs:'Quase não posta (1–2/mês); following ~2,3 mil (padrão follow-back).'},
 {r:15, nome:'Jovem Pan News 100,3', perfil:'@jovempannewscampinas100.3', tipo:'local', seg:8700, segTxt:'8,7 mil', curt:'~27 (3–135)', engTxt:'~0,31%', eng:0.31, alerta:'baixo', obs:'4–5 posts/dia de notícia local; conta saudável e ativa.'},
 {r:16, nome:'Bandeirantes 85,7', perfil:'@bandeirantescampinas', tipo:'local', seg:8100, segTxt:'8,1 mil', curt:'~26 orgânico; reel viral 9 mil', engTxt:'~0,32%', eng:0.32, alerta:'baixo', obs:'Vários posts/dia (Ponte Preta/Guarani). Reel viral de 9 mil curtidas em ~11/07 — monitorar.'},
 {r:17, nome:'Laser 93,3', perfil:'@laser933', tipo:'local', seg:7300, segTxt:'7,3 mil', curt:'~29 (7–77)', engTxt:'0,40%', eng:0.40, alerta:'baixo', obs:'Posta pouco (2–4/mês). Mesmo grupo da Cidade 92,5.'},
 {r:18, nome:'Novabrasil 103,7', perfil:'@novabrasilcampinas', tipo:'local', seg:5700, segTxt:'5,7 mil', curt:'~15 orgânico', engTxt:'0,26%', eng:0.26, alerta:'baixo', obs:'Perfil local pequeno; rede nacional @novabrasilfm tem 282 mil.'},
 {r:19, nome:'Play FM 99,7', perfil:'@playradio997', tipo:'local', seg:4700, segTxt:'4,7 mil', curt:'~96 (21–240)', engTxt:'~2,0%', eng:2.02, alerta:'baixo', obs:'Estreia abr/2026 (Grupo Bandeirantes). Engajamento alto típico de conta nova e pequena — monitorar de perto.'},
 {r:20, nome:'Mix FM 101,1', perfil:'@mixfmcampinas', tipo:'local', seg:3700, segTxt:'3,7 mil', curt:'1–8 (média ~2)', engTxt:'~0,05%', eng:0.05, alerta:'medio', obs:'Ativa (posta a cada 2 dias) mas engajamento quase nulo.'},
 {r:21, nome:'Kiss FM (local) 107,9', perfil:'@kissfmcampinas', tipo:'local', seg:3400, segTxt:'3,4 mil', curt:'~66 (6–293)', engTxt:'~1,9%', eng:1.90, alerta:'baixo', obs:'Inativa há ~18 dias; posta em rajadas. Há 2º perfil local (@kissfmcampinas_).'},
 {r:22, nome:'Antena 1 (local) 107,5', perfil:'@antena1_campinas_comercial', tipo:'local', seg:958, segTxt:'958', curt:'s/d', engTxt:'s/d', eng:null, alerta:'baixo', obs:'Conta comercial/captação: 27 posts, segue mais (1.370) do que é seguida.'},
 {r:23, nome:'Educativa FM 101,9', perfil:'@educativacampinas', tipo:'local', seg:537, segTxt:'537', curt:'~17 (4–29)', engTxt:'~3,2%', eng:3.20, alerta:'baixo', obs:'Rádio pública da Prefeitura; alcance muito pequeno, fases de inatividade.'},
 {r:24, nome:'Cidade Gospel 97,5', perfil:'@cidadegospel975', tipo:'local', seg:null, segTxt:'s/d', curt:'1–6 (1 reel viral 6 mil)', engTxt:'s/d', eng:null, alerta:'sd', obs:'1–2 posts/mês; engajamento orgânico quase nulo. Contador não indexado.'}
];
var TIPO_COLOR = { local:'var(--dv-teal)', rede:'var(--dv-blue)', inspira:'var(--dv-green)' };
var ALERTA_LBL = { alto:['ALTO','alto'], medioalto:['MÉDIO-ALTO','medioalto'], medio:['MÉDIO','medio'], baixo:['BAIXO','baixo'], sd:['S/D','sd'] };

/* =================== tooltip =================== */
var tip = document.getElementById('tip');
function tipShow(html, x, y){ tip.innerHTML = html; tip.classList.add('on'); tipMove(x, y); }
function tipMove(x, y){
  var w = tip.offsetWidth, h = tip.offsetHeight;
  var left = Math.min(Math.max(8, x + 14), window.innerWidth - w - 8);
  var top = y - h - 12; if(top < 8) top = y + 18;
  tip.style.left = left + 'px'; tip.style.top = top + 'px';
}
function tipHide(){ tip.classList.remove('on'); }
window.addEventListener('scroll', tipHide, {passive:true});
function bindTips(root){
  root.querySelectorAll('[data-tip]').forEach(function(el){
    el.addEventListener('mouseenter', function(e){ tipShow(el.getAttribute('data-tip'), e.clientX, e.clientY); });
    el.addEventListener('mousemove', function(e){ tipMove(e.clientX, e.clientY); });
    el.addEventListener('mouseleave', tipHide);
    el.addEventListener('focus', function(){ var r = el.getBoundingClientRect(); tipShow(el.getAttribute('data-tip'), r.left + r.width/2, r.top); });
    el.addEventListener('blur', tipHide);
  });
}
function escAttr(s){
  return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/&lt;(\/?b)&gt;/g,'<$1>').replace(/&lt;br&gt;/g,'<br>');
}
function escHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* =================== ícones outline (traço fino) =================== */
var ICONS = {
  megafone: '<path d="M3 10v4h3l5 4V6l-5 4H3z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a9 9 0 0 1 0 12"/>',
  alerta: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  raio: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  alvo: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  joinha: '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.3a2 2 0 0 0 2-1.7l1.4-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>',
  cadeado: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  chave: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2"/><path d="M17 6l3 3"/><path d="M14 9l2 2"/>'
};
function ic(nome){
  return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[nome] || '') + '</svg>';
}

/* =================== gráficos =================== */
function buildFollowers(){
  var host = document.getElementById('followersBars');
  if(!host) return;
  var max = 530500;
  host.innerHTML = PERFIS.map(function(p){
    var val = p.seg === null ? 0 : p.seg;
    var w = p.seg === null ? 0 : Math.max(val / max * 100, 0.35);
    var inside = w > 76 ? ' inside' : '';
    var tipHtml = '<b>' + p.nome + '</b> · ' + p.perfil + '<br>Seguidores: ' + p.segTxt +
      '<br>Curtidas méd./post: ' + p.curt + '<br>Engajamento: ' + p.engTxt +
      (p.alerta ? '<br>Alerta: ' + ALERTA_LBL[p.alerta][0] : '') + '<br>' + p.obs;
    return '<div class="bar-row' + (p.tipo === 'inspira' ? ' is-inspira' : '') + '" tabindex="0" data-tip="' + escAttr(tipHtml) + '">' +
      '<span class="name">' + p.nome + '</span>' +
      '<span class="bar-track"><span class="bar-fill" style="width:' + w.toFixed(2) + '%;background:' + TIPO_COLOR[p.tipo] + '"></span>' +
      '<span class="bar-val' + inside + '">' + p.segTxt + '</span></span></div>';
  }).join('');
  bindTips(host);
}
function buildEngagement(){
  var host = document.getElementById('engBars');
  if(!host) return;
  var rows = PERFIS.filter(function(p){ return p.tipo !== 'rede' && p.eng !== null; })
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
      '<span class="bar-val' + inside + '">' + p.engTxt.replace('~','') + '</span></span></div>';
  }).join('');
  bindTips(host);
}
function buildRanking(){
  var host = document.getElementById('rankTable');
  if(!host) return;
  var head = '<table><thead><tr><th>#</th><th>Rádio (FM)</th><th>Perfil</th><th>Tipo</th><th class="num">Seguidores</th><th>Curtidas méd./post</th><th class="num">Engaj.</th><th>Alerta</th><th>Observação</th></tr></thead><tbody>';
  var rows = PERFIS.map(function(p){
    var tipoPill = p.tipo === 'inspira' ? '<span class="pill inspira">INSPIRA</span>' :
      p.tipo === 'rede' ? '<span class="pill rede">REDE</span>' : '<span class="pill local">LOCAL</span>';
    var al = p.alerta ? '<span class="pill ' + ALERTA_LBL[p.alerta][1] + '">' + ALERTA_LBL[p.alerta][0] + '</span>' : '—';
    return '<tr' + (p.tipo === 'inspira' ? ' class="hl-inspira"' : '') + '><td>' + p.r + '</td><td><b>' + p.nome + '</b></td><td>' + p.perfil +
      '</td><td>' + tipoPill + '</td><td class="num">' + p.segTxt + '</td><td>' + p.curt +
      '</td><td class="num">' + p.engTxt + '</td><td>' + al + '</td><td style="min-width:18rem">' + p.obs + '</td></tr>';
  }).join('');
  host.innerHTML = head + rows + '</tbody></table>';
}
function buildGrowth(){
  var host = document.getElementById('growthChart');
  if(!host) return;
  var pts = [
    ['Jan/26', 0], ['Fev/26', 2500], ['Mar/26', 5500], ['Abr/26', 8000],
    ['Mai/26', 11000], ['Jun/26', 13500], ['08/Jul', 15000], ['14/Jul', 23991]
  ];
  var W = 920, H = 340, padL = 56, padR = 200, padT = 34, padB = 44;
  var maxY = 25000;
  var iw = W - padL - padR, ih = H - padT - padB;
  function X(i){ return padL + i / (pts.length - 1) * iw; }
  function Y(v){ return padT + (1 - v / maxY) * ih; }
  var grid = '';
  [0, 5000, 10000, 15000, 20000, 25000].forEach(function(v){
    grid += '<line x1="' + padL + '" y1="' + Y(v) + '" x2="' + (W - padR) + '" y2="' + Y(v) + '" stroke="#E3EAE2" stroke-width="1"/>' +
      '<text x="' + (padL - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="12" fill="#5A6B63">' + (v/1000) + ' mil</text>';
  });
  var lineD = pts.map(function(p, i){ return (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ');
  var areaD = lineD + ' L' + X(pts.length - 1).toFixed(1) + ',' + Y(0) + ' L' + X(0) + ',' + Y(0) + ' Z';
  var dots = '', labels = '';
  pts.forEach(function(p, i){
    var vx = X(i), vy = Y(p[1]);
    var viral = p[0] === '14/Jul';
    dots += '<circle cx="' + vx + '" cy="' + vy + '" r="' + (viral ? 7 : 4.5) + '" fill="' + (viral ? '#C25A14' : '#017A5C') + '" stroke="#fff" stroke-width="2"><title>' + p[0] + ': ' + fmtInt(p[1]) + ' seguidores</title></circle>';
    labels += '<text x="' + vx + '" y="' + (H - padB + 20) + '" text-anchor="middle" font-size="12" fill="#5A6B63">' + p[0] + '</text>';
  });
  var annX = X(pts.length - 1), annY = Y(23991);
  var ann = '<g font-size="12.5" fill="#8C3E0B">' +
    '<text x="' + (annX + 12) + '" y="' + (annY + 2) + '" font-weight="800">23.991 seguidores</text>' +
    '<text x="' + (annX + 12) + '" y="' + (annY + 18) + '">+~9 mil em 1 semana:</text>' +
    '<text x="' + (annX + 12) + '" y="' + (annY + 34) + '">reel viral de 09/07</text></g>';
  host.innerHTML =
    '<p class="chart-title">Trajetória estimada de seguidores desde a estreia (jan/2026)</p>' +
    '<svg class="svg-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Gráfico de linha: crescimento da Inspira FM de 0 seguidores em janeiro de 2026 a 23.991 em 14 de julho.">' +
    grid + '<path d="' + areaD + '" fill="#017A5C" opacity="0.08"/>' +
    '<path d="' + lineD + '" fill="none" stroke="#017A5C" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
    dots + labels + ann + '</svg>';
}

/* animação das barras */
var chartIO = ('IntersectionObserver' in window) ? new IntersectionObserver(function(entries){
  entries.forEach(function(en){
    if(en.isIntersecting){
      if(!reduceMotion) en.target.classList.add('anim');
      chartIO.unobserve(en.target);
    }
  });
}, {threshold:.18}) : null;
function armCharts(){
  document.querySelectorAll('.bar-chart, #costBars').forEach(function(c){
    if(c.classList.contains('anim') || c.dataset.armed) return;
    c.dataset.armed = '1';
    if(chartIO && !reduceMotion) chartIO.observe(c);
  });
}

/* =================== Balanço Financeiro (Firestore) =================== */
var finData = null;
var finEditIdx = -1;
var finBound = false;

function finDefaults(){
  return (CONTENT.fin && CONTENT.fin.defaults ? CONTENT.fin.defaults : []).map(function(p){ return {n:p.n, s:p.s, f:p.f, v:p.v}; });
}
function canEditFin(){ return isAdmin() || (ME && ME.verFinanceiro === true); }
function finLoad(){
  return db.collection('fin').doc('folha').get().then(function(snap){
    if(snap.exists && Array.isArray(snap.data().rows) && snap.data().rows.length) return snap.data().rows;
    return finDefaults();
  }).catch(function(){ return finDefaults(); });
}
function finSave(){
  return db.collection('fin').doc('folha').set({ rows: finData, atualizadoPor: ME.email,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() })
    .catch(function(){ finMsg('Sem permissão para salvar.'); });
}
function finSetores(){
  var s = [];
  finData.forEach(function(p){ if(s.indexOf(p.s) < 0) s.push(p.s); });
  return s;
}
function finRender(){
  var host = document.getElementById('finTable');
  if(!host || !finData) return;
  var edit = canEditFin();
  var sel = document.getElementById('finFilter');
  var filter = sel.value || '__all';
  var setores = finSetores();
  sel.innerHTML = '<option value="__all">Todos os setores</option>' + setores.map(function(s){
    return '<option value="' + escHtml(s) + '"' + (s === filter ? ' selected' : '') + '>' + escHtml(s) + '</option>';
  }).join('');
  if(filter !== '__all' && setores.indexOf(filter) < 0) filter = '__all';
  var dl = document.getElementById('finSetores');
  if(dl) dl.innerHTML = setores.map(function(s){ return '<option value="' + escHtml(s) + '">'; }).join('');
  var rows = '', total = 0, count = 0, semSalario = 0;
  finData.forEach(function(p, i){
    if(filter !== '__all' && p.s !== filter) return;
    count++;
    if(p.v > 0) total += p.v; else semSalario++;
    var sal = p.v > 0 ? '<td class="num">' + fmtBRL(p.v) + '</td>' : '<td class="num sal-nd">a definir</td>';
    var acts = edit ? '<td style="white-space:nowrap"><button type="button" class="mini" data-edit="' + i + '">Editar</button> ' +
      '<button type="button" class="mini del" data-del="' + i + '">Excluir</button></td>' : '';
    rows += '<tr><td><b>' + escHtml(p.n) + '</b></td><td>' + escHtml(p.s) + '</td><td>' + escHtml(p.f) + '</td>' + sal + acts + '</tr>';
  });
  var totLbl = filter === '__all' ? 'Total geral' : 'Total — ' + escHtml(filter);
  rows += '<tr class="total"><td colspan="3">' + totLbl + ' (' + count + ' pessoa' + (count === 1 ? '' : 's') +
    (semSalario ? ' · ' + semSalario + ' sem salário informado' : '') + ')</td><td class="num">' + fmtBRL(total) + '</td>' + (edit ? '<td></td>' : '') + '</tr>';
  host.innerHTML = '<table><thead><tr><th>Nome</th><th>Setor</th><th>Função</th><th class="num">Salário (R$/mês)</th>' + (edit ? '<th></th>' : '') + '</tr></thead><tbody>' + rows + '</tbody></table>';
}
function finCancelEdit(){
  finEditIdx = -1;
  var form = document.getElementById('finEditForm');
  if(!form) return;
  form.reset();
  document.getElementById('finFormTitle').textContent = 'Adicionar pessoa';
  document.getElementById('finSubmit').textContent = 'Adicionar';
  document.getElementById('finCancel').hidden = true;
}
function finMsg(t){
  var el = document.getElementById('finMsg');
  if(!el) return;
  el.textContent = t;
  clearTimeout(el._t);
  el._t = setTimeout(function(){ el.textContent = ''; }, 3500);
}
function initFin(){
  if(!document.getElementById('finTable')) return;
  finLoad().then(function(rows){
    finData = rows;
    // sem permissão de edição: esconde formulário e restaurar
    if(!canEditFin()){
      var form = document.getElementById('finEditForm');
      if(form) form.style.display = 'none';
      var t = document.getElementById('finFormTitle'); if(t) t.style.display = 'none';
      var r = document.getElementById('finReset'); if(r) r.style.display = 'none';
    }
    finRender();
    if(finBound || !canEditFin()) return;
    finBound = true;
    document.getElementById('finFilter').addEventListener('change', finRender);
    document.getElementById('finReset').addEventListener('click', function(){
      if(!confirm('Restaurar a tabela para o padrão original? As edições serão perdidas para todos.')) return;
      finData = finDefaults();
      finSave().then(function(){ finCancelEdit(); finRender(); finMsg('Tabela restaurada.'); });
    });
    document.getElementById('finTable').addEventListener('click', function(ev){
      var btn = ev.target.closest('button'); if(!btn) return;
      if(btn.dataset.edit !== undefined){
        finEditIdx = +btn.dataset.edit;
        var p = finData[finEditIdx];
        document.getElementById('finNome').value = p.n;
        document.getElementById('finSetor').value = p.s;
        document.getElementById('finFuncao').value = p.f;
        document.getElementById('finSalario').value = p.v > 0 ? p.v : '';
        document.getElementById('finFormTitle').textContent = 'Editar: ' + p.n;
        document.getElementById('finSubmit').textContent = 'Salvar alterações';
        document.getElementById('finCancel').hidden = false;
        document.getElementById('finEditForm').scrollIntoView({block:'center', behavior: reduceMotion ? 'auto' : 'smooth'});
        document.getElementById('finNome').focus();
      }else if(btn.dataset.del !== undefined){
        var i = +btn.dataset.del;
        if(!confirm('Excluir "' + finData[i].n + '" da tabela (para todos)?')) return;
        finData.splice(i, 1);
        finSave().then(function(){ finCancelEdit(); finRender(); finMsg('Removido.'); });
      }
    });
    document.getElementById('finEditForm').addEventListener('submit', function(ev){
      ev.preventDefault();
      var p = {
        n: document.getElementById('finNome').value.trim(),
        s: document.getElementById('finSetor').value.trim(),
        f: document.getElementById('finFuncao').value.trim(),
        v: parseFloat(document.getElementById('finSalario').value) || 0
      };
      if(!p.n || !p.s || !p.f) return;
      if(finEditIdx >= 0){ finData[finEditIdx] = p; }
      else{ finData.push(p); }
      finSave().then(function(){ finCancelEdit(); finRender(); finMsg('Salvo para todos os autorizados.'); });
    });
    document.getElementById('finCancel').addEventListener('click', finCancelEdit);
  });
}
/* o financeiro agora abre direto para quem tem permissão (regras no servidor) */

/* =================== Usuários (admin) =================== */
var usersUnsub = null;
function buildUsers(){
  if(!isAdmin()) return;
  var host = document.getElementById('usersTable');
  if(usersUnsub) return; // já ligado (onSnapshot mantém atualizado)
  usersUnsub = db.collection('users').onSnapshot(function(qs){
    var rows = [];
    qs.forEach(function(doc){ rows.push({ id: doc.id, d: doc.data() }); });
    rows.sort(function(a,b){ return (a.d.email||'').localeCompare(b.d.email||''); });
    host.innerHTML = '<table class="users-table"><thead><tr><th>E-mail</th><th>Nome</th><th>Setor</th><th>Nível</th><th>Balanço</th><th>Nível atual</th><th></th></tr></thead><tbody>' +
      rows.map(function(r){
        var d = r.d;
        var roleOpts = ['pendente','colaborador','diretor','admin'].map(function(x){
          return '<option value="' + x + '"' + (d.role === x ? ' selected' : '') + '>' + x.charAt(0).toUpperCase() + x.slice(1) + '</option>';
        }).join('');
        var lock = d.email === ADMIN_EMAIL;
        return '<tr data-uid="' + r.id + '">' +
          '<td>' + escHtml(d.email || '') + (lock ? ' ' + ic('chave') : '') + '</td>' +
          '<td>' + escHtml(d.nome || '—') + '</td>' +
          '<td><select class="fin-input u-setor"' + (lock ? ' disabled' : '') + '><option value="">—</option>' +
            ['Diretoria'].concat(SETORES).map(function(s){
              return '<option value="' + escHtml(s) + '"' + (d.setor === s ? ' selected' : '') + '>' + escHtml(s) + '</option>';
            }).join('') + '</select></td>' +
          '<td><select class="fin-input u-role"' + (lock ? ' disabled' : '') + '>' + roleOpts + '</select></td>' +
          '<td style="text-align:center"><input type="checkbox" class="u-fin"' + (d.verFinanceiro ? ' checked' : '') + (lock ? ' disabled' : '') + '></td>' +
          '<td><span class="pill role-' + (d.role || 'pendente') + '">' + (d.role || 'pendente').toUpperCase() + '</span></td>' +
          '<td>' + (lock ? '' : '<button type="button" class="mini u-save">Salvar</button>') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }, function(){
    host.innerHTML = '<div class="load-note">Sem permissão para listar usuários.</div>';
  });
  host.addEventListener('click', function(ev){
    var btn = ev.target.closest('.u-save'); if(!btn) return;
    var tr = btn.closest('tr');
    var uid = tr.getAttribute('data-uid');
    btn.disabled = true; btn.textContent = 'Salvando…';
    db.collection('users').doc(uid).update({
      setor: tr.querySelector('.u-setor').value.trim(),
      role: tr.querySelector('.u-role').value,
      verFinanceiro: tr.querySelector('.u-fin').checked
    }).then(function(){ btn.textContent = 'Salvo ✓'; setTimeout(function(){ btn.disabled = false; btn.textContent = 'Salvar'; }, 1500); })
      .catch(function(){ btn.disabled = false; btn.textContent = 'Erro'; });
  });
}

/* =================== Reestruturações (projetos) =================== */
var projUnsub = null;
var PJ = null; // projeto aberto: {id, data}
var PROJ_BLANK = function(){
  return { nome:'', setor:'', contexto:'', autor: ME ? (ME.nome || ME.email) : '', autorEmail: ME ? ME.email : '',
           antes:{pessoas:[],extras:[]}, depois:{pessoas:[],extras:[]}, processo:[], atencao:[], legacy:false };
};

function projInit(){
  if(!canRe() || projUnsub) return;
  projUnsub = db.collection('projetos').orderBy('atualizadoEm','desc').onSnapshot(function(qs){
    var rows = [];
    qs.forEach(function(doc){ rows.push({id:doc.id, d:doc.data()}); });
    renderProjList(rows);
  }, function(){
    document.getElementById('projList').innerHTML =
      '<div class="proj-empty">Não foi possível carregar os projetos. As regras da coleção <b>projetos</b> foram publicadas?</div>';
  });
  document.getElementById('projNew').addEventListener('click', function(){ openProj(null, PROJ_BLANK()); });
  document.getElementById('projBack').addEventListener('click', showHub);
  document.getElementById('pjSalvar').addEventListener('click', projSave);
  document.getElementById('pjExcluir').addEventListener('click', projDelete);
  document.getElementById('pjPublicar').addEventListener('click', projPublicar);
  var selSetor = document.getElementById('pjSetor');
  selSetor.innerHTML = '<option value="">Setor…</option>' + SETORES.map(function(s){
    return '<option value="' + escHtml(s) + '">' + escHtml(s) + '</option>';
  }).join('');
  ['pjNome','pjSetor','pjContexto'].forEach(function(id){
    var ev = id === 'pjSetor' ? 'change' : 'input';
    document.getElementById(id).addEventListener(ev, function(){
      if(!PJ) return;
      PJ.data.nome = document.getElementById('pjNome').value;
      PJ.data.setor = document.getElementById('pjSetor').value;
      PJ.data.contexto = document.getElementById('pjContexto').value;
      if(id === 'pjSetor') renderPanels(); /* atualiza botão de importar */
    });
  });
}
function projTotals(lado){
  var folha = lado.pessoas.reduce(function(s,p){ return s + (+p.v || 0); }, 0);
  var extras = lado.extras.reduce(function(s,p){ return s + (+p.v || 0); }, 0);
  return { folha: folha, extras: extras, total: folha + extras };
}
function renderProjList(rows){
  var host = document.getElementById('projList');
  if(!rows.length){
    host.innerHTML = '<div class="proj-empty">Nenhum projeto ainda. Clique em <b>+ Novo projeto</b> para simular a primeira reestruturação.</div>';
    return;
  }
  host.innerHTML = rows.map(function(r){
    var d = r.d;
    var eco = projTotals(d.antes).total - projTotals(d.depois).total;
    var ecoTxt = eco >= 0 ? '− R$ ' + fmtBRL(eco) + '/mês' : '+ R$ ' + fmtBRL(-eco) + '/mês';
    var quando = d.atualizadoEm && d.atualizadoEm.toDate ? d.atualizadoEm.toDate().toLocaleDateString('pt-BR') : '';
    return '<button type="button" class="proj-row" data-id="' + r.id + '">' +
      '<span class="pr-main"><span class="pr-nome">' + escHtml(d.nome || '(sem nome)') + '</span>' +
      '<span class="pr-sub">' + escHtml(d.setor || 'setor não definido') + ' · por ' + escHtml(d.autor || '—') +
      (quando ? ' · atualizado em ' + quando : '') + '</span></span>' +
      '<span class="pr-eco ' + (eco >= 0 ? 'pos' : 'neg') + '">' + ecoTxt + '</span></button>';
  }).join('');
  host.querySelectorAll('.proj-row').forEach(function(btn){
    btn.addEventListener('click', function(){
      db.collection('projetos').doc(btn.dataset.id).get().then(function(snap){
        if(snap.exists) openProj(snap.id, snap.data());
      });
    });
  });
}
function showHub(){
  PJ = null;
  document.getElementById('projEditor').hidden = true;
  document.getElementById('projHub').hidden = false;
  window.scrollTo(0,0);
}
function openProj(id, data){
  PJ = { id: id, data: JSON.parse(JSON.stringify(data)) };
  document.getElementById('projHub').hidden = true;
  document.getElementById('projEditor').hidden = false;
  document.getElementById('pjNome').value = PJ.data.nome || '';
  document.getElementById('pjSetor').value = PJ.data.setor || '';
  document.getElementById('pjContexto').value = PJ.data.contexto || '';
  if(!PJ.data.processo) PJ.data.processo = [];
  document.getElementById('pjExcluir').hidden = !id;
  var quando = PJ.data.atualizadoEm && PJ.data.atualizadoEm.toDate ? ' · atualizado em ' + PJ.data.atualizadoEm.toDate().toLocaleDateString('pt-BR') : '';
  document.getElementById('pjMeta').textContent = id ? 'Desenvolvido por ' + (PJ.data.autor || '—') + quando : 'Projeto novo — ainda não salvo.';
  renderPanels();
  renderProcesso();
  renderAtencao();
  recalc();
  window.scrollTo(0,0);
}
function itemRow(lado, tipo, i, item){
  var comFuncao = tipo === 'pessoas';
  return '<div class="pp-item" data-lado="' + lado + '" data-tipo="' + tipo + '" data-i="' + i + '">' +
    '<input class="fin-input i-nome" value="' + escHtml(item.n || '') + '" placeholder="' + (comFuncao ? 'nome' : 'item') + '">' +
    (comFuncao ? '<input class="fin-input i-funcao" value="' + escHtml(item.f || '') + '" placeholder="função">' : '') +
    '<input class="fin-input i-valor" type="number" min="0" step="0.01" value="' + (item.v || '') + '" placeholder="R$/mês">' +
    '<button type="button" class="i-del" title="Remover">×</button></div>';
}
function renderPanels(){
  ['antes','depois'].forEach(function(lado){
    ['pessoas','extras'].forEach(function(tipo){
      var host = document.getElementById('pp' + (tipo === 'pessoas' ? 'Pessoas' : 'Extras') + (lado === 'antes' ? 'Antes' : 'Depois'));
      var arr = PJ.data[lado][tipo];
      var extraBtn = (lado === 'depois')
        ? ' <button type="button" class="mini" data-copy="' + tipo + '">Copiar do Antes</button>'
        : (tipo === 'pessoas' && PJ.data.setor
          ? ' <button type="button" class="mini" data-import="1">Importar equipe atual (' + escHtml(PJ.data.setor) + ')</button>' : '');
      host.innerHTML = arr.map(function(item,i){ return itemRow(lado,tipo,i,item); }).join('') +
        '<div class="pp-add"><button type="button" class="mini" data-add="1">+ Adicionar ' +
        (tipo === 'pessoas' ? 'pessoa' : 'custo') + '</button>' + extraBtn + '</div>';
      host.onclick = function(ev){
        var b = ev.target.closest('button'); if(!b) return;
        if(b.dataset.add){ arr.push(tipo === 'pessoas' ? {n:'',f:'',v:0} : {n:'',v:0}); renderPanels(); recalc(); }
        else if(b.dataset.copy){ PJ.data.depois[tipo] = JSON.parse(JSON.stringify(PJ.data.antes[tipo])); renderPanels(); recalc(); }
        else if(b.dataset.import){ importEquipe(b); }
        else if(b.classList.contains('i-del')){
          var row = b.closest('.pp-item');
          arr.splice(+row.dataset.i, 1); renderPanels(); recalc();
        }
      };
      host.oninput = function(ev){
        var row = ev.target.closest('.pp-item'); if(!row) return;
        var item = arr[+row.dataset.i];
        if(ev.target.classList.contains('i-nome')) item.n = ev.target.value;
        else if(ev.target.classList.contains('i-funcao')) item.f = ev.target.value;
        else if(ev.target.classList.contains('i-valor')) item.v = parseFloat(ev.target.value) || 0;
        recalc();
      };
    });
  });
}
/* importa a equipe atual do setor a partir da folha (página Equipe) */
function importEquipe(btn){
  var setor = PJ.data.setor;
  btn.disabled = true; btn.textContent = 'Importando…';
  db.collection('fin').doc('folha').get().then(function(snap){
    if(!snap.exists) throw new Error('folha vazia');
    var rows = (snap.data().rows || []).filter(function(p){ return p.s === setor; });
    if(!rows.length){ pjMsgShow('Nenhuma pessoa do setor ' + setor + ' na página Equipe.'); return; }
    PJ.data.antes.pessoas = rows.map(function(p){ return { n: p.n, f: p.f, v: p.v || 0 }; });
    renderPanels(); recalc();
    pjMsgShow(rows.length + ' pessoa(s) importada(s) da página Equipe.');
  }).catch(function(){
    pjMsgShow('Sem acesso à folha — os salários são geridos pela diretoria Adm/Financeiro.');
  }).finally(function(){ renderPanels(); });
}

/* etapas do processo (antes/depois) */
function renderProcesso(){
  var host = document.getElementById('pjProcesso');
  var arr = PJ.data.processo;
  host.innerHTML = arr.map(function(p,i){
    return '<div class="proc-row" data-i="' + i + '">' +
      '<span class="n">' + (i+1) + '</span>' +
      '<input class="fin-input i-etapa" value="' + escHtml(p.e || '') + '" placeholder="etapa (ex.: Planejamento de pauta)">' +
      '<input class="fin-input i-antes" value="' + escHtml(p.a || '') + '" placeholder="responsável hoje">' +
      '<input class="fin-input i-depois" value="' + escHtml(p.d || '') + '" placeholder="como ficaria">' +
      '<button type="button" class="i-del" title="Remover etapa">×</button></div>';
  }).join('') + '<div class="pp-add"><button type="button" class="mini" data-add="1">+ Adicionar etapa</button></div>';
  host.onclick = function(ev){
    var b = ev.target.closest('button'); if(!b) return;
    if(b.dataset.add){ arr.push({e:'',a:'',d:''}); renderProcesso(); }
    else if(b.classList.contains('i-del')){ arr.splice(+b.closest('.proc-row').dataset.i, 1); renderProcesso(); }
  };
  host.oninput = function(ev){
    var row = ev.target.closest('.proc-row'); if(!row) return;
    var p = arr[+row.dataset.i];
    if(ev.target.classList.contains('i-etapa')) p.e = ev.target.value;
    else if(ev.target.classList.contains('i-antes')) p.a = ev.target.value;
    else if(ev.target.classList.contains('i-depois')) p.d = ev.target.value;
  };
}

/* publica o processo "depois" como o oficial do setor */
function projPublicar(){
  if(!PJ) return;
  if(!PJ.data.setor){ pjMsgShow('Defina o setor do projeto antes de publicar.'); return; }
  var etapas = PJ.data.processo
    .filter(function(p){ return (p.e || '').trim(); })
    .map(function(p){ return { e: p.e.trim(), resp: (p.d || p.a || '').trim() }; });
  if(!etapas.length){ pjMsgShow('Adicione as etapas do processo antes de publicar.'); return; }
  if(!confirm('Publicar este processo como o oficial do setor ' + PJ.data.setor + '?\nEle substituirá o processo ativo atual e ficará visível para toda a equipe.')) return;
  var btn = document.getElementById('pjPublicar');
  btn.disabled = true;
  db.collection('processos').doc(setorSlug(PJ.data.setor)).set({
    setor: PJ.data.setor,
    etapas: etapas,
    projetoNome: PJ.data.nome || '',
    projetoId: PJ.id || '',
    publicadoPor: ME.nome || ME.email,
    publicadoEm: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){ pjMsgShow('Processo do setor ' + PJ.data.setor + ' publicado ✓'); })
    .catch(function(){ pjMsgShow('Sem permissão para publicar.'); })
    .finally(function(){ btn.disabled = false; });
}

/* =================== página Processos =================== */
var procUnsub = null;
function buildProcessos(){
  if(procUnsub) return;
  procUnsub = db.collection('processos').onSnapshot(function(qs){
    var ativos = {};
    qs.forEach(function(doc){ ativos[doc.id] = doc.data(); });
    renderProcessos(ativos);
  }, function(){
    document.getElementById('procList').innerHTML = '<div class="load-note">Não foi possível carregar os processos.</div>';
  });
}
function renderProcessos(ativos){
  var pend = SETORES.filter(function(s){ return !ativos[setorSlug(s)]; });
  var alertHost = document.getElementById('procAlert');
  alertHost.innerHTML = pend.length
    ? '<div class="proc-pend">' + ic('alerta') + ' <b>' + pend.length + ' setor' + (pend.length > 1 ? 'es' : '') + ' sem processo ativo:</b> ' +
      pend.map(escHtml).join(' · ') + '. A diretoria de cada setor precisa criar e publicar o processo na página Reestruturações.</div>'
    : '';
  document.getElementById('procList').innerHTML = SETORES.map(function(s){
    var d = ativos[setorSlug(s)];
    if(!d){
      return '<div class="proc-card"><header><h4>' + escHtml(s) + '</h4><small>pendente</small></header>' +
        '<ol><li class="vazio"><span style="font-style:italic">Nenhum processo publicado para este setor ainda.</span></li></ol></div>';
    }
    var quando = d.publicadoEm && d.publicadoEm.toDate ? d.publicadoEm.toDate().toLocaleDateString('pt-BR') : '';
    return '<div class="proc-card"><header><h4>' + escHtml(d.setor) + '</h4>' +
      '<small>publicado por ' + escHtml(d.publicadoPor || '—') + (quando ? ' em ' + quando : '') +
      (d.projetoNome ? ' · projeto: ' + escHtml(d.projetoNome) : '') + '</small></header><ol>' +
      d.etapas.map(function(p){
        return '<li><span><b>' + escHtml(p.e) + '</b>' + (p.resp ? '<span>' + escHtml(p.resp) + '</span>' : '') + '</span></li>';
      }).join('') + '</ol></div>';
  }).join('');
}

function renderAtencao(){
  var host = document.getElementById('pjAtencao');
  var arr = PJ.data.atencao;
  host.innerHTML = arr.map(function(t,i){
    return '<div class="at-item" data-i="' + i + '"><textarea class="fin-input" rows="2">' + escHtml(t) + '</textarea>' +
      '<button type="button" class="i-del" title="Remover">×</button></div>';
  }).join('') + '<div class="pp-add"><button type="button" class="mini" data-add="1">+ Adicionar ponto de atenção</button></div>';
  host.onclick = function(ev){
    var b = ev.target.closest('button'); if(!b) return;
    if(b.dataset.add){ arr.push(''); renderAtencao(); }
    else if(b.classList.contains('i-del')){ arr.splice(+b.closest('.at-item').dataset.i, 1); renderAtencao(); }
  };
  host.oninput = function(ev){
    var it = ev.target.closest('.at-item'); if(!it) return;
    arr[+it.dataset.i] = ev.target.value;
  };
}
function recalc(){
  if(!PJ) return;
  var A = projTotals(PJ.data.antes), D = projTotals(PJ.data.depois);
  var eco = A.total - D.total;
  var pct = A.total > 0 ? Math.round(Math.abs(eco) / A.total * 100) : 0;
  var verbo = eco >= 0 ? 'economia' : 'custo adicional';
  document.getElementById('ppTotAntes').textContent = 'R$ ' + fmtBRL(A.total) + '/mês';
  document.getElementById('ppTotDepois').textContent = 'R$ ' + fmtBRL(D.total) + '/mês';
  document.getElementById('pjKpis').innerHTML =
    '<div class="kpi"><div class="v">R$ ' + fmtBRL(Math.abs(eco)) + '</div><div class="k">' + verbo + ' mensal</div></div>' +
    '<div class="kpi"><div class="v">R$ ' + fmtBRL(Math.abs(eco) * 12) + '</div><div class="k">' + verbo + ' anual</div></div>' +
    '<div class="kpi"><div class="v">' + PJ.data.antes.pessoas.length + ' → ' + PJ.data.depois.pessoas.length + '</div><div class="k">pessoas na equipe</div></div>' +
    '<div class="kpi"><div class="v">' + (eco >= 0 ? '−' : '+') + pct + '%</div><div class="k">variação do custo fixo</div></div>';
  var groups = [
    {nome:'Folha da equipe', antes:A.folha, depois:D.folha},
    {nome:'Ferramentas e outros', antes:A.extras, depois:D.extras},
    {nome:'Total fixo mensal', antes:A.total, depois:D.total}
  ];
  var max = groups.reduce(function(m,g){ return Math.max(m, g.antes, g.depois, 1); }, 0);
  document.getElementById('pjChart').innerHTML = groups.map(function(g){
    function bar(v,color,lbl){
      var w = Math.max(v / max * 100, 0.6);
      var inside = w > 76 ? ' inside' : '';
      return '<div class="bar-row"><span class="name">' + lbl + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + w.toFixed(2) + '%;background:' + color + '"></span>' +
        '<span class="bar-val' + inside + '">R$ ' + fmtBRL(v) + '</span></span></div>';
    }
    return '<div class="cost-pair"><p class="pair-h">' + g.nome + '</p>' + bar(g.antes,'var(--dv-blue)','Antes') + bar(g.depois,'var(--dv-teal)','Depois') + '</div>';
  }).join('');
}
function pjMsgShow(t){
  var el = document.getElementById('pjMsg');
  el.textContent = t;
  clearTimeout(el._t);
  el._t = setTimeout(function(){ el.textContent = ''; }, 3500);
}
function projSave(){
  if(!PJ) return;
  if(!PJ.data.nome.trim()){ pjMsgShow('Dê um nome ao projeto antes de salvar.'); document.getElementById('pjNome').focus(); return; }
  var d = PJ.data;
  var doc = {
    nome: d.nome.trim(), setor: (d.setor || '').trim(), contexto: d.contexto || '',
    antes: d.antes, depois: d.depois,
    processo: (d.processo || []).filter(function(p){ return (p.e || '').trim(); }),
    atencao: d.atencao.filter(function(t){ return t.trim(); }),
    legacy: !!d.legacy,
    autor: d.autor || (ME.nome || ME.email), autorEmail: d.autorEmail || ME.email,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  };
  var btn = document.getElementById('pjSalvar');
  btn.disabled = true;
  var op = PJ.id
    ? db.collection('projetos').doc(PJ.id).set(doc, {merge:true})
    : db.collection('projetos').add(Object.assign({criadoEm: firebase.firestore.FieldValue.serverTimestamp()}, doc));
  op.then(function(ref){
    if(!PJ.id && ref){ PJ.id = ref.id; document.getElementById('pjExcluir').hidden = false; }
    pjMsgShow('Projeto salvo ✓');
  }).catch(function(){ pjMsgShow('Sem permissão para salvar.'); })
    .finally(function(){ btn.disabled = false; });
}
function projDelete(){
  if(!PJ || !PJ.id) return;
  if(!confirm('Excluir o projeto "' + PJ.data.nome + '" para todos? Essa ação não pode ser desfeita.')) return;
  db.collection('projetos').doc(PJ.id).delete().then(showHub)
    .catch(function(){ pjMsgShow('Sem permissão para excluir.'); });
}
/* =================== Campanhas =================== */
var CANAIS = ['Spots no ar','Instagram','Site e app','WhatsApp','Eventos presenciais','Parceiros e permutas','Imprensa local'];
var CUSTO_CATS = ['Brindes','Prêmios','Mão de obra','Terceirizados','Mídia / Divulgação','Outros'];
var campUnsub = null, campRows = [], CP = null, campBound = false, CTAB = 'ativas';
var ST_LBL = { rascunho:['EM DISCUSSÃO','st-rascunho'], ativa:['ATIVA','st-ativa'], encerrada:['ENCERRADA','st-encerrada'] };

function campBlank(){
  return { nome:'', status:'rascunho', foco:'', publico:'', inicio:'', fim:'', setorLider:'',
    descricao:'', custos:[], parceiros:[], canais:[], metaTxt:'', medicao:'', retorno:0,
    planoB:'', riscos:'', timing:'', envolvimento:[], fotos:[], relatorio:null,
    autor: ME ? (ME.nome || ME.email) : '', autorEmail: ME ? ME.email : '' };
}
function campCustoTotal(d){ return (d.custos || []).reduce(function(s,c){ return s + (+c.v || 0); }, 0); }
function fmtData(s){ if(!s) return ''; var p = String(s).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; }
function fmtPeriodo(d){
  if(d.inicio && d.fim) return fmtData(d.inicio) + ' a ' + fmtData(d.fim);
  return d.inicio ? 'a partir de ' + fmtData(d.inicio) : 'período a definir';
}
function flashMsg(id, t){
  var el = document.getElementById(id);
  if(!el) return;
  el.textContent = t;
  clearTimeout(el._t);
  el._t = setTimeout(function(){ el.textContent = ''; }, 4000);
}
function cpMsgShow(t){ flashMsg('cpMsg', t); }
function rpMsgShow(t){ flashMsg('rpMsg', t); }
function bsMsgShow(t){ flashMsg('bsMsg', t); }

/* ---- fotos: compressão no navegador, salvas como data URL no Firestore ---- */
function fotoPick(max, done){
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  if(max > 1) input.multiple = true;
  input.addEventListener('change', function(){
    var files = Array.prototype.slice.call(input.files || []).slice(0, max);
    if(!files.length) return;
    Promise.all(files.map(fotoCompress)).then(function(list){
      var ok = list.filter(function(f){ return !!f; });
      if(ok.length < files.length) alert((files.length - ok.length) + ' foto(s) não puderam ser processadas (formato ou tamanho).');
      done(ok);
    });
  });
  input.click();
}
function fotoCompress(file){
  return new Promise(function(resolve){
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function(){
      var MAXW = 900;
      var scale = Math.min(1, MAXW / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      var q = 0.72, data = c.toDataURL('image/jpeg', q);
      while(data.length > 110000 && q > 0.3){ q -= 0.08; data = c.toDataURL('image/jpeg', q); }
      URL.revokeObjectURL(url);
      resolve(data.length <= 130000 ? data : null);
    };
    img.onerror = function(){ URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
function lightbox(src){
  var lb = document.getElementById('lightbox');
  lb.querySelector('img').src = src;
  lb.classList.add('on');
}
document.getElementById('lightbox').addEventListener('click', function(){ this.classList.remove('on'); });
function fotoGridRender(host, arr, editable, max){
  host.innerHTML = arr.map(function(f, i){
    return '<div class="foto-th"><img src="' + f + '" alt="foto ' + (i + 1) + '" data-full="1">' +
      (editable ? '<button type="button" class="f-del" data-i="' + i + '" title="Remover foto">×</button>' : '') + '</div>';
  }).join('') +
  (editable ? (arr.length < max
    ? '<button type="button" class="mini" data-addfoto="1">' + ic('camera') + ' Adicionar foto</button>'
    : '<span class="chart-note" style="margin:0">máximo de ' + max + ' fotos</span>') : '');
  host.onclick = function(ev){
    var img = ev.target.closest('img[data-full]');
    if(img){ lightbox(img.src); return; }
    if(!editable) return;
    var del = ev.target.closest('.f-del');
    if(del){ arr.splice(+del.dataset.i, 1); fotoGridRender(host, arr, editable, max); return; }
    if(ev.target.closest('[data-addfoto]')){
      fotoPick(max - arr.length, function(list){
        list.forEach(function(f){ arr.push(f); });
        fotoGridRender(host, arr, editable, max);
      });
    }
  };
}

/* ---- abas ---- */
function campTab(t){
  if((t === 'criar' || t === 'relatorios') && !canRe()) t = 'ativas';
  CTAB = t;
  ['ativas','criar','relatorios','brainstorm'].forEach(function(x){
    var pane = document.getElementById('ctab-' + x);
    if(pane) pane.hidden = x !== t;
    document.querySelectorAll('.camp-tabs [data-ctab="' + x + '"]').forEach(function(b){
      b.classList.toggle('on', x === t);
    });
  });
}

function campInit(){
  if(!campBound){
    campBound = true;
    document.querySelectorAll('.camp-tabs button').forEach(function(b){
      b.addEventListener('click', function(){ campTab(b.dataset.ctab); });
    });
    document.getElementById('campNew').addEventListener('click', function(){ campOpen(null, campBlank()); });
    document.getElementById('campBack').addEventListener('click', campShowHub);
    document.getElementById('cpSalvar').addEventListener('click', function(){ campSave(false); });
    document.getElementById('cpStatusBtn').addEventListener('click', campToggleStatus);
    document.getElementById('cpExcluir').addEventListener('click', campDelete);
    document.getElementById('repBack').addEventListener('click', function(){
      RP = null;
      document.getElementById('repEditor').hidden = true;
      document.getElementById('repHub').hidden = false;
      window.scrollTo(0,0);
    });
    document.getElementById('rpSalvar').addEventListener('click', repSave);
    var sel = document.getElementById('cpSetorLider');
    sel.innerHTML = '<option value="">Setor…</option>' + SETORES.map(function(s){
      return '<option value="' + escHtml(s) + '">' + escHtml(s) + '</option>';
    }).join('');
    sel.addEventListener('change', function(){ if(CP) CP.data.setorLider = this.value; });
    [['cpNome','nome'],['cpFoco','foco'],['cpPublico','publico'],['cpInicio','inicio'],['cpFim','fim'],
     ['cpDescricao','descricao'],['cpMetaTxt','metaTxt'],['cpMedicao','medicao'],
     ['cpPlanoB','planoB'],['cpRiscos','riscos'],['cpTiming','timing']].forEach(function(par){
      document.getElementById(par[0]).addEventListener('input', function(){
        if(CP) CP.data[par[1]] = this.value;
      });
    });
    document.getElementById('cpRetorno').addEventListener('input', function(){
      if(CP){ CP.data.retorno = parseFloat(this.value) || 0; cpRecalc(); }
    });
    var ch = document.getElementById('cpCanais');
    ch.innerHTML = CANAIS.map(function(c){
      return '<label><input type="checkbox" value="' + escHtml(c) + '"> ' + escHtml(c) + '</label>';
    }).join('');
    ch.addEventListener('change', function(){
      if(!CP) return;
      CP.data.canais = Array.prototype.slice.call(ch.querySelectorAll('input:checked')).map(function(i){ return i.value; });
    });
  }
  campListen();
  bsInit();
  campTab(CTAB);
}
function campListen(){
  if(campUnsub) return;
  campUnsub = db.collection('campanhas').orderBy('atualizadoEm','desc').onSnapshot(function(qs){
    campRows = [];
    qs.forEach(function(doc){ campRows.push({ id: doc.id, d: doc.data() }); });
    renderCampAtivas();
    renderCampHub();
    renderRepHub();
    renderHomeCamps();
  }, function(){
    document.getElementById('campAtivasList').innerHTML =
      '<div class="proj-empty">Não foi possível carregar as campanhas. As regras da coleção <b>campanhas</b> foram publicadas?</div>';
    document.getElementById('campAtivasAlert').innerHTML = '';
    document.getElementById('campList').innerHTML = '';
    document.getElementById('repList').innerHTML = '';
    document.getElementById('homeCamps').innerHTML = '<p class="hc-empty">Não foi possível carregar as campanhas.</p>';
  });
}

/* ---- aba Campanhas ativas ---- */
function renderCampAtivas(){
  var host = document.getElementById('campAtivasList');
  var ativas = campRows.filter(function(r){ return r.d.status === 'ativa'; });
  document.getElementById('campAtivasAlert').innerHTML = ativas.length ? '' :
    '<div class="proc-pend">' + ic('megafone') + ' <b>Nenhuma campanha ativa no momento.</b> ' +
    (canRe() ? 'Crie e ative uma campanha na aba “Criar campanha”.' : 'A diretoria ainda não ativou nenhuma campanha.') + '</div>';
  host.innerHTML = ativas.map(campCard).join('');
  host.onclick = function(ev){
    var img = ev.target.closest('img[data-full]');
    if(img) lightbox(img.src);
  };
}
function campCard(r){
  var d = r.d;
  var tot = campCustoTotal(d);
  var canaisHtml = (d.canais || []).map(function(c){ return '<span class="canal-pill">' + escHtml(c) + '</span>'; }).join('');
  var env = (d.envolvimento || []).map(function(e){
    return '<li><b>' + escHtml(e.setor) + '</b><span>' + escHtml(e.tarefa) + '</span></li>';
  }).join('');
  var fotos = (d.fotos || []).map(function(f, i){
    return '<div class="foto-th"><img src="' + f + '" alt="foto ' + (i + 1) + '" data-full="1"></div>';
  }).join('');
  return '<div class="camp-card"><header><h4>' + escHtml(d.nome || '(sem nome)') + '</h4>' +
    '<small>' + escHtml(fmtPeriodo(d)) + (d.setorLider ? ' · liderada por ' + escHtml(d.setorLider) : '') + '</small></header>' +
    '<div class="camp-body">' +
    (d.foco ? '<p style="margin:.2rem 0 .6rem"><b>Foco:</b> ' + escHtml(d.foco) + '</p>' : '') +
    (d.descricao ? '<p style="margin:0 0 .8rem;white-space:pre-wrap">' + escHtml(d.descricao) + '</p>' : '') +
    '<div class="camp-facts">' +
      '<span><b>Investimento previsto:</b> R$ ' + fmtBRL(tot) + '</span>' +
      (+d.retorno ? '<span><b>Retorno esperado:</b> R$ ' + fmtBRL(+d.retorno) + '</span>' : '') +
      (d.metaTxt ? '<span><b>Meta:</b> ' + escHtml(d.metaTxt) + '</span>' : '') +
      (d.publico ? '<span><b>Público:</b> ' + escHtml(d.publico) + '</span>' : '') +
    '</div>' +
    (canaisHtml ? '<div>' + canaisHtml + '</div>' : '') +
    (env ? '<h4 style="margin:1rem 0 .1rem">O que cada setor faz</h4><ul class="camp-set">' + env + '</ul>' : '') +
    (fotos ? '<div class="foto-grid">' + fotos + '</div>' : '') +
    '</div></div>';
}

/* ---- aba Criar campanha: hub ---- */
function renderCampHub(){
  var host = document.getElementById('campList');
  if(!campRows.length){
    host.innerHTML = '<div class="proj-empty">Nenhuma campanha ainda. Clique em <b>+ Nova campanha</b> para começar.</div>';
    return;
  }
  host.innerHTML = campRows.map(function(r){
    var d = r.d, st = ST_LBL[d.status] || ST_LBL.rascunho;
    var quando = d.atualizadoEm && d.atualizadoEm.toDate ? d.atualizadoEm.toDate().toLocaleDateString('pt-BR') : '';
    return '<button type="button" class="proj-row" data-id="' + r.id + '">' +
      '<span class="pr-main"><span class="pr-nome">' + escHtml(d.nome || '(sem nome)') +
      ' <span class="st-pill ' + st[1] + '">' + st[0] + '</span></span>' +
      '<span class="pr-sub">' + escHtml(d.setorLider || 'setor líder não definido') + ' · por ' + escHtml(d.autor || '—') +
      (quando ? ' · atualizada em ' + quando : '') + '</span></span>' +
      '<span class="pr-eco" style="color:var(--teal-900)">R$ ' + fmtBRL(campCustoTotal(d)) + '</span></button>';
  }).join('');
  host.querySelectorAll('.proj-row').forEach(function(btn){
    btn.addEventListener('click', function(){
      var row = null;
      campRows.forEach(function(r){ if(r.id === btn.dataset.id) row = r; });
      if(row) campOpen(row.id, row.d);
    });
  });
}
function campShowHub(){
  CP = null;
  document.getElementById('campEditor').hidden = true;
  document.getElementById('campHub').hidden = false;
  window.scrollTo(0,0);
}

/* ---- editor de campanha ---- */
function campOpen(id, data){
  CP = { id: id, data: JSON.parse(JSON.stringify(data)) };
  ['custos','parceiros','canais','envolvimento','fotos'].forEach(function(k){
    if(!Array.isArray(CP.data[k])) CP.data[k] = [];
  });
  document.getElementById('campHub').hidden = true;
  document.getElementById('campEditor').hidden = false;
  document.getElementById('cpNome').value = CP.data.nome || '';
  document.getElementById('cpSetorLider').value = CP.data.setorLider || '';
  document.getElementById('cpInicio').value = CP.data.inicio || '';
  document.getElementById('cpFim').value = CP.data.fim || '';
  document.getElementById('cpPublico').value = CP.data.publico || '';
  document.getElementById('cpFoco').value = CP.data.foco || '';
  document.getElementById('cpDescricao').value = CP.data.descricao || '';
  document.getElementById('cpMetaTxt').value = CP.data.metaTxt || '';
  document.getElementById('cpMedicao').value = CP.data.medicao || '';
  document.getElementById('cpRetorno').value = CP.data.retorno || '';
  document.getElementById('cpPlanoB').value = CP.data.planoB || '';
  document.getElementById('cpRiscos').value = CP.data.riscos || '';
  document.getElementById('cpTiming').value = CP.data.timing || '';
  var canais = CP.data.canais;
  document.querySelectorAll('#cpCanais input').forEach(function(i){ i.checked = canais.indexOf(i.value) > -1; });
  document.getElementById('cpInfo').textContent = id ? 'Criada por ' + (CP.data.autor || '—') : 'Campanha nova — ainda não salva.';
  cpRenderCustos();
  cpRenderParceiros();
  cpRenderEnv();
  fotoGridRender(document.getElementById('cpFotos'), CP.data.fotos, true, 3);
  cpRecalc();
  cpStatusUI();
  window.scrollTo(0,0);
}
function cpStatusUI(){
  if(!CP) return;
  var st = CP.data.status || 'rascunho';
  var lbl = ST_LBL[st] || ST_LBL.rascunho;
  var pill = document.getElementById('cpStatusPill');
  pill.textContent = lbl[0];
  pill.className = 'st-pill ' + lbl[1];
  document.getElementById('cpStatusBtn').innerHTML =
    st === 'ativa' ? 'Encerrar campanha' : (st === 'encerrada' ? 'Reativar campanha' : ic('raio') + ' Ativar campanha');
  document.getElementById('cpExcluir').hidden = !CP.id;
}
function cpRenderCustos(){
  var host = document.getElementById('cpCustos');
  var arr = CP.data.custos;
  host.innerHTML = arr.map(function(c, i){
    var opts = CUSTO_CATS.map(function(x){
      return '<option value="' + escHtml(x) + '"' + (c.cat === x ? ' selected' : '') + '>' + escHtml(x) + '</option>';
    }).join('');
    return '<div class="custo-row" data-i="' + i + '">' +
      '<select class="fin-input i-cat">' + opts + '</select>' +
      '<input class="fin-input i-nome" value="' + escHtml(c.n || '') + '" placeholder="descrição (ex.: 200 canecas personalizadas)">' +
      '<input class="fin-input i-valor" type="number" min="0" step="0.01" value="' + (c.v || '') + '" placeholder="R$">' +
      '<button type="button" class="i-del" title="Remover">×</button></div>';
  }).join('') + '<div class="pp-add"><button type="button" class="mini" data-add="1">+ Adicionar custo</button></div>';
  host.onclick = function(ev){
    var b = ev.target.closest('button'); if(!b) return;
    if(b.dataset.add){ arr.push({ cat: CUSTO_CATS[0], n: '', v: 0 }); cpRenderCustos(); cpRecalc(); }
    else if(b.classList.contains('i-del')){ arr.splice(+b.closest('.custo-row').dataset.i, 1); cpRenderCustos(); cpRecalc(); }
  };
  host.oninput = function(ev){
    var row = ev.target.closest('.custo-row'); if(!row) return;
    var c = arr[+row.dataset.i];
    if(ev.target.classList.contains('i-nome')) c.n = ev.target.value;
    else if(ev.target.classList.contains('i-valor')){ c.v = parseFloat(ev.target.value) || 0; cpRecalc(); }
  };
  host.onchange = function(ev){
    var row = ev.target.closest('.custo-row'); if(!row) return;
    if(ev.target.classList.contains('i-cat')) arr[+row.dataset.i].cat = ev.target.value;
  };
}
function cpRenderParceiros(){
  var host = document.getElementById('cpParceiros');
  var arr = CP.data.parceiros;
  host.innerHTML = arr.map(function(p, i){
    return '<div class="parc-row" data-i="' + i + '">' +
      '<input class="fin-input i-nome" value="' + escHtml(p.n || '') + '" placeholder="parceiro">' +
      '<input class="fin-input i-oferece" value="' + escHtml(p.oferece || '') + '" placeholder="o que oferece">' +
      '<input class="fin-input i-contra" value="' + escHtml(p.contrapartida || '') + '" placeholder="contrapartida (o que pede)">' +
      '<button type="button" class="i-del" title="Remover">×</button></div>';
  }).join('') + '<div class="pp-add"><button type="button" class="mini" data-add="1">+ Adicionar parceiro</button></div>';
  host.onclick = function(ev){
    var b = ev.target.closest('button'); if(!b) return;
    if(b.dataset.add){ arr.push({ n: '', oferece: '', contrapartida: '' }); cpRenderParceiros(); cpRecalc(); }
    else if(b.classList.contains('i-del')){ arr.splice(+b.closest('.parc-row').dataset.i, 1); cpRenderParceiros(); cpRecalc(); }
  };
  host.oninput = function(ev){
    var row = ev.target.closest('.parc-row'); if(!row) return;
    var p = arr[+row.dataset.i];
    if(ev.target.classList.contains('i-nome')){ p.n = ev.target.value; cpRecalc(); }
    else if(ev.target.classList.contains('i-oferece')) p.oferece = ev.target.value;
    else if(ev.target.classList.contains('i-contra')) p.contrapartida = ev.target.value;
  };
}
function cpRenderEnv(){
  var host = document.getElementById('cpEnv');
  host.innerHTML = SETORES.map(function(s){
    var tarefa = '';
    CP.data.envolvimento.forEach(function(x){ if(x.setor === s) tarefa = x.tarefa || ''; });
    return '<div class="env-row"><b>' + escHtml(s) + '</b>' +
      '<textarea class="fin-input" rows="2" data-setor="' + escHtml(s) + '" placeholder="O que o setor precisa fazer nesta campanha? (em branco = não participa)">' +
      escHtml(tarefa) + '</textarea></div>';
  }).join('');
  host.oninput = function(ev){
    var t = ev.target.closest('textarea[data-setor]'); if(!t || !CP) return;
    var arr = CP.data.envolvimento, found = null;
    arr.forEach(function(x){ if(x.setor === t.dataset.setor) found = x; });
    if(!found){ found = { setor: t.dataset.setor, tarefa: '' }; arr.push(found); }
    found.tarefa = t.value;
  };
}
function cpRecalc(){
  if(!CP) return;
  var tot = campCustoTotal(CP.data);
  var ret = +CP.data.retorno || 0;
  var saldo = ret - tot;
  var nParc = CP.data.parceiros.filter(function(p){ return (p.n || '').trim(); }).length;
  document.getElementById('cpKpis').innerHTML =
    '<div class="kpi"><div class="v">R$ ' + fmtBRL(tot) + '</div><div class="k">investimento previsto</div></div>' +
    '<div class="kpi"><div class="v">R$ ' + fmtBRL(ret) + '</div><div class="k">retorno esperado</div></div>' +
    '<div class="kpi"><div class="v">' + (saldo >= 0 ? '+' : '−') + ' R$ ' + fmtBRL(Math.abs(saldo)) + '</div><div class="k">saldo estimado</div></div>' +
    '<div class="kpi"><div class="v">' + nParc + '</div><div class="k">parceiro' + (nParc === 1 ? '' : 's') + ' envolvido' + (nParc === 1 ? '' : 's') + '</div></div>';
  document.getElementById('cpCustoTotal').textContent = tot ? '· total R$ ' + fmtBRL(tot) + '/campanha' : '';
}
function campToggleStatus(){
  if(!CP) return;
  var st = CP.data.status || 'rascunho';
  if(st === 'ativa'){
    if(!confirm('Encerrar a campanha "' + CP.data.nome + '"?\nDepois preencha o relatório na aba Relatórios para medir o resultado.')) return;
    CP.data.status = 'encerrada';
  }else{
    if(!CP.data.nome.trim()){ cpMsgShow('Dê um nome à campanha antes de ativar.'); return; }
    if(!(CP.data.foco || '').trim()){ cpMsgShow('Defina o foco da campanha antes de ativar.'); return; }
    if(!confirm('Ativar a campanha "' + CP.data.nome + '"?\nEla aparece em “Campanhas ativas” para toda a equipe, com as tarefas de cada setor.')) return;
    CP.data.status = 'ativa';
  }
  cpStatusUI();
  campSave(true);
}
function campSave(auto){
  if(!CP) return;
  if(!CP.data.nome.trim()){ cpMsgShow('Dê um nome à campanha antes de salvar.'); document.getElementById('cpNome').focus(); return; }
  var d = CP.data;
  var doc = {
    nome: d.nome.trim(), status: d.status || 'rascunho',
    foco: d.foco || '', publico: d.publico || '', inicio: d.inicio || '', fim: d.fim || '',
    setorLider: d.setorLider || '', descricao: d.descricao || '',
    custos: d.custos.filter(function(c){ return (c.n || '').trim() || +c.v; }),
    parceiros: d.parceiros.filter(function(p){ return (p.n || '').trim(); }),
    canais: d.canais || [],
    metaTxt: d.metaTxt || '', medicao: d.medicao || '', retorno: +d.retorno || 0,
    planoB: d.planoB || '', riscos: d.riscos || '', timing: d.timing || '',
    envolvimento: d.envolvimento.filter(function(e){ return (e.tarefa || '').trim(); }),
    fotos: d.fotos || [],
    autor: d.autor || (ME.nome || ME.email), autorEmail: d.autorEmail || ME.email,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  };
  var btn = document.getElementById('cpSalvar');
  btn.disabled = true;
  var op = CP.id
    ? db.collection('campanhas').doc(CP.id).set(doc, { merge: true })
    : db.collection('campanhas').add(Object.assign({ criadoEm: firebase.firestore.FieldValue.serverTimestamp(), relatorio: null }, doc));
  op.then(function(ref){
    if(!CP.id && ref) CP.id = ref.id;
    cpStatusUI();
    cpMsgShow(auto ? 'Status atualizado ✓' : 'Campanha salva ✓');
  }).catch(function(){ cpMsgShow('Sem permissão para salvar.'); })
    .finally(function(){ btn.disabled = false; });
}
function campDelete(){
  if(!CP || !CP.id) return;
  if(!confirm('Excluir a campanha "' + CP.data.nome + '" para todos? Essa ação não pode ser desfeita.')) return;
  db.collection('campanhas').doc(CP.id).delete().then(campShowHub)
    .catch(function(){ cpMsgShow('Sem permissão para excluir.'); });
}

/* ---- aba Relatórios ---- */
var RP = null;
function renderRepHub(){
  var host = document.getElementById('repList');
  var rows = campRows.filter(function(r){ return r.d.status === 'ativa' || r.d.status === 'encerrada'; });
  if(!rows.length){
    host.innerHTML = '<div class="proj-empty">Nenhuma campanha ativa ou encerrada ainda. O relatório é preenchido ao final de cada campanha.</div>';
    return;
  }
  host.innerHTML = rows.map(function(r){
    var d = r.d;
    var tag = d.relatorio ? '<span class="st-pill st-ativa">relatório preenchido ✓</span>'
      : (d.status === 'encerrada' ? '<span class="st-pill st-rascunho">relatório pendente</span>'
      : '<span class="st-pill st-encerrada">em andamento</span>');
    return '<button type="button" class="proj-row" data-id="' + r.id + '">' +
      '<span class="pr-main"><span class="pr-nome">' + escHtml(d.nome || '(sem nome)') + '</span>' +
      '<span class="pr-sub">' + escHtml(fmtPeriodo(d)) + ' · investimento previsto R$ ' + fmtBRL(campCustoTotal(d)) + '</span></span>' +
      tag + '</button>';
  }).join('');
  host.querySelectorAll('.proj-row').forEach(function(btn){
    btn.addEventListener('click', function(){ repOpen(btn.dataset.id); });
  });
}
function repOpen(id){
  var row = null;
  campRows.forEach(function(r){ if(r.id === id) row = r; });
  if(!row) return;
  RP = { id: id, camp: row.d, fotos: [] };
  var d = row.d, rel = d.relatorio || {};
  RP.fotos = (rel.fotos || []).slice();
  document.getElementById('repHub').hidden = true;
  document.getElementById('repEditor').hidden = false;
  document.getElementById('repTitle').textContent = 'Relatório — ' + (d.nome || '');
  var tot = campCustoTotal(d);
  document.getElementById('repPrev').innerHTML =
    '<div class="camp-facts" style="margin:.4rem 0 1.2rem">' +
    '<span><b>Previsto:</b> investimento R$ ' + fmtBRL(tot) +
    (+d.retorno ? ' · retorno esperado R$ ' + fmtBRL(+d.retorno) : '') + '</span>' +
    (d.metaTxt ? '<span><b>Meta:</b> ' + escHtml(d.metaTxt) + '</span>' : '') +
    (d.medicao ? '<span><b>Medição combinada:</b> ' + escHtml(d.medicao) + '</span>' : '') + '</div>';
  document.getElementById('rpCusto').value = rel.custoReal || '';
  document.getElementById('rpReceita').value = rel.receita || '';
  document.getElementById('rpNota').value = (rel.nota || rel.nota === 0) ? rel.nota : '';
  document.getElementById('rpResultado').value = rel.resultado || '';
  document.getElementById('rpAlcance').value = rel.alcance || '';
  document.getElementById('rpFuncionou').value = rel.funcionou || '';
  document.getElementById('rpMelhorar').value = rel.melhorar || '';
  fotoGridRender(document.getElementById('rpFotos'), RP.fotos, true, 3);
  var imp = {};
  (rel.impactos || []).forEach(function(x){ imp[x.setor] = x.texto; });
  var envolvidos = {};
  (d.envolvimento || []).forEach(function(e){ envolvidos[e.setor] = true; });
  document.getElementById('rpImpactos').innerHTML = SETORES.map(function(s){
    return '<div class="env-row"><b>' + escHtml(s) + (envolvidos[s] ? ' ★' : '') + '</b>' +
      '<textarea class="fin-input" rows="2" data-setor="' + escHtml(s) + '" placeholder="Qual foi o impacto no setor? (em branco = sem impacto)">' +
      escHtml(imp[s] || '') + '</textarea></div>';
  }).join('');
  window.scrollTo(0,0);
}
function repSave(){
  if(!RP) return;
  var impactos = [];
  document.querySelectorAll('#rpImpactos textarea[data-setor]').forEach(function(t){
    if(t.value.trim()) impactos.push({ setor: t.dataset.setor, texto: t.value.trim() });
  });
  var rel = {
    custoReal: parseFloat(document.getElementById('rpCusto').value) || 0,
    receita: parseFloat(document.getElementById('rpReceita').value) || 0,
    nota: parseFloat(document.getElementById('rpNota').value) || 0,
    resultado: document.getElementById('rpResultado').value.trim(),
    alcance: document.getElementById('rpAlcance').value.trim(),
    funcionou: document.getElementById('rpFuncionou').value.trim(),
    melhorar: document.getElementById('rpMelhorar').value.trim(),
    impactos: impactos,
    fotos: RP.fotos,
    preenchidoPor: ME.nome || ME.email,
    preenchidoEm: firebase.firestore.FieldValue.serverTimestamp()
  };
  var btn = document.getElementById('rpSalvar');
  btn.disabled = true;
  db.collection('campanhas').doc(RP.id).set({
    relatorio: rel, status: 'encerrada',
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).then(function(){
    rpMsgShow('Relatório salvo ✓ — campanha encerrada.');
  }).catch(function(){ rpMsgShow('Sem permissão para salvar.'); })
    .finally(function(){ btn.disabled = false; });
}

/* ---- aba Brainstorm ---- */
var bsUnsub = null, bsBound = false, BS_FOTOS = [], BS_ROWS = [];
function bsInit(){
  if(!bsBound){
    bsBound = true;
    fotoGridRender(document.getElementById('bsFotos'), BS_FOTOS, true, 3);
    document.getElementById('bsEnviar').addEventListener('click', bsPublicar);
  }
  bsListen();
}
function bsListen(){
  if(bsUnsub) return;
  bsUnsub = db.collection('brainstorm').orderBy('criadoEm','desc').onSnapshot(function(qs){
    BS_ROWS = [];
    qs.forEach(function(doc){ BS_ROWS.push({ id: doc.id, d: doc.data() }); });
    bsRender(BS_ROWS);
    renderHomeBs();
  }, function(){
    document.getElementById('bsFeed').innerHTML =
      '<div class="proj-empty">Não foi possível carregar as ideias. As regras da coleção <b>brainstorm</b> foram publicadas?</div>';
    document.getElementById('homeBs').innerHTML = '<p class="hc-empty">Não foi possível carregar as ideias.</p>';
  });
}
function bsPublicar(){
  var ti = document.getElementById('bsTitulo').value.trim();
  var tx = document.getElementById('bsTexto').value.trim();
  if(!ti || !tx){ bsMsgShow('Dê um título e conte a ideia antes de publicar.'); return; }
  var btn = document.getElementById('bsEnviar');
  btn.disabled = true;
  db.collection('brainstorm').add({
    titulo: ti, texto: tx, fotos: BS_FOTOS.slice(),
    autor: ME.nome || ME.email, autorEmail: ME.email, setor: ME.setor || '',
    apoios: [],
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){
    document.getElementById('bsTitulo').value = '';
    document.getElementById('bsTexto').value = '';
    BS_FOTOS.length = 0;
    fotoGridRender(document.getElementById('bsFotos'), BS_FOTOS, true, 3);
    bsMsgShow('Ideia publicada ✓');
  }).catch(function(){ bsMsgShow('Sem permissão para publicar.'); })
    .finally(function(){ btn.disabled = false; });
}
function bsRender(rows){
  var host = document.getElementById('bsFeed');
  if(!rows.length){
    host.innerHTML = '<div class="proj-empty">Nenhuma ideia ainda — seja a primeira pessoa a publicar!</div>';
    return;
  }
  host.innerHTML = rows.map(function(r){
    var d = r.d;
    var quando = d.criadoEm && d.criadoEm.toDate ? d.criadoEm.toDate().toLocaleDateString('pt-BR') : '';
    var apoios = d.apoios || [];
    var eu = ME && apoios.indexOf(ME.uid) > -1;
    var dono = ME && (d.autorEmail === ME.email || isAdmin());
    var fotos = (d.fotos || []).map(function(f){
      return '<div class="foto-th"><img src="' + f + '" alt="foto da ideia" data-full="1"></div>';
    }).join('');
    return '<div class="bs-card" data-id="' + r.id + '">' +
      '<div class="bs-head"><h4>' + escHtml(d.titulo || '') + '</h4>' +
      '<small>' + escHtml(d.autor || '—') + (d.setor ? ' · ' + escHtml(d.setor) : '') + (quando ? ' · ' + quando : '') + '</small></div>' +
      '<p class="tx">' + escHtml(d.texto || '') + '</p>' +
      (fotos ? '<div class="foto-grid">' + fotos + '</div>' : '') +
      '<div class="bs-foot">' +
      '<button type="button" class="bs-apoiar' + (eu ? ' on' : '') + '" data-apoiar="1">' + ic('joinha') + ' Apoiar' + (apoios.length ? ' · ' + apoios.length : '') + '</button>' +
      (dono ? '<button type="button" class="mini del" data-delidea="1">Excluir</button>' : '') +
      '</div></div>';
  }).join('');
  host.onclick = function(ev){
    var img = ev.target.closest('img[data-full]');
    if(img){ lightbox(img.src); return; }
    var card = ev.target.closest('.bs-card'); if(!card) return;
    var id = card.dataset.id;
    var apoiar = ev.target.closest('[data-apoiar]');
    if(apoiar){
      var op = apoiar.classList.contains('on')
        ? firebase.firestore.FieldValue.arrayRemove(ME.uid)
        : firebase.firestore.FieldValue.arrayUnion(ME.uid);
      db.collection('brainstorm').doc(id).update({ apoios: op });
    }else if(ev.target.closest('[data-delidea]')){
      if(confirm('Excluir esta ideia para todos?')) db.collection('brainstorm').doc(id).delete();
    }
  };
}

/* =================== Início: painel do dia =================== */
var FRASES = [
  'Toda grande rádio começa com uma equipe que acredita no que faz. Bora fazer bem feito hoje.',
  'Quem faz bem, faz bonito. Faz bem ouvir — e faz bem fazer.',
  'Consistência vence talento quando o talento não aparece todo dia.',
  'O ouvinte percebe quando a gente faz com carinho. Capricha no detalhe.',
  'Ideia boa é a que sai do papel. Qual você tira do papel hoje?',
  'A energia que a gente coloca no ar volta em audiência.',
  'Pequenos progressos diários viram resultados gigantes no fim do mês.',
  'Hoje é um ótimo dia para surpreender o ouvinte.',
  'Rádio boa se faz com escuta: do ouvinte, do colega e do mercado.',
  'Feito com excelência hoje é case de sucesso amanhã.',
  'Cada programa é uma chance nova de conquistar alguém.',
  'Bem-estar começa aqui dentro: cuida de você, cuida do time.',
  'Criatividade é músculo — treina um pouco todo dia.',
  'O padrão que toleramos é o padrão que entregamos. Sobe a régua.',
  'Uma boa manhã no ar muda o dia de milhares de pessoas.',
  'Time alinhado toca junto — como uma boa playlist.',
  'Antes de postar, pergunta: isso inspira alguém?',
  'Resultado é consequência de processo bem feito.',
  'Sorriso também se ouve no rádio.',
  'Grandes marcas se constroem um dia de cada vez — hoje é um deles.',
  'A melhor propaganda da Inspira é o jeito como a gente trabalha.'
];
var homeBound = false, dstUnsub = null, DST = null;

function homeInit(){
  if(!homeBound){
    homeBound = true;
    document.getElementById('dstEditBtn').addEventListener('click', dstEdit);
    document.getElementById('dstCancelar').addEventListener('click', function(){
      document.getElementById('dstForm').hidden = true;
    });
    document.getElementById('dstSalvar').addEventListener('click', dstSave);
  }
  var now = new Date();
  var h = now.getHours();
  var sauda = h < 12 ? 'Bom dia' : (h < 18 ? 'Boa tarde' : 'Boa noite');
  var nome = ME && ME.nome ? ME.nome.trim().split(/\s+/)[0] : '';
  document.getElementById('saudacao').textContent = sauda + (nome ? ', ' + nome : '');
  var dstr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('hojeData').textContent = dstr.charAt(0).toUpperCase() + dstr.slice(1);
  var doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
  document.getElementById('fraseDia').textContent = FRASES[doy % FRASES.length];
  campListen();
  bsListen();
  if(!dstUnsub){
    dstUnsub = db.collection('destaques').doc('semana').onSnapshot(function(snap){
      DST = snap.exists ? snap.data() : null;
      renderDestaques(false);
    }, function(){
      DST = null;
      renderDestaques(true);
    });
  }
}
function dstList(id, arr, vazio){
  document.getElementById(id).innerHTML = (arr && arr.length)
    ? arr.map(function(t){ return '<li>' + escHtml(t) + '</li>'; }).join('')
    : '<li class="hc-empty">' + vazio + '</li>';
}
function renderDestaques(erro){
  var d = DST || {};
  dstList('homeEventos', d.eventos, erro
    ? 'Sem acesso aos destaques — as regras da coleção <b>destaques</b> foram publicadas?'
    : 'Nenhum evento cadastrado para esta semana.');
  dstList('homeAssuntos', d.assuntos, 'Nenhum assunto em destaque — a diretoria atualiza aqui as pautas da semana.');
  dstList('homeMusBR', d.musBR, 'Lista ainda não preenchida.');
  dstList('homeMusINT', d.musINT, 'Lista ainda não preenchida.');
}
function dstEdit(){
  var d = DST || {};
  document.getElementById('dstEventos').value = (d.eventos || []).join('\n');
  document.getElementById('dstAssuntos').value = (d.assuntos || []).join('\n');
  document.getElementById('dstMusBR').value = (d.musBR || []).join('\n');
  document.getElementById('dstMusINT').value = (d.musINT || []).join('\n');
  var f = document.getElementById('dstForm');
  f.hidden = false;
  f.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}
function dstLines(id){
  return document.getElementById(id).value.split('\n').map(function(s){ return s.trim(); }).filter(Boolean);
}
function dstSave(){
  var btn = document.getElementById('dstSalvar');
  btn.disabled = true;
  db.collection('destaques').doc('semana').set({
    eventos: dstLines('dstEventos'),
    assuntos: dstLines('dstAssuntos'),
    musBR: dstLines('dstMusBR'),
    musINT: dstLines('dstMusINT'),
    atualizadoPor: ME.nome || ME.email,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){
    document.getElementById('dstForm').hidden = true;
  }).catch(function(){
    flashMsg('dstMsg', 'Sem permissão para salvar — só a diretoria edita os destaques.');
  }).finally(function(){ btn.disabled = false; });
}
function renderHomeCamps(){
  var host = document.getElementById('homeCamps');
  if(!host) return;
  var ativas = campRows.filter(function(r){ return r.d.status === 'ativa'; });
  if(!ativas.length){
    host.innerHTML = '<p class="hc-empty">Nenhuma campanha ativa no momento.' +
      (canRe() ? ' Que tal ativar uma na página Campanhas?' : '') + '</p>';
    return;
  }
  host.innerHTML = ativas.map(function(r){
    var d = r.d;
    return '<a class="hc-camp" href="#campanhas"><b>' + escHtml(d.nome || '') + '</b>' +
      '<small>' + escHtml(fmtPeriodo(d)) + (d.setorLider ? ' · ' + escHtml(d.setorLider) : '') + '</small>' +
      (d.foco ? '<small>' + ic('alvo') + ' ' + escHtml(d.foco) + '</small>' : '') + '</a>';
  }).join('');
}
function renderHomeBs(){
  var host = document.getElementById('homeBs');
  if(!host) return;
  if(!BS_ROWS.length){
    host.innerHTML = '<p class="hc-empty">Nenhuma ideia ainda — inaugure o mural!</p>';
    return;
  }
  host.innerHTML = BS_ROWS.slice(0, 3).map(function(r){
    var d = r.d;
    var n = (d.apoios || []).length;
    return '<div class="hc-bs"><span><b>' + escHtml(d.titulo || '') + '</b> <small style="color:var(--muted)">· ' +
      escHtml(d.autor || '') + '</small></span><span style="white-space:nowrap">' + ic('joinha') + ' ' + n + '</span></div>';
  }).join('');
}
/* atalhos que abrem direto a aba Brainstorm */
document.addEventListener('click', function(ev){
  if(ev.target.closest('[data-gobs]')) CTAB = 'brainstorm';
});

/* =================== Análise Dial (pesquisas de audiência) =================== */
var dialUnsub = null, dialBound = false, DIAL = null;
function dialInit(){
  if(!dialBound){
    dialBound = true;
    document.getElementById('dlEditBtn').addEventListener('click', dlEdit);
    document.getElementById('dlCancelar').addEventListener('click', function(){
      document.getElementById('dlForm').hidden = true;
    });
    document.getElementById('dlSalvar').addEventListener('click', dlSave);
  }
  if(dialUnsub) return;
  dialUnsub = db.collection('analises').doc('dial').onSnapshot(function(snap){
    DIAL = snap.exists ? snap.data() : null;
    renderDial(false);
  }, function(){
    DIAL = null;
    renderDial(true);
  });
}
function renderDial(erro){
  var rows = (DIAL && DIAL.rows) || [];
  var k = document.getElementById('dlKpis');
  var t = document.getElementById('dlTable');
  if(!rows.length){
    k.innerHTML = '';
    t.innerHTML = '<div class="proj-empty">' + (erro
      ? 'Sem acesso às pesquisas — as regras da coleção <b>analises</b> foram publicadas?'
      : 'Nenhuma pesquisa cadastrada ainda.' + (canRe() ? ' Clique em <b>Editar pesquisas</b> para lançar a primeira rodada.' : ' A diretoria lança os números a cada rodada.')) + '</div>';
    return;
  }
  var u = rows[rows.length - 1];
  k.innerHTML =
    '<div class="kpi"><div class="v">' + (u.pos ? escHtml(u.pos) + 'º' : '—') + '</div><div class="k">posição no ranking</div></div>' +
    '<div class="kpi"><div class="v">' + escHtml(u.aud || '—') + '</div><div class="k">audiência</div></div>' +
    '<div class="kpi"><div class="v">' + escHtml(u.sh || '—') + '</div><div class="k">share</div></div>' +
    '<div class="kpi"><div class="v" style="font-size:1.15rem">' + escHtml(u.p || '—') + '</div><div class="k">última pesquisa' + (u.i ? ' · ' + escHtml(u.i) : '') + '</div></div>';
  var body = rows.slice().reverse().map(function(r, idx){
    return '<tr' + (idx === 0 ? ' class="hl-inspira"' : '') + '><td><b>' + escHtml(r.p || '') + '</b></td><td>' + escHtml(r.i || '—') +
      '</td><td class="num">' + (r.pos ? escHtml(r.pos) + 'º' : '—') + '</td><td class="num">' + escHtml(r.aud || '—') +
      '</td><td class="num">' + escHtml(r.sh || '—') + '</td><td style="min-width:16rem">' + escHtml(r.obs || '') + '</td></tr>';
  }).join('');
  t.innerHTML = '<table><thead><tr><th>Período</th><th>Instituto</th><th class="num">Posição</th><th class="num">Audiência</th><th class="num">Share</th><th>Observações</th></tr></thead><tbody>' + body + '</tbody></table>';
}
function dlRowHtml(r, i){
  return '<div class="dial-row" data-i="' + i + '">' +
    '<input class="fin-input d-p" value="' + escHtml(r.p || '') + '" placeholder="ex.: 1º tri 2026">' +
    '<input class="fin-input d-i" value="' + escHtml(r.i || '') + '" placeholder="instituto">' +
    '<input class="fin-input d-pos" value="' + escHtml(r.pos || '') + '" placeholder="nº">' +
    '<input class="fin-input d-aud" value="' + escHtml(r.aud || '') + '" placeholder="ex.: 2,1 pts">' +
    '<input class="fin-input d-sh" value="' + escHtml(r.sh || '') + '" placeholder="ex.: 4,8%">' +
    '<input class="fin-input d-obs" value="' + escHtml(r.obs || '') + '" placeholder="observações">' +
    '<button type="button" class="i-del" title="Remover">×</button></div>';
}
var DL_ROWS = [];
function dlEdit(){
  DL_ROWS = ((DIAL && DIAL.rows) || []).map(function(r){ return { p:r.p||'', i:r.i||'', pos:r.pos||'', aud:r.aud||'', sh:r.sh||'', obs:r.obs||'' }; });
  if(!DL_ROWS.length) DL_ROWS.push({ p:'', i:'', pos:'', aud:'', sh:'', obs:'' });
  dlRenderForm();
  var f = document.getElementById('dlForm');
  f.hidden = false;
  f.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}
function dlRenderForm(){
  var host = document.getElementById('dlRows');
  host.innerHTML = DL_ROWS.map(dlRowHtml).join('') +
    '<div class="pp-add"><button type="button" class="mini" data-add="1">+ Adicionar pesquisa</button></div>';
  host.onclick = function(ev){
    var b = ev.target.closest('button'); if(!b) return;
    if(b.dataset.add){ DL_ROWS.push({ p:'', i:'', pos:'', aud:'', sh:'', obs:'' }); dlRenderForm(); }
    else if(b.classList.contains('i-del')){ DL_ROWS.splice(+b.closest('.dial-row').dataset.i, 1); dlRenderForm(); }
  };
  host.oninput = function(ev){
    var row = ev.target.closest('.dial-row'); if(!row) return;
    var r = DL_ROWS[+row.dataset.i];
    if(ev.target.classList.contains('d-p')) r.p = ev.target.value;
    else if(ev.target.classList.contains('d-i')) r.i = ev.target.value;
    else if(ev.target.classList.contains('d-pos')) r.pos = ev.target.value;
    else if(ev.target.classList.contains('d-aud')) r.aud = ev.target.value;
    else if(ev.target.classList.contains('d-sh')) r.sh = ev.target.value;
    else if(ev.target.classList.contains('d-obs')) r.obs = ev.target.value;
  };
}
function dlSave(){
  var rows = DL_ROWS.filter(function(r){ return (r.p || '').trim(); });
  var btn = document.getElementById('dlSalvar');
  btn.disabled = true;
  db.collection('analises').doc('dial').set({
    rows: rows,
    atualizadoPor: ME.nome || ME.email,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){
    document.getElementById('dlForm').hidden = true;
  }).catch(function(){
    flashMsg('dlMsg', 'Sem permissão para salvar — só a diretoria edita as pesquisas.');
  }).finally(function(){ btn.disabled = false; });
}

/* =================== Jurídico (contratos e termos) =================== */
var jurUnsub = null, jurBound = false, JR = null, jurRows = [];
var JR_TIPOS = ['Contrato', 'Termo', 'Aditivo', 'Outro'];
var JR_MODELOS = {
  patrocinio: {
    nome: 'Contrato de patrocínio / veiculação',
    titulo: 'Contrato de Patrocínio e Veiculação Publicitária',
    tipo: 'Contrato',
    partes: 'Inspira FM 97.7 × [RAZÃO SOCIAL DA PATROCINADORA]',
    texto: 'CONTRATADA: Inspira FM 97.7, emissora de radiodifusão com sede em Campinas/SP, doravante denominada EMISSORA.\n\nCONTRATANTE: [RAZÃO SOCIAL], inscrita no CNPJ sob nº [CNPJ], com sede em [ENDEREÇO], neste ato representada por [NOME DO REPRESENTANTE], doravante denominada PATROCINADORA.\n\nAs partes celebram o presente contrato, que se regerá pelas cláusulas seguintes:\n\nCLÁUSULA 1ª — DO OBJETO\nVeiculação de [QUANTIDADE] inserções publicitárias de [DURAÇÃO] segundos na programação da EMISSORA, no período e nos horários descritos na Cláusula 3ª, além das contrapartidas descritas no plano comercial apresentado à PATROCINADORA.\n\nCLÁUSULA 2ª — DO VALOR E DA FORMA DE PAGAMENTO\nPelo patrocínio, a PATROCINADORA pagará à EMISSORA o valor mensal de R$ [VALOR] ([VALOR POR EXTENSO]), com vencimento todo dia [DIA] de cada mês, mediante [FORMA DE PAGAMENTO].\nParágrafo único: o atraso superior a [X] dias implicará multa de 2%, juros de 1% ao mês e suspensão das veiculações até a regularização.\n\nCLÁUSULA 3ª — DO PERÍODO E DOS HORÁRIOS\nVigência de [DATA DE INÍCIO] a [DATA DE TÉRMINO], com inserções distribuídas [DESCREVER A DISTRIBUIÇÃO — ex.: de segunda a sexta, entre 7h e 19h].\n\nCLÁUSULA 4ª — DO MATERIAL PUBLICITÁRIO\nO material será produzido por [RESPONSÁVEL PELA PRODUÇÃO]. O conteúdo deve respeitar a legislação vigente e as normas internas da EMISSORA, que poderá recusar peça em desacordo.\n\nCLÁUSULA 5ª — DAS OBRIGAÇÕES DA EMISSORA\nVeicular as inserções contratadas; comunicar alterações relevantes de programação; disponibilizar comprovante de veiculação quando solicitado.\n\nCLÁUSULA 6ª — DAS OBRIGAÇÕES DA PATROCINADORA\nFornecer as informações e materiais necessários; efetuar os pagamentos nos prazos; responsabilizar-se pela veracidade das informações comerciais fornecidas.\n\nCLÁUSULA 7ª — DA RESCISÃO\nQualquer das partes poderá rescindir este contrato mediante aviso prévio de 30 (trinta) dias. O descumprimento de cláusula autoriza a rescisão imediata pela parte inocente, sem prejuízo da cobrança dos valores devidos.\n\nCLÁUSULA 8ª — DO FORO\nFica eleito o foro da Comarca de Campinas/SP para dirimir quaisquer controvérsias.\n\nE, por estarem justas e contratadas, as partes assinam o presente em duas vias de igual teor.\n\nCampinas, [DATA].\n\n\n_____________________________________\nInspira FM 97.7 — EMISSORA\n\n_____________________________________\n[RAZÃO SOCIAL] — PATROCINADORA\n\n_____________________________________\nTestemunha 1 — Nome/CPF\n\n_____________________________________\nTestemunha 2 — Nome/CPF'
  },
  permuta: {
    nome: 'Contrato de permuta',
    titulo: 'Contrato de Permuta de Serviços e Mídia',
    tipo: 'Contrato',
    partes: 'Inspira FM 97.7 × [RAZÃO SOCIAL DO PARCEIRO]',
    texto: 'PERMUTANTE 1: Inspira FM 97.7, emissora de radiodifusão com sede em Campinas/SP, doravante denominada EMISSORA.\n\nPERMUTANTE 2: [RAZÃO SOCIAL], inscrita no CNPJ sob nº [CNPJ], com sede em [ENDEREÇO], doravante denominada PARCEIRA.\n\nCLÁUSULA 1ª — DO OBJETO\nPermuta entre as partes, sem envolvimento de valores em dinheiro: a EMISSORA fornecerá [DESCREVER A MÍDIA — ex.: X inserções semanais de 30 segundos + menções em redes sociais], e a PARCEIRA fornecerá [DESCREVER PRODUTOS/SERVIÇOS].\n\nCLÁUSULA 2ª — DA VALORAÇÃO\nPara fins de equivalência e registro, as partes atribuem à permuta o valor mensal de referência de R$ [VALOR].\n\nCLÁUSULA 3ª — DA VIGÊNCIA\nDe [DATA DE INÍCIO] a [DATA DE TÉRMINO], renovável por acordo escrito entre as partes.\n\nCLÁUSULA 4ª — DAS RESPONSABILIDADES\nCada parte responde pela qualidade e entrega daquilo que fornece, mantendo o padrão combinado durante toda a vigência.\n\nCLÁUSULA 5ª — DA RESCISÃO\nQualquer das partes poderá rescindir mediante aviso prévio de 30 (trinta) dias, quitando-se as obrigações pendentes até a data do encerramento.\n\nCLÁUSULA 6ª — DO FORO\nFica eleito o foro da Comarca de Campinas/SP.\n\nCampinas, [DATA].\n\n\n_____________________________________\nInspira FM 97.7 — EMISSORA\n\n_____________________________________\n[RAZÃO SOCIAL] — PARCEIRA'
  },
  imagem: {
    nome: 'Termo de uso de imagem e voz',
    titulo: 'Termo de Autorização de Uso de Imagem e Voz',
    tipo: 'Termo',
    partes: 'Inspira FM 97.7 × [NOME DO AUTORIZANTE]',
    texto: 'Eu, [NOME COMPLETO], portador(a) do CPF nº [CPF], residente em [CIDADE/UF], AUTORIZO, de forma gratuita e por prazo indeterminado, a Inspira FM 97.7 a captar, utilizar, editar e veicular minha imagem e minha voz em:\n\na) programação da rádio (ao vivo ou gravada);\nb) redes sociais, site e aplicativo da emissora;\nc) materiais institucionais e de divulgação, digitais ou impressos.\n\n1. A autorização abrange o material captado em [DESCREVER O CONTEXTO — ex.: entrevista no estúdio em DATA / cobertura do evento X].\n\n2. A utilização não gera qualquer obrigação de pagamento, vínculo empregatício ou exclusividade.\n\n3. A emissora se compromete a utilizar o material com respeito, sem distorcer o contexto das declarações.\n\n4. Esta autorização pode ser revogada a qualquer momento, por escrito, valendo a revogação apenas para novas veiculações.\n\nCampinas, [DATA].\n\n\n_____________________________________\n[NOME COMPLETO] — Autorizante\n\n_____________________________________\nInspira FM 97.7'
  },
  servicos: {
    nome: 'Contrato de prestação de serviços',
    titulo: 'Contrato de Prestação de Serviços',
    tipo: 'Contrato',
    partes: 'Inspira FM 97.7 × [NOME/RAZÃO SOCIAL DO PRESTADOR]',
    texto: 'CONTRATANTE: Inspira FM 97.7, emissora de radiodifusão com sede em Campinas/SP.\n\nCONTRATADO(A): [NOME/RAZÃO SOCIAL], inscrito(a) no CPF/CNPJ sob nº [DOCUMENTO], residente/sediado(a) em [ENDEREÇO].\n\nCLÁUSULA 1ª — DO OBJETO\nPrestação dos seguintes serviços: [DESCREVER OS SERVIÇOS — ex.: produção de conteúdo audiovisual, locução, edição].\n\nCLÁUSULA 2ª — DO VALOR E DO PAGAMENTO\nPelos serviços, a CONTRATANTE pagará R$ [VALOR] por [MÊS/ENTREGA], mediante [FORMA DE PAGAMENTO], até o dia [DIA].\n\nCLÁUSULA 3ª — DO PRAZO\nVigência de [DATA DE INÍCIO] a [DATA DE TÉRMINO], podendo ser renovado por acordo entre as partes.\n\nCLÁUSULA 4ª — DA NATUREZA DA RELAÇÃO\nEste contrato não gera vínculo empregatício. O(A) CONTRATADO(A) executa os serviços com autonomia, arcando com suas obrigações fiscais e previdenciárias.\n\nCLÁUSULA 5ª — DA CONFIDENCIALIDADE\nO(A) CONTRATADO(A) manterá sigilo sobre informações internas da EMISSORA (comerciais, financeiras e de programação) a que tiver acesso.\n\nCLÁUSULA 6ª — DA PROPRIEDADE DO MATERIAL\nO material produzido no âmbito deste contrato pertence à EMISSORA, que poderá utilizá-lo livremente em seus canais.\n\nCLÁUSULA 7ª — DA RESCISÃO\nQualquer das partes poderá rescindir mediante aviso prévio de 30 (trinta) dias, quitando-se os valores proporcionais aos serviços prestados.\n\nCLÁUSULA 8ª — DO FORO\nFica eleito o foro da Comarca de Campinas/SP.\n\nCampinas, [DATA].\n\n\n_____________________________________\nInspira FM 97.7 — CONTRATANTE\n\n_____________________________________\n[NOME/RAZÃO SOCIAL] — CONTRATADO(A)'
  }
};
function jurInit(){
  if(!canRe()) return;
  if(!jurBound){
    jurBound = true;
    var selM = document.getElementById('jrModelo');
    selM.innerHTML = '<option value="">Criar a partir de um modelo…</option>' + Object.keys(JR_MODELOS).map(function(k){
      return '<option value="' + k + '">' + escHtml(JR_MODELOS[k].nome) + '</option>';
    }).join('');
    selM.addEventListener('change', function(){
      var m = JR_MODELOS[this.value];
      this.value = '';
      if(!m) return;
      jrOpen(null, { titulo: m.titulo, tipo: m.tipo, partes: m.partes, texto: m.texto });
    });
    document.getElementById('jrTipo').innerHTML = JR_TIPOS.map(function(x){
      return '<option value="' + x + '">' + x + '</option>';
    }).join('');
    document.getElementById('jrNovo').addEventListener('click', function(){
      jrOpen(null, { titulo: '', tipo: 'Contrato', partes: '', texto: '' });
    });
    document.getElementById('jrVoltar').addEventListener('click', jrShowHub);
    document.getElementById('jrSalvar').addEventListener('click', jrSave);
    document.getElementById('jrExcluir').addEventListener('click', jrDelete);
    document.getElementById('jrVer').addEventListener('click', jrVer);
    document.getElementById('jrFechar').addEventListener('click', function(){
      document.getElementById('jrView').hidden = true;
      document.getElementById('jrEditor').hidden = false;
      window.scrollTo(0,0);
    });
    document.getElementById('jrImprimir').addEventListener('click', function(){ window.print(); });
    ['jrTitulo','jrPartes','jrTexto'].forEach(function(id){
      document.getElementById(id).addEventListener('input', function(){
        if(!JR) return;
        JR.data[id === 'jrTitulo' ? 'titulo' : (id === 'jrPartes' ? 'partes' : 'texto')] = this.value;
      });
    });
    document.getElementById('jrTipo').addEventListener('change', function(){
      if(JR) JR.data.tipo = this.value;
    });
  }
  if(jurUnsub) return;
  jurUnsub = db.collection('juridico').orderBy('atualizadoEm','desc').onSnapshot(function(qs){
    jurRows = [];
    qs.forEach(function(doc){ jurRows.push({ id: doc.id, d: doc.data() }); });
    renderJurList();
  }, function(){
    document.getElementById('jrList').innerHTML =
      '<div class="proj-empty">Não foi possível carregar os documentos. As regras da coleção <b>juridico</b> foram publicadas?</div>';
  });
}
function renderJurList(){
  var host = document.getElementById('jrList');
  if(!jurRows.length){
    host.innerHTML = '<div class="proj-empty">Nenhum documento ainda. Comece por um <b>modelo</b> ou crie um documento em branco.</div>';
    return;
  }
  host.innerHTML = jurRows.map(function(r){
    var d = r.d;
    var quando = d.atualizadoEm && d.atualizadoEm.toDate ? d.atualizadoEm.toDate().toLocaleDateString('pt-BR') : '';
    return '<button type="button" class="proj-row" data-id="' + r.id + '">' +
      '<span class="pr-main"><span class="pr-nome">' + escHtml(d.titulo || '(sem título)') +
      ' <span class="st-pill tipo-pill">' + escHtml(d.tipo || 'Documento') + '</span></span>' +
      '<span class="pr-sub">' + escHtml(d.partes || '') + (d.autor ? ' · por ' + escHtml(d.autor) : '') +
      (quando ? ' · atualizado em ' + quando : '') + '</span></span></button>';
  }).join('');
  host.querySelectorAll('.proj-row').forEach(function(btn){
    btn.addEventListener('click', function(){
      var row = null;
      jurRows.forEach(function(r){ if(r.id === btn.dataset.id) row = r; });
      if(row) jrOpen(row.id, row.d);
    });
  });
}
function jrShowHub(){
  JR = null;
  document.getElementById('jrEditor').hidden = true;
  document.getElementById('jrView').hidden = true;
  document.getElementById('jrHub').hidden = false;
  window.scrollTo(0,0);
}
function jrOpen(id, data){
  JR = { id: id, data: {
    titulo: data.titulo || '', tipo: data.tipo || 'Contrato',
    partes: data.partes || '', texto: data.texto || '',
    autor: data.autor || (ME.nome || ME.email)
  }};
  document.getElementById('jrHub').hidden = true;
  document.getElementById('jrView').hidden = true;
  document.getElementById('jrEditor').hidden = false;
  document.getElementById('jrTitulo').value = JR.data.titulo;
  document.getElementById('jrTipo').value = JR.data.tipo;
  document.getElementById('jrPartes').value = JR.data.partes;
  document.getElementById('jrTexto').value = JR.data.texto;
  document.getElementById('jrExcluir').hidden = !id;
  document.getElementById('jrMeta').textContent = id ? 'Criado por ' + JR.data.autor : 'Documento novo — ainda não salvo.';
  window.scrollTo(0,0);
}
function jrSave(){
  if(!JR) return;
  if(!JR.data.titulo.trim()){ flashMsg('jrMsg', 'Dê um título ao documento antes de salvar.'); return; }
  var doc = {
    titulo: JR.data.titulo.trim(), tipo: JR.data.tipo,
    partes: JR.data.partes || '', texto: JR.data.texto || '',
    autor: JR.data.autor || (ME.nome || ME.email), autorEmail: ME.email,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  };
  var btn = document.getElementById('jrSalvar');
  btn.disabled = true;
  var op = JR.id
    ? db.collection('juridico').doc(JR.id).set(doc, { merge: true })
    : db.collection('juridico').add(Object.assign({ criadoEm: firebase.firestore.FieldValue.serverTimestamp() }, doc));
  op.then(function(ref){
    if(!JR.id && ref) JR.id = ref.id;
    document.getElementById('jrExcluir').hidden = false;
    flashMsg('jrMsg', 'Documento salvo ✓');
  }).catch(function(){ flashMsg('jrMsg', 'Sem permissão para salvar.'); })
    .finally(function(){ btn.disabled = false; });
}
function jrDelete(){
  if(!JR || !JR.id) return;
  if(!confirm('Excluir o documento "' + JR.data.titulo + '" para todos? Essa ação não pode ser desfeita.')) return;
  db.collection('juridico').doc(JR.id).delete().then(jrShowHub)
    .catch(function(){ flashMsg('jrMsg', 'Sem permissão para excluir.'); });
}
function jrVer(){
  if(!JR) return;
  document.getElementById('jrPTitulo').textContent = JR.data.titulo || 'Documento';
  document.getElementById('jrPPartes').textContent = JR.data.partes || '';
  document.getElementById('jrPTexto').textContent = JR.data.texto || '';
  document.getElementById('jrEditor').hidden = true;
  document.getElementById('jrView').hidden = false;
  window.scrollTo(0,0);
}

/* =================== Nossa Programação =================== */
var progUnsub = null, progBound = false, PROG = {}, PG_TAB = 'radio-ao-vivo', PG_ROWS = [];
var PG_CANAIS = [['Rádio Ao Vivo','radio-ao-vivo'],['Instagram','instagram'],['TikTok','tiktok'],['YouTube','youtube']];
function progInit(){
  if(!progBound){
    progBound = true;
    var tabs = document.getElementById('pgTabs');
    tabs.innerHTML = PG_CANAIS.map(function(c){
      return '<button type="button" data-pgtab="' + c[1] + '"' + (c[1] === PG_TAB ? ' class="on"' : '') + '>' + escHtml(c[0]) + '</button>';
    }).join('');
    tabs.addEventListener('click', function(ev){
      var b = ev.target.closest('[data-pgtab]'); if(!b) return;
      PG_TAB = b.dataset.pgtab;
      document.getElementById('pgForm').hidden = true;
      renderProg();
    });
    document.getElementById('pgEditBtn').addEventListener('click', pgEdit);
    document.getElementById('pgCancelar').addEventListener('click', function(){
      document.getElementById('pgForm').hidden = true;
    });
    document.getElementById('pgSalvar').addEventListener('click', pgSave);
  }
  if(progUnsub) return;
  progUnsub = db.collection('programacao').onSnapshot(function(qs){
    PROG = {};
    qs.forEach(function(doc){ PROG[doc.id] = doc.data(); });
    renderProg();
  }, function(){
    document.getElementById('pgTable').innerHTML =
      '<div class="proj-empty">Não foi possível carregar a programação. As regras da coleção <b>programacao</b> foram publicadas?</div>';
  });
}
function pgLabel(){
  var l = '';
  PG_CANAIS.forEach(function(c){ if(c[1] === PG_TAB) l = c[0]; });
  return l;
}
function renderProg(){
  document.querySelectorAll('#pgTabs [data-pgtab]').forEach(function(b){
    b.classList.toggle('on', b.dataset.pgtab === PG_TAB);
  });
  document.getElementById('pgCanalTitulo').textContent = 'Grade — ' + pgLabel();
  var itens = (PROG[PG_TAB] && PROG[PG_TAB].itens) || [];
  var host = document.getElementById('pgTable');
  if(!itens.length){
    host.innerHTML = '<div class="proj-empty">Grade do canal <b>' + escHtml(pgLabel()) + '</b> ainda não publicada.' +
      (canRe() ? ' Clique em <b>Editar grade</b> para montar a primeira versão.' : '') + '</div>';
    return;
  }
  host.innerHTML = '<table><thead><tr><th>Dia(s)</th><th>Horário</th><th>Programa / conteúdo</th><th>Responsável</th></tr></thead><tbody>' +
    itens.map(function(r){
      return '<tr><td><b>' + escHtml(r.d || '') + '</b></td><td>' + escHtml(r.h || '—') +
        '</td><td>' + escHtml(r.t || '') + '</td><td>' + escHtml(r.r || '—') + '</td></tr>';
    }).join('') + '</tbody></table>';
}
function pgEdit(){
  PG_ROWS = (((PROG[PG_TAB] || {}).itens) || []).map(function(r){ return { d:r.d||'', h:r.h||'', t:r.t||'', r:r.r||'' }; });
  if(!PG_ROWS.length) PG_ROWS.push({ d:'', h:'', t:'', r:'' });
  pgRenderForm();
  var f = document.getElementById('pgForm');
  f.hidden = false;
  f.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}
function pgRenderForm(){
  var host = document.getElementById('pgRows');
  host.innerHTML = PG_ROWS.map(function(r, i){
    return '<div class="pg-row" data-i="' + i + '">' +
      '<input class="fin-input g-d" value="' + escHtml(r.d) + '" placeholder="ex.: seg a sex">' +
      '<input class="fin-input g-h" value="' + escHtml(r.h) + '" placeholder="ex.: 7h–10h">' +
      '<input class="fin-input g-t" value="' + escHtml(r.t) + '" placeholder="programa / conteúdo">' +
      '<input class="fin-input g-r" value="' + escHtml(r.r) + '" placeholder="responsável">' +
      '<button type="button" class="i-del" title="Remover">×</button></div>';
  }).join('') + '<div class="pp-add"><button type="button" class="mini" data-add="1">+ Adicionar linha</button></div>';
  host.onclick = function(ev){
    var b = ev.target.closest('button'); if(!b) return;
    if(b.dataset.add){ PG_ROWS.push({ d:'', h:'', t:'', r:'' }); pgRenderForm(); }
    else if(b.classList.contains('i-del')){ PG_ROWS.splice(+b.closest('.pg-row').dataset.i, 1); pgRenderForm(); }
  };
  host.oninput = function(ev){
    var row = ev.target.closest('.pg-row'); if(!row) return;
    var r = PG_ROWS[+row.dataset.i];
    if(ev.target.classList.contains('g-d')) r.d = ev.target.value;
    else if(ev.target.classList.contains('g-h')) r.h = ev.target.value;
    else if(ev.target.classList.contains('g-t')) r.t = ev.target.value;
    else if(ev.target.classList.contains('g-r')) r.r = ev.target.value;
  };
}
function pgSave(){
  var itens = PG_ROWS.filter(function(r){ return (r.t || '').trim() || (r.d || '').trim(); });
  var btn = document.getElementById('pgSalvar');
  btn.disabled = true;
  db.collection('programacao').doc(PG_TAB).set({
    canal: pgLabel(), itens: itens,
    atualizadoPor: ME.nome || ME.email,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){
    document.getElementById('pgForm').hidden = true;
  }).catch(function(){
    flashMsg('pgMsg', 'Sem permissão para salvar — só a diretoria edita a grade.');
  }).finally(function(){ btn.disabled = false; });
}

/* =================== Quadros da Inspira + Colunistas =================== */
var qdUnsub = null, clUnsub = null, qdBound = false, qdRows = [], clRows = [], QD = null, CL = null;
var QD_CANAIS = ['Rádio Ao Vivo','Instagram','TikTok','YouTube'];
var QD_TAB = 'radio';
var QD_TITULOS = { radio: 'Quadros no ar — Rádio', redes: 'Quadros das redes sociais' };
function qdTab(t){
  QD_TAB = t;
  document.querySelectorAll('[data-qdtab]').forEach(function(b){ b.classList.toggle('on', b.dataset.qdtab === t); });
  /* na aba Site só existem os colunistas — o bloco de quadros some inteiro */
  document.getElementById('qdMainSection').hidden = t === 'site';
  document.getElementById('clSection').hidden = t !== 'site';
  if(t !== 'site') document.getElementById('qdTitulo').textContent = QD_TITULOS[t];
  document.getElementById('qdForm').hidden = true;
  QD = null;
  renderQuadros();
}
function qdInit(){
  if(!qdBound){
    qdBound = true;
    document.querySelectorAll('[data-qdtab]').forEach(function(b){
      b.addEventListener('click', function(){ qdTab(b.dataset.qdtab); });
    });
    var ch = document.getElementById('qdCanais');
    ch.innerHTML = QD_CANAIS.map(function(c){
      return '<label><input type="checkbox" value="' + escHtml(c) + '"> ' + escHtml(c) + '</label>';
    }).join('');
    document.getElementById('qdNovo').addEventListener('click', function(){ qdOpen(null, {}); });
    document.getElementById('qdCancelarBtn').addEventListener('click', function(){
      QD = null;
      document.getElementById('qdForm').hidden = true;
    });
    document.getElementById('qdSalvar').addEventListener('click', qdSave);
    document.getElementById('qdExcluir').addEventListener('click', qdDelete);
    document.getElementById('clNovo').addEventListener('click', function(){ clOpen(null, {}); });
    document.getElementById('clCancelarBtn').addEventListener('click', function(){
      CL = null;
      document.getElementById('clForm').hidden = true;
    });
    document.getElementById('clSalvar').addEventListener('click', clSave);
    document.getElementById('clExcluir').addEventListener('click', clDelete);
  }
  if(!qdUnsub){
    qdUnsub = db.collection('quadros').orderBy('nome').onSnapshot(function(qs){
      qdRows = [];
      qs.forEach(function(doc){ qdRows.push({ id: doc.id, d: doc.data() }); });
      renderQuadros();
    }, function(){
      document.getElementById('qdList').innerHTML =
        '<div class="proj-empty">Não foi possível carregar os quadros. As regras da coleção <b>quadros</b> foram publicadas?</div>';
    });
  }
  if(!clUnsub){
    clUnsub = db.collection('colunistas').orderBy('nome').onSnapshot(function(qs){
      clRows = [];
      qs.forEach(function(doc){ clRows.push({ id: doc.id, d: doc.data() }); });
      renderColunistas();
    }, function(){
      document.getElementById('clTable').innerHTML =
        '<div class="proj-empty">Não foi possível carregar os colunistas.</div>';
    });
  }
}
function qdCard(r){
  var d = r.d;
  var pills = (d.canais || []).map(function(c){ return '<span class="canal-pill">' + escHtml(c) + '</span>'; }).join('');
  return '<div class="qd-card"><h4>' + escHtml(d.nome || '') + '</h4>' +
    (d.apresentador ? '<span class="qd-com">com ' + escHtml(d.apresentador) + '</span>' : '') +
    (d.quando ? '<span class="qd-quando">' + escHtml(d.quando) + '</span>' : '') +
    (d.contexto ? '<p class="qd-ctx">' + escHtml(d.contexto) + '</p>' : '') +
    '<div class="qd-foot"><div class="pills">' + pills + '</div>' +
    (canRe() ? '<button type="button" class="mini" data-qedit="' + r.id + '">Editar</button>' : '') + '</div></div>';
}
function qdTem(d, canal){ return (d.canais || []).indexOf(canal) > -1; }
function renderQuadros(){
  var host = document.getElementById('qdList');
  var html = '';
  if(QD_TAB === 'radio'){
    var rows = qdRows.filter(function(r){ return qdTem(r.d, 'Rádio Ao Vivo'); });
    html = rows.length
      ? '<div class="qd-grid">' + rows.map(qdCard).join('') + '</div>'
      : '<div class="proj-empty">Nenhum quadro da rádio ainda.' +
        (canRe() ? ' Crie um quadro e marque o canal <b>Rádio Ao Vivo</b>.' : '') + '</div>';
  }else if(QD_TAB === 'redes'){
    var redes = ['Instagram','TikTok','YouTube'];
    var algum = false;
    redes.forEach(function(rede){
      var rows = qdRows.filter(function(r){ return qdTem(r.d, rede); });
      if(!rows.length) return;
      algum = true;
      html += '<div class="qd-sub"><h4>' + rede + '</h4><small>' + rows.length + ' quadro' + (rows.length > 1 ? 's' : '') + '</small></div>' +
        '<div class="qd-grid">' + rows.map(qdCard).join('') + '</div>';
    });
    if(!algum){
      html = '<div class="proj-empty">Nenhum quadro das redes sociais ainda.' +
        (canRe() ? ' Crie um quadro e marque <b>Instagram</b>, <b>TikTok</b> ou <b>YouTube</b> — ele aparece agrupado por rede aqui.' : '') + '</div>';
    }
  }else{
    html = ''; /* aba Site mostra só os colunistas (seção própria) */
  }
  host.innerHTML = html;
  host.onclick = function(ev){
    var b = ev.target.closest('[data-qedit]'); if(!b) return;
    var row = null;
    qdRows.forEach(function(r){ if(r.id === b.dataset.qedit) row = r; });
    if(row) qdOpen(row.id, row.d);
  };
}
function qdOpen(id, d){
  QD = { id: id };
  document.getElementById('qdNome').value = d.nome || '';
  document.getElementById('qdApresentador').value = d.apresentador || '';
  document.getElementById('qdQuando').value = d.quando || '';
  document.getElementById('qdContexto').value = d.contexto || '';
  var canais = d.canais || [];
  document.querySelectorAll('#qdCanais input').forEach(function(i){ i.checked = canais.indexOf(i.value) > -1; });
  document.getElementById('qdExcluir').hidden = !id;
  var f = document.getElementById('qdForm');
  f.hidden = false;
  f.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  document.getElementById('qdNome').focus();
}
function qdSave(){
  if(!QD) return;
  var nome = document.getElementById('qdNome').value.trim();
  if(!nome){ flashMsg('qdMsg', 'Dê um nome ao quadro.'); return; }
  var doc = {
    nome: nome,
    apresentador: document.getElementById('qdApresentador').value.trim(),
    quando: document.getElementById('qdQuando').value.trim(),
    contexto: document.getElementById('qdContexto').value.trim(),
    canais: Array.prototype.slice.call(document.querySelectorAll('#qdCanais input:checked')).map(function(i){ return i.value; }),
    atualizadoPor: ME.nome || ME.email,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  };
  var btn = document.getElementById('qdSalvar');
  btn.disabled = true;
  var op = QD.id
    ? db.collection('quadros').doc(QD.id).set(doc, { merge: true })
    : db.collection('quadros').add(Object.assign({ criadoEm: firebase.firestore.FieldValue.serverTimestamp() }, doc));
  op.then(function(){
    QD = null;
    document.getElementById('qdForm').hidden = true;
  }).catch(function(){ flashMsg('qdMsg', 'Sem permissão para salvar.'); })
    .finally(function(){ btn.disabled = false; });
}
function qdDelete(){
  if(!QD || !QD.id) return;
  if(!confirm('Excluir este quadro para todos?')) return;
  db.collection('quadros').doc(QD.id).delete().then(function(){
    QD = null;
    document.getElementById('qdForm').hidden = true;
  }).catch(function(){ flashMsg('qdMsg', 'Sem permissão para excluir.'); });
}
function renderColunistas(){
  var host = document.getElementById('clTable');
  if(!clRows.length){
    host.innerHTML = '<div class="proj-empty">Nenhum colunista cadastrado ainda.' +
      (canRe() ? ' Clique em <b>+ Adicionar colunista</b>.' : '') + '</div>';
    return;
  }
  host.innerHTML = '<table><thead><tr><th>Nome</th><th>Coluna / tema</th><th>Dia das matérias</th><th>Observações</th>' +
    (canRe() ? '<th></th>' : '') + '</tr></thead><tbody>' +
    clRows.map(function(r){
      var d = r.d;
      return '<tr><td><b>' + escHtml(d.nome || '') + '</b></td><td>' + escHtml(d.tema || '—') +
        '</td><td>' + escHtml(d.dia || '—') + '</td><td>' + escHtml(d.obs || '') + '</td>' +
        (canRe() ? '<td><button type="button" class="mini" data-cledit="' + r.id + '">Editar</button></td>' : '') + '</tr>';
    }).join('') + '</tbody></table>';
  host.onclick = function(ev){
    var b = ev.target.closest('[data-cledit]'); if(!b) return;
    var row = null;
    clRows.forEach(function(r){ if(r.id === b.dataset.cledit) row = r; });
    if(row) clOpen(row.id, row.d);
  };
}
function clOpen(id, d){
  CL = { id: id };
  document.getElementById('clNome').value = d.nome || '';
  document.getElementById('clTema').value = d.tema || '';
  document.getElementById('clDia').value = d.dia || '';
  document.getElementById('clObs').value = d.obs || '';
  document.getElementById('clExcluir').hidden = !id;
  var f = document.getElementById('clForm');
  f.hidden = false;
  f.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  document.getElementById('clNome').focus();
}
function clSave(){
  if(!CL) return;
  var nome = document.getElementById('clNome').value.trim();
  if(!nome){ flashMsg('clMsg', 'Informe o nome do colunista.'); return; }
  var doc = {
    nome: nome,
    tema: document.getElementById('clTema').value.trim(),
    dia: document.getElementById('clDia').value.trim(),
    obs: document.getElementById('clObs').value.trim(),
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  };
  var btn = document.getElementById('clSalvar');
  btn.disabled = true;
  var op = CL.id
    ? db.collection('colunistas').doc(CL.id).set(doc, { merge: true })
    : db.collection('colunistas').add(Object.assign({ criadoEm: firebase.firestore.FieldValue.serverTimestamp() }, doc));
  op.then(function(){
    CL = null;
    document.getElementById('clForm').hidden = true;
  }).catch(function(){ flashMsg('clMsg', 'Sem permissão para salvar.'); })
    .finally(function(){ btn.disabled = false; });
}
function clDelete(){
  if(!CL || !CL.id) return;
  if(!confirm('Excluir este colunista para todos?')) return;
  db.collection('colunistas').doc(CL.id).delete().then(function(){
    CL = null;
    document.getElementById('clForm').hidden = true;
  }).catch(function(){ flashMsg('clMsg', 'Sem permissão para excluir.'); });
}

/* =================== Radar de Embaixadores =================== */
var embUnsub = null, embBound = false, embRows = [], EMB_TAB = 'radar', EB = null;
function embInit(){
  if(!embBound){
    embBound = true;
    document.querySelectorAll('[data-embtab]').forEach(function(b){
      b.addEventListener('click', function(){
        EMB_TAB = b.dataset.embtab;
        document.querySelectorAll('[data-embtab]').forEach(function(x){ x.classList.toggle('on', x === b); });
        document.getElementById('embTitulo').textContent = EMB_TAB === 'radar' ? 'Radar da região' : 'Nossos embaixadores';
        renderEmb();
      });
    });
    document.getElementById('embNovo').addEventListener('click', function(){ ebOpen(null, {}); });
    document.getElementById('ebCancelarBtn').addEventListener('click', function(){
      EB = null;
      document.getElementById('embForm').hidden = true;
    });
    document.getElementById('ebSalvar').addEventListener('click', ebSave);
    document.getElementById('ebExcluir').addEventListener('click', ebDelete);
  }
  if(embUnsub) return;
  embUnsub = db.collection('embaixadores').orderBy('seguidores','desc').onSnapshot(function(qs){
    embRows = [];
    qs.forEach(function(doc){ embRows.push({ id: doc.id, d: doc.data() }); });
    renderEmb();
  }, function(){
    document.getElementById('embTable').innerHTML =
      '<div class="proj-empty">Não foi possível carregar. As regras da coleção <b>embaixadores</b> foram publicadas?</div>';
  });
}
function fmtSeg(n){
  n = +n || 0;
  if(n >= 1000000) return (n / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
  if(n >= 1000) return (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
  return n.toLocaleString('pt-BR');
}
function renderEmb(){
  var host = document.getElementById('embTable');
  var rows = EMB_TAB === 'parceiros' ? embRows.filter(function(r){ return r.d.parceiro === true; }) : embRows;
  if(!rows.length){
    host.innerHTML = '<div class="proj-empty">' + (EMB_TAB === 'parceiros'
      ? 'Nenhum embaixador parceiro ainda. Marque a caixa <b>“Já é parceiro”</b> ao cadastrar ou editar um influenciador.'
      : 'Nenhum influenciador mapeado ainda.' + (canRe() ? ' Clique em <b>+ Adicionar influenciador</b>.' : '')) + '</div>';
    return;
  }
  host.innerHTML = '<table><thead><tr><th>Nome</th><th>Perfil</th><th>Plataforma</th><th class="num">Seguidores</th><th>Nicho</th><th>Cidade</th><th>Status</th>' +
    (canRe() ? '<th></th>' : '') + '</tr></thead><tbody>' +
    rows.map(function(r){
      var d = r.d;
      return '<tr><td><b>' + escHtml(d.nome || '') + '</b></td><td>' + escHtml(d.perfil || '—') +
        '</td><td>' + escHtml(d.plataforma || '—') + '</td><td class="num">' + fmtSeg(d.seguidores) +
        '</td><td>' + escHtml(d.nicho || '—') + '</td><td>' + escHtml(d.cidade || '—') +
        '</td><td>' + (d.parceiro ? '<span class="st-pill parc-badge">EMBAIXADOR</span>' : '<span class="st-pill st-encerrada">radar</span>') + '</td>' +
        (canRe() ? '<td><button type="button" class="mini" data-ebedit="' + r.id + '">Editar</button></td>' : '') + '</tr>';
    }).join('') + '</tbody></table>';
  host.onclick = function(ev){
    var b = ev.target.closest('[data-ebedit]'); if(!b) return;
    var row = null;
    embRows.forEach(function(r){ if(r.id === b.dataset.ebedit) row = r; });
    if(row) ebOpen(row.id, row.d);
  };
}
function ebOpen(id, d){
  EB = { id: id };
  document.getElementById('ebNome').value = d.nome || '';
  document.getElementById('ebPerfil').value = d.perfil || '';
  document.getElementById('ebPlataforma').value = d.plataforma || 'Instagram';
  document.getElementById('ebSeguidores').value = d.seguidores || '';
  document.getElementById('ebNicho').value = d.nicho || '';
  document.getElementById('ebCidade').value = d.cidade || '';
  document.getElementById('ebParceiro').checked = d.parceiro === true;
  document.getElementById('ebExcluir').hidden = !id;
  var f = document.getElementById('embForm');
  f.hidden = false;
  f.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  document.getElementById('ebNome').focus();
}
function ebSave(){
  if(!EB) return;
  var nome = document.getElementById('ebNome').value.trim();
  if(!nome){ flashMsg('ebMsg', 'Informe o nome do influenciador.'); return; }
  var doc = {
    nome: nome,
    perfil: document.getElementById('ebPerfil').value.trim(),
    plataforma: document.getElementById('ebPlataforma').value,
    seguidores: parseInt(document.getElementById('ebSeguidores').value, 10) || 0,
    nicho: document.getElementById('ebNicho').value.trim(),
    cidade: document.getElementById('ebCidade').value.trim(),
    parceiro: document.getElementById('ebParceiro').checked,
    atualizadoPor: ME.nome || ME.email,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  };
  var btn = document.getElementById('ebSalvar');
  btn.disabled = true;
  var op = EB.id
    ? db.collection('embaixadores').doc(EB.id).set(doc, { merge: true })
    : db.collection('embaixadores').add(Object.assign({ criadoEm: firebase.firestore.FieldValue.serverTimestamp() }, doc));
  op.then(function(){
    EB = null;
    document.getElementById('embForm').hidden = true;
  }).catch(function(){ flashMsg('ebMsg', 'Sem permissão para salvar.'); })
    .finally(function(){ btn.disabled = false; });
}
function ebDelete(){
  if(!EB || !EB.id) return;
  if(!confirm('Excluir este influenciador para todos?')) return;
  db.collection('embaixadores').doc(EB.id).delete().then(function(){
    EB = null;
    document.getElementById('embForm').hidden = true;
  }).catch(function(){ flashMsg('ebMsg', 'Sem permissão para excluir.'); });
}

/* =================== menu lateral =================== */
(function(){
  var KEY = 'inspira-nav';
  function isDesktop(){ return window.innerWidth >= 1024; }
  function navSet(open){
    document.body.classList.toggle('nav-open', open);
    try{ localStorage.setItem(KEY, open ? '1' : '0'); }catch(e){}
  }
  document.getElementById('navToggle').addEventListener('click', function(){
    navSet(!document.body.classList.contains('nav-open'));
  });
  document.getElementById('navBackdrop').addEventListener('click', function(){ navSet(false); });
  document.getElementById('sidenav').addEventListener('click', function(ev){
    if(ev.target.closest('a') && !isDesktop()) navSet(false);
  });
  var saved = null;
  try{ saved = localStorage.getItem(KEY); }catch(e){}
  navSet(isDesktop() ? saved !== '0' : false);
})();

/* =================== init =================== */
function initApp(){
  if(appInitDone) return;
  appInitDone = true;
  buildFollowers();
  buildEngagement();
  buildRanking();
  buildGrowth();
  initFin();
}
