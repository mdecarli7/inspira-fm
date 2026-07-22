/* ============================================================
   Grid Bloom — fundo animado (WebGL puro, sem dependência)
   Porte do shader React/three.js para <canvas> vanilla.

   Uso:  <canvas class="bloom" data-cell="44" data-color="#82DD47"></canvas>
   Qualquer <canvas class="bloom"> na página é adotado no load.

   A grade é medida em PIXELS por célula (data-cell), não em "células por
   altura". Sem isso, o mesmo parâmetro rende texturas diferentes em painéis
   de alturas diferentes — a barra do topo saía com a malha esticada e o menu
   lateral com outra escala. Todo o resto do desenho (ruído, distorção,
   pulso, vinheta, raios do mouse) também é contado em células.

   Parâmetros por data-attribute (todos opcionais):
     data-cell               tamanho da célula em px  [44]
     data-color              cor do brilho (hex)
     data-opacity            via --bloom-o no style (CSS)
     data-speed              multiplicador geral de velocidade
     data-rotation           velocidade da rotação lenta
     data-fade               raio da vinheta, em células (grande = sem vinheta)
     data-noise              frequência do ruído orgânico, por célula
     data-distortion         distorção das linhas, em células (0 = reto)
     data-flow-x/-flow-y     deriva, em células por segundo
     data-hover-light        raio da luz sob o mouse, em células
     data-hover-radius       raio do empurrão geométrico, em células
     data-hover-strength     força do empurrão (0 = desliga)
     data-mouse="off"        desliga a interação de mouse
     data-link               painéis com data-link dividem a MESMA origem
                             (o centro da janela), então a malha atravessa a
                             emenda entre eles sem quebra — é o que costura
                             barra do topo, menu lateral e rodapé.
   ============================================================ */
(function () {
  'use strict';

  var VERT =
    'attribute vec2 aPos;' +
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform float iTime;',
    'uniform vec2  iResolution;',
    'uniform vec2  iMouse;',
    'uniform vec2  uOffset;',   // posição do canvas dentro da origem comum
    'uniform vec2  uCenter;',   // origem do desenho (centro da janela ou do canvas)
    'uniform float uMouseActive;',
    'uniform vec3  uColor;',
    'uniform float uSpeed;',
    'uniform float uCell;',     // px por célula
    'uniform float uRotationSpeed;',
    'uniform float uFadeFalloff;',
    'uniform float uNoise;',
    'uniform float uDistortionAmount;',
    'uniform float uFlowSpeedX;',
    'uniform float uFlowSpeedY;',
    'uniform float uHoverRepulsionRadius;',
    'uniform float uHoverRepulsionStrength;',
    'uniform float uHoverLightRadius;',

    // Simplex 2D noise
    'vec3 permute(vec3 x){ return mod(((x*34.0)+10.0)*x, 289.0); }',
    'float snoise(vec2 v){',
    '  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);',
    '  vec2 i  = floor(v + dot(v, C.yy));',
    '  vec2 x0 = v - i + dot(i, C.xx);',
    '  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);',
    '  vec4 x12 = x0.xyxy + C.xxzz;',
    '  x12.xy -= i1;',
    '  i = mod(i, 289.0);',
    '  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));',
    '  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);',
    '  m = m*m; m = m*m;',
    '  vec3 x = 2.0 * fract(p * C.www) - 1.0;',
    '  vec3 h = abs(x) - 0.5;',
    '  vec3 ox = floor(x + 0.5);',
    '  vec3 a0 = x - ox;',
    '  m *= 1.792843 - 0.853735 * (a0*a0 + h*h);',
    '  vec3 g;',
    '  g.x  = a0.x  * x0.x  + h.x  * x0.y;',
    '  g.yz = a0.yz * x12.xz + h.yz * x12.yw;',
    '  return 130.0 * dot(m, g);',
    '}',

    'void main(){',
    // tudo em células, a partir de uma origem que pode ser compartilhada
    '  vec2 c0 = (gl_FragCoord.xy + uOffset - uCenter) / uCell;',

    '  vec2 mouseC = (iMouse.xy + uOffset - uCenter) / uCell;',
    '  vec2 mouseDir = c0 - mouseC;',
    '  float mouseDist = length(mouseDir);',
    '  float mouseInfluence = smoothstep(uHoverRepulsionRadius, 0.0, mouseDist) * uMouseActive;',

    '  float rot = iTime * uRotationSpeed * 0.3;',
    '  mat2 m = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));',
    '  vec2 p = m * c0;',

    '  float noiseDist = snoise(p * uNoise + iTime * uSpeed * 0.15);',
    '  vec2 gridPos = p + vec2(noiseDist * uDistortionAmount);',

    '  gridPos += (m * mouseDir) * mouseInfluence * uHoverRepulsionStrength;',
    '  gridPos.x += iTime * uSpeed * uFlowSpeedX;',
    '  gridPos.y += iTime * uSpeed * uFlowSpeedY;',

    '  vec2 cell = fract(gridPos);',
    '  vec2 cellCenter = abs(cell - 0.5);',

    '  float lineWidth = 0.015;',
    '  float smoothEdge = 0.03;',
    '  vec2 lines = smoothstep(0.5 - lineWidth - smoothEdge, 0.5 - lineWidth, cellCenter);',
    '  float gridAlpha = max(lines.x, lines.y);',
    '  float intersections = lines.x * lines.y;',

    '  float glowMask = snoise(floor(gridPos) * 0.4 + iTime * uSpeed * 0.4);',
    '  float glow = smoothstep(0.2, 0.5, cellCenter.x) * smoothstep(0.2, 0.5, cellCenter.y);',
    '  glow *= smoothstep(0.3, 0.8, glowMask);',

    '  float pulseDist = length(p);',
    '  float pulse = 0.5 + 0.5 * sin(pulseDist * 0.72 - iTime * uSpeed * 1.5 + noiseDist * 2.0);',

    '  float finalAlpha = (gridAlpha * 0.3) + (intersections * 0.8) + (glow * 0.6);',
    '  finalAlpha *= (0.6 + 0.4 * snoise(p * uNoise * 2.7 - iTime * uSpeed * 0.5));',
    '  finalAlpha += finalAlpha * pulse * 0.4;',

    '  float mouseGlow = smoothstep(uHoverLightRadius, 0.0, mouseDist) * 0.6 * uMouseActive;',
    '  finalAlpha += mouseGlow * gridAlpha;',

    '  float vignette = 1.0 - smoothstep(1.0, uFadeFalloff, pulseDist);',
    '  float breathing = 0.8 + 0.2 * sin(iTime * uSpeed * 0.8);',

    '  float a = clamp(finalAlpha * vignette * breathing, 0.0, 1.0);',
    '  gl_FragColor = vec4(uColor * a, a);',  // alpha pré-multiplicado
    '}'
  ].join('\n');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function hexToRgb(hex) {
    var h = String(hex || '').trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (h.length !== 6 || isNaN(n)) return [0.51, 0.87, 0.28];  // fallback: --lime
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function num(v, fb) { var n = parseFloat(v); return isNaN(n) ? fb : n; }

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
    return s;
  }

  var instances = [];
  var running = false;
  var t0 = 0;        // origem do relógio, corrigida a cada retomada
  var tLast = 0;     // tempo acumulado — evita salto ao voltar de uma pausa

  function Bloom(canvas) {
    var d = canvas.dataset;
    var gl = canvas.getContext('webgl', {
      alpha: true, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: true, powerPreference: 'low-power'
    }) || canvas.getContext('experimental-webgl');
    if (!gl) return null;

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var u = {};
    ['iTime', 'iResolution', 'iMouse', 'uOffset', 'uCenter', 'uMouseActive', 'uColor',
     'uSpeed', 'uCell', 'uRotationSpeed', 'uFadeFalloff', 'uNoise', 'uDistortionAmount',
     'uFlowSpeedX', 'uFlowSpeedY', 'uHoverRepulsionRadius', 'uHoverRepulsionStrength',
     'uHoverLightRadius'
    ].forEach(function (k) { u[k] = gl.getUniformLocation(prog, k); });

    var c = hexToRgb(d.color || '#82DD47');
    gl.uniform3f(u.uColor, c[0], c[1], c[2]);
    gl.uniform1f(u.uSpeed, num(d.speed, 1.0));
    gl.uniform1f(u.uRotationSpeed, num(d.rotation, 0.0));
    gl.uniform1f(u.uFadeFalloff, num(d.fade, 40.0));
    gl.uniform1f(u.uNoise, num(d.noise, 0.13));
    gl.uniform1f(u.uDistortionAmount, num(d.distortion, 0.6));
    gl.uniform1f(u.uFlowSpeedX, num(d.flowX, -0.12));
    gl.uniform1f(u.uFlowSpeedY, num(d.flowY, -0.24));
    gl.uniform1f(u.uHoverLightRadius, num(d.hoverLight, 5.0));
    gl.uniform1f(u.uHoverRepulsionRadius, num(d.hoverRadius, 10.0));
    gl.uniform1f(u.uHoverRepulsionStrength, num(d.hoverStrength, 0.6));

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    var self = {
      canvas: canvas, gl: gl, u: u, visible: false, w: 0, h: 0, dpr: 1,
      cell: num(d.cell, 44),
      linked: d.link !== undefined,
      mouse: { x: -9999, y: -9999, tx: -9999, ty: -9999, a: 0, ta: 0 },
      interactive: d.mouse !== 'off' && !reduceMotion
    };

    self.resize = function () {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.round(canvas.clientWidth * dpr);
      var h = Math.round(canvas.clientHeight * dpr);
      if (!w || !h || (w === self.w && h === self.h)) return;
      self.w = canvas.width = w;
      self.h = canvas.height = h;
      self.dpr = dpr;
      gl.viewport(0, 0, w, h);
      gl.useProgram(prog);
      gl.uniform2f(u.iResolution, w, h);
      gl.uniform1f(u.uCell, self.cell * dpr);
    };

    self.draw = function (time) {
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      /* painel "linkado": a origem é o centro da janela, então a malha
         atravessa a emenda entre a barra, o menu e o rodapé sem degrau */
      if (self.linked) {
        var r = canvas.getBoundingClientRect();
        gl.uniform2f(u.uOffset, r.left * self.dpr,
                                (window.innerHeight - r.bottom) * self.dpr);
        gl.uniform2f(u.uCenter, window.innerWidth * self.dpr / 2,
                                window.innerHeight * self.dpr / 2);
      } else {
        gl.uniform2f(u.uOffset, 0, 0);
        gl.uniform2f(u.uCenter, self.w / 2, self.h / 2);
      }

      var mo = self.mouse;
      mo.x += (mo.tx - mo.x) * 0.1;
      mo.y += (mo.ty - mo.y) * 0.1;
      mo.a += (mo.ta - mo.a) * 0.15;
      gl.uniform1f(u.iTime, time);
      gl.uniform2f(u.iMouse, mo.x * self.dpr, mo.y * self.dpr);
      gl.uniform1f(u.uMouseActive, mo.a);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    return self;
  }

  function frame(now) {
    if (!running) return;
    var t = tLast = (now - t0) / 1000;
    var any = false;
    for (var i = 0; i < instances.length; i++) {
      var b = instances[i];
      if (!b.visible) continue;
      any = true;
      b.resize();          // no-op quando o tamanho não mudou
      if (b.w && b.h) b.draw(t);
    }
    if (any) requestAnimationFrame(frame);
    else running = false;
  }

  function kick() {
    if (running || document.hidden) return;
    if (!instances.some(function (b) { return b.visible; })) return;
    running = true;
    t0 = performance.now() - tLast * 1000;
    requestAnimationFrame(frame);
  }

  function init() {
    var nodes = document.querySelectorAll('canvas.bloom');
    if (!nodes.length) return;

    for (var i = 0; i < nodes.length; i++) {
      var b = Bloom(nodes[i]);
      if (b) { instances.push(b); nodes[i].classList.add('bloom-on'); }
    }
    if (!instances.length) return;

    // movimento reduzido: um quadro estático, sem loop
    if (reduceMotion) {
      var still = function () {
        instances.forEach(function (b) { b.resize(); if (b.w) b.draw(6.0); });
      };
      still();
      window.addEventListener('resize', still);
      return;
    }

    // só anima o que está na tela (views escondidas e gate fechado ficam parados)
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          for (var i = 0; i < instances.length; i++) {
            if (instances[i].canvas === e.target) instances[i].visible = e.isIntersecting;
          }
        });
        kick();
      }, { threshold: 0 });
      instances.forEach(function (b) { io.observe(b.canvas); });
    } else {
      instances.forEach(function (b) { b.visible = true; });
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) running = false; else kick();
    });

    window.addEventListener('pointermove', function (e) {
      for (var i = 0; i < instances.length; i++) {
        var b = instances[i];
        if (!b.interactive || !b.visible) continue;
        var r = b.canvas.getBoundingClientRect();
        var inside = e.clientX >= r.left && e.clientX <= r.right &&
                     e.clientY >= r.top && e.clientY <= r.bottom;
        b.mouse.ta = inside ? 1 : 0;
        if (inside) { b.mouse.tx = e.clientX - r.left; b.mouse.ty = r.bottom - e.clientY; }
      }
    }, { passive: true });

    document.addEventListener('pointerleave', function () {
      instances.forEach(function (b) { b.mouse.ta = 0; });
    });

    kick();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
