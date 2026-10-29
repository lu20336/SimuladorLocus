/* Escenas animadas del simulador de Locus (canvas 2D, sin dependencias).
 * Cada prueba tiene su PROPIA escena: personajes, objetos y acciones distintas.
 * Las escenas ilustran QUÉ se comprueba; nunca deciden ni inventan el resultado:
 * el veredicto (✓ / ✕) solo aparece cuando llega `p.reveal` desde el modelo.
 *
 * draw(kind, ctx, W, H, p, pal)
 *   kind: 'users' (escenarios) | 'P1'…'P12' (pruebas del modelo)
 *   p: { ms, durMs, waiting, static, reduced, reveal, params }
 *      ms      tiempo real transcurrido desde que empezó la prueba
 *      waiting la animación ya duró lo previsto y se espera el resultado real
 *      static  prueba terminada o sin ejecutar: se dibuja la pose final, sin movimiento
 *      reveal  tests: 'pass' | 'fail' | null · escenarios: {best, A:{ok,short}, B:…, C:…} | null */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LocusScenes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var TAU = 6.2832, VH = 420;
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function seg(u, a, b) { return clamp((u - a) / (b - a), 0, 1); }
  function ease(x) { return x * x * (3 - 2 * x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hash(n, k) { var x = Math.sin(n * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); }
  function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function txt(c, s, x, y, o) { o = o || {}; c.font = (o.w || 600) + ' ' + (o.s || 14) + 'px Inter,system-ui,sans-serif'; c.fillStyle = o.c || '#000'; c.textAlign = o.a || 'left'; c.textBaseline = o.b || 'middle'; c.fillText(s, x, y); }
  function circ(c, x, y, r, f, s, lw) { c.beginPath(); c.arc(x, y, r, 0, TAU); if (f) { c.fillStyle = f; c.fill(); } if (s) { c.strokeStyle = s; c.lineWidth = lw || 1.5; c.stroke(); } }
  function line(c, x1, y1, x2, y2, col, lw, dash) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = col; c.lineWidth = lw || 1.5; c.setLineDash(dash || []); c.stroke(); c.setLineDash([]); }
  function alpha(c, a, fn) { c.save(); c.globalAlpha = a; fn(); c.restore(); }
  function pos(a, b, t) { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }; }

  var SKIN = ['#F1C9A5', '#D9A47A', '#B9805A', '#8D5A3B'], SHIRT = ['#E8484E', '#00796F', '#5256C8', '#C85A14', '#1E6FD9', '#D4A017', '#7A4FB3', '#2E8B57'], HAIR = ['#2B1B12', '#5A3A22', '#111111', '#8A5A2B', '#C9A25A'];

  /* Personaje: pies en (x,y), unos 44 px de alto con sc = 1. o: {walk, face, arm:'phone'|'wave'|'point'|'none', bag, still, shirt} */
  function person(G, x, y, sc, i, o) {
    o = o || {}; var c = G.c, w = o.walk || 0, sk = SKIN[i % 4], sh = o.shirt || SHIRT[i % 8], hr = HAIR[(i * 3) % 5];
    var bob = o.still ? 0 : Math.abs(Math.sin(w)) * 2 * sc, lx = o.still ? 0 : Math.sin(w) * 5 * sc;
    c.save(); c.translate(x, y); if (o.face < 0) c.scale(-1, 1);
    c.fillStyle = 'rgba(0,0,0,.13)'; c.beginPath(); c.ellipse(0, 1, 9 * sc, 3 * sc, 0, 0, TAU); c.fill();
    c.strokeStyle = '#27405F'; c.lineWidth = 4 * sc; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-3 * sc, -14 * sc - bob); c.lineTo(-3 * sc + lx, 0); c.moveTo(3 * sc, -14 * sc - bob); c.lineTo(3 * sc - lx, 0); c.stroke();
    c.fillStyle = sh; rr(c, -7 * sc, -32 * sc - bob, 14 * sc, 19 * sc, 5 * sc); c.fill();
    if (o.bag) { c.fillStyle = 'rgba(0,0,0,.28)'; rr(c, -11 * sc, -30 * sc - bob, 6 * sc, 13 * sc, 2 * sc); c.fill(); }
    c.strokeStyle = sk; c.lineWidth = 3.2 * sc; c.beginPath(); c.moveTo(5 * sc, -29 * sc - bob);
    if (o.arm === 'phone') { c.lineTo(11 * sc, -26 * sc - bob); c.lineTo(11 * sc, -36 * sc - bob); c.stroke(); c.fillStyle = '#12263F'; rr(c, 9 * sc, -43 * sc - bob, 5.5 * sc, 9.5 * sc, 1.5 * sc); c.fill(); c.fillStyle = '#7FD6FF'; c.fillRect(10 * sc, -41.5 * sc - bob, 3.5 * sc, 6 * sc); }
    else if (o.arm === 'wave') { c.lineTo(10 * sc, (-40 + (o.still ? 0 : Math.sin(G.L / 130 + i) * 4)) * sc - bob); c.stroke(); }
    else if (o.arm === 'point') { c.lineTo(15 * sc, (-30 + (o.still ? 0 : Math.sin(G.L / 260 + i) * 2)) * sc - bob); c.stroke(); }
    else { c.lineTo(8 * sc, (-20 + (o.still ? 0 : Math.sin(w + 3) * 3)) * sc - bob); c.stroke(); }
    c.fillStyle = sk; c.beginPath(); c.arc(0, -40 * sc - bob, 7 * sc, 0, TAU); c.fill();
    c.fillStyle = hr; c.beginPath(); c.arc(0, -42 * sc - bob, 7.3 * sc, Math.PI, TAU); c.fill();
    c.restore();
  }
  function serverBox(G, x, y, w, h, col, load, label) {
    var c = G.c, P = G.pal; rr(c, x, y, w, h, 8); c.fillStyle = P.surface; c.fill(); c.strokeStyle = col; c.lineWidth = 2; c.stroke();
    var rows = 3, rh = (h - 14) / rows;
    for (var i = 0; i < rows; i++) {
      rr(c, x + 6, y + 6 + i * rh, w - 12, rh - 4, 3); c.fillStyle = P.surface2; c.fill();
      var on = load > 0 && (G.anim ? Math.sin(G.L / (120 + i * 40) + i * 2) > -0.2 : true);
      circ(c, x + w - 13, y + 6 + i * rh + (rh - 4) / 2, 2.6, on ? col : P.line);
      c.fillStyle = P.line; c.fillRect(x + 11, y + 6 + i * rh + (rh - 4) / 2 - 1, w * 0.34, 2);
    }
    if (label) txt(c, label, x + w / 2, y + h + 13, { s: 13, c: P.ink, a: 'center', w: 700 });
  }
  function globe(G, x, y, r, label) {
    var c = G.c, P = G.pal; circ(c, x, y, r, P.surface, P.muted, 2);
    c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
    c.strokeStyle = P.line; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(x, y, r * 0.45, r, 0, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(x - r, y); c.lineTo(x + r, y); c.moveTo(x - r, y - r * 0.5); c.lineTo(x + r, y - r * 0.5); c.moveTo(x - r, y + r * 0.5); c.lineTo(x + r, y + r * 0.5); c.stroke();
    c.restore();
    if (label) txt(c, label, x, y + r + 14, { s: 13, c: P.ink, a: 'center', w: 700 });
  }
  function phoneIcon(G, x, y, w, h, screenFn) {
    var c = G.c; rr(c, x, y, w, h, 7); c.fillStyle = '#12263F'; c.fill(); rr(c, x + 3, y + 8, w - 6, h - 16, 3); c.fillStyle = G.pal.surface; c.fill();
    if (screenFn) { c.save(); rr(c, x + 3, y + 8, w - 6, h - 16, 3); c.clip(); screenFn(x + 3, y + 8, w - 6, h - 16); c.restore(); }
  }
  function badge(G, x, y, ok, label) {
    var c = G.c, P = G.pal, col = ok ? P.ok : P.bad; c.font = '700 14px Inter,system-ui,sans-serif';
    var s = (ok ? '✓ ' : '✕ ') + label, w = c.measureText(s).width + 20;
    rr(c, x - w / 2, y - 12, w, 24, 12); c.globalAlpha = 0.16; c.fillStyle = col; c.fill(); c.globalAlpha = 1; c.strokeStyle = col; c.lineWidth = 1.5; c.stroke();
    txt(c, s, x, y + 1, { s: 14, c: col, a: 'center', w: 700 });
  }
  function bars(G, x, y, n, on, col) { var c = G.c; for (var i = 0; i < 4; i++) { var h = 5 + i * 4; c.fillStyle = i < n ? col : G.pal.line; rr(c, x + i * 7, y - h, 5, h, 1.5); c.fill(); } }
  function coin(G, x, y, r) { var c = G.c; circ(c, x, y, r, '#E7B416', '#B88708', 1.5); txt(c, '$', x, y + 1, { s: r * 1.2, c: '#7A5A00', a: 'center', w: 800 }); }
  function ground(G, y) { var c = G.c, P = G.pal; c.fillStyle = P.line; c.globalAlpha = 0.45; c.fillRect(0, y, G.vw, VH - y); c.globalAlpha = 1; line(c, 0, y, G.vw, y, P.line, 2); }
  function cloud(G, x, y, s) { var c = G.c; c.fillStyle = G.pal.surface; c.beginPath(); c.arc(x, y, 12 * s, 0, TAU); c.arc(x + 14 * s, y - 6 * s, 15 * s, 0, TAU); c.arc(x + 30 * s, y, 12 * s, 0, TAU); c.fill(); }
  function browser(G, x, y, w, h, url) {
    var c = G.c, P = G.pal; rr(c, x, y, w, h, 10); c.fillStyle = P.surface; c.fill(); c.strokeStyle = P.muted; c.lineWidth = 1.5; c.stroke();
    c.save(); rr(c, x, y, w, h, 10); c.clip(); c.fillStyle = P.surface2; c.fillRect(x, y, w, 22); c.restore();
    circ(c, x + 11, y + 11, 3.2, '#E8484E'); circ(c, x + 22, y + 11, 3.2, '#E7B416'); circ(c, x + 33, y + 11, 3.2, '#2E8B57');
    rr(c, x + 46, y + 5, w - 56, 12, 6); c.fillStyle = P.surface; c.fill(); txt(c, url || 'locus.app', x + 54, y + 11.5, { s: 10, c: P.muted, w: 500 });
  }
  function stopwatch(G, x, y, r, a) { var c = G.c, P = G.pal; circ(c, x, y, r, P.surface, P.ink, 2.5); rr(c, x - 4, y - r - 7, 8, 6, 2); c.fillStyle = P.ink; c.fill(); for (var i = 0; i < 12; i++) { var an = i / 12 * TAU; line(c, x + Math.sin(an) * (r - 4), y - Math.cos(an) * (r - 4), x + Math.sin(an) * (r - 1), y - Math.cos(an) * (r - 1), P.muted, 1.2); } line(c, x, y, x + Math.sin(a) * (r - 6), y - Math.cos(a) * (r - 6), P.bad, 2.4); circ(c, x, y, 2.5, P.ink); }
  function lock(G, x, y, s, col) { var c = G.c; c.strokeStyle = col; c.lineWidth = 2.4 * s; c.beginPath(); c.arc(x, y - 4 * s, 5 * s, Math.PI, 0); c.stroke(); rr(c, x - 7 * s, y - 4 * s, 14 * s, 11 * s, 2.5 * s); c.fillStyle = col; c.fill(); }
  function envelope(G, x, y, col) { var c = G.c; c.fillStyle = col; rr(c, x - 6, y - 4.5, 12, 9, 2); c.fill(); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - 5.5, y - 3.5); c.lineTo(x, y + 1); c.lineTo(x + 5.5, y - 3.5); c.stroke(); }
  function trail(G, a, b, col, dash) { line(G.c, a.x, a.y, b.x, b.y, col || G.pal.line, 2, dash || [5, 5]); }

  /* ---------- reloj de la historia ---------- */
  function clock(p) {
    var d = p.durMs || 5000, ms = p.ms || 0;
    if (p.static) return { u: 1, L: 0, anim: false };
    if (p.reduced) return { u: 0.62, L: 0, anim: false };
    if (ms < d) return { u: ms / d, L: ms, anim: true };
    return { u: 0.28 + (((ms - d) / (d * 0.75)) % 1) * 0.5, L: ms, anim: true };
  }

  /* ================= ESCENARIOS: usuarios entran a la página de viajes ================= */
  function sceneUsers(G, p) {
    var c = G.c, P = G.pal, vw = G.vw, u = G.u, par = p.params || { users: 100, reqPerMin: 2, hit: 0.4, rtt: 80, pois: 20 };
    var wide = vw > 650, gY = 322; ground(G, gY);
    var bx = vw * 0.31, bw = vw * (wide ? 0.27 : 0.3), by = 36, bh = 238, ex = bx + bw;
    cloud(G, vw * 0.1, 96, 0.8); cloud(G, vw * 0.52, 20, 0.6);
    /* calle y cartel */
    
    /* página de viajes */
    browser(G, bx, by, bw, bh, 'locus.app/itinerario');
    var cx = bx + 10, cw = bw - 20;
    c.fillStyle = P.teal; c.beginPath(); c.arc(cx + 9, by + 38, 7, 0, TAU); c.fill(); txt(c, 'Locus', cx + 22, by + 38, { s: 14, c: P.ink, w: 800 });
    rr(c, cx, by + 52, cw, 24, 12); c.fillStyle = P.surface2; c.fill(); c.strokeStyle = P.line; c.lineWidth = 1; c.stroke();
    var dests = ['Cartagena', 'Salento', 'Santa Marta', 'Medellín'], di = Math.floor((G.L / 1600)) % 4, tl = Math.floor(((G.L % 1600) / 1600) * 22);
    var typed = G.anim ? dests[di].slice(0, Math.min(dests[di].length, tl)) : 'Cartagena';
    txt(c, '🔍', cx + 9, by + 64.5, { s: 11 }); txt(c, typed + (G.anim && Math.floor(G.L / 350) % 2 ? '|' : ''), cx + 26, by + 64.5, { s: 12, c: P.ink, w: 500 });
    var nCards = clamp(Math.round(par.pois / 5), 2, 6), cols = 2, cw2 = (cw - 8) / cols, ch = 40;
    for (var k = 0; k < nCards; k++) {
      var col = k % cols, row = Math.floor(k / cols), x0 = cx + col * (cw2 + 8), y0 = by + 88 + row * (ch + 8), ap = ease(seg(u, 0.1 + k * 0.06, 0.2 + k * 0.06)), sel = G.anim && Math.floor(G.L / 700) % nCards === k;
      alpha(c, ap, function () { rr(c, x0, y0 + (1 - ap) * 8, cw2, ch, 7); c.fillStyle = P.surface; c.fill(); c.strokeStyle = sel ? P.teal : P.line; c.lineWidth = sel ? 2.2 : 1; c.stroke(); c.fillStyle = [P.A, P.B, P.C][k % 3]; rr(c, x0 + 5, y0 + 5 + (1 - ap) * 8, 30, 30, 5); c.globalAlpha = ap * 0.35; c.fill(); c.globalAlpha = ap; c.fillStyle = P.line; c.fillRect(x0 + 41, y0 + 12 + (1 - ap) * 8, cw2 - 50, 4); c.fillRect(x0 + 41, y0 + 22 + (1 - ap) * 8, (cw2 - 50) * 0.6, 4); });
    }
    txt(c, nCards * 5 >= par.pois ? par.pois + ' lugares' : par.pois + ' lugares (se muestran ' + nCards + ')', cx, by + bh - 12, { s: 11, c: P.muted, w: 500 });
    /* personas */
    var N = Math.min(12, Math.max(2, par.users)), per = Math.ceil(par.users / N), ramp = G.anim || G.u > 0.9 ? 1 : 1, arrived = 0;
    var slotsX0 = vw * 0.04, slotsW = bx - vw * 0.04 - 8;
    for (var i = 0; i < N; i++) {
      var tIn = 0.04 + 0.52 * Math.pow(i / N, 0.85), walkDur = 0.2, w = seg(u, tIn, tIn + walkDur), row = i % 2, col2 = Math.floor(i / 2), maxCols = Math.ceil(N / 2);
      var tx = slotsX0 + 10 + (maxCols > 1 ? (col2 / (maxCols - 1)) : 0.5) * (slotsW - 26) + row * 12, ty = gY + 28 + row * 36;
      var sx = -24, x = lerp(sx, tx, ease(w)), moving = w > 0 && w < 1;
      if (w >= 1) arrived++;
      if (w <= 0) continue;
      var walk = moving ? G.L / 85 + i : 0;
      person(G, x, ty, 1.2, i, { walk: walk, still: !moving, arm: moving ? 'none' : 'phone', bag: i % 3 === 0 });
      if (!moving && G.anim) { var tap = (G.L / 900 + hash(i, 3) * 5) % 3; if (tap < 0.5) { circ(c, x + 15, ty - 62, 4 + tap * 14, null, P.teal, 1.6); } }
    }
    var connected = Math.min(par.users, Math.round(par.users * arrived / N));
    rr(c, 8, 8, 168, 26, 13); c.fillStyle = P.surface; c.fill(); c.strokeStyle = P.line; c.lineWidth = 1; c.stroke();
    txt(c, '👥 ' + connected.toLocaleString('es-CO') + ' de ' + par.users.toLocaleString('es-CO') + ' conectados', 18, 21.5, { s: 12.5, c: P.ink, w: 700 });
    if (per > 1) txt(c, 'cada persona dibujada ≈ ' + per, 12, 48, { s: 11, c: P.muted, w: 500 });
    /* arquitecturas */
    var lanes = [{ k: 'A', y: 90, col: P.A, name: 'A · Cliente directo' }, { k: 'B', y: 182, col: P.B, name: 'B · Monolito + caché' }, { k: 'C', y: 274, col: P.C, name: 'C · Microservicios' }];
    var nodeX = ex + (vw - ex) * 0.32, gx = vw - 28, gy = 182, hitEff = par.hit;
    var lam = par.users * par.reqPerMin / 60, vr = clamp(2 + Math.log10(1 + lam) * 4.5, 2, 13) * (G.anim ? 1 : 0);
    lanes.forEach(function (ln, li) {
      alpha(c, 0.08, function () { rr(c, ex + 8, ln.y - 40, vw - ex - 8 - 4, 80, 10); c.fillStyle = ln.col; c.fill(); });
      txt(c, ln.name, ex + 16, ln.y - 31, { s: 11.5, c: ln.col, w: 800 });
      var nx = nodeX;
      if (ln.k === 'A') { phoneIcon(G, nx - 11, ln.y - 24, 22, 40, null); txt(c, 'sin servidor', nx, ln.y + 28, { s: 11, c: P.muted, a: 'center' }); }
      else if (ln.k === 'B') serverBox(G, nx - 18, ln.y - 24, 36, 44, ln.col, 1, null);
      else { serverBox(G, nx - 34, ln.y - 22, 30, 40, ln.col, 1, null); serverBox(G, nx + 4, ln.y - 22, 30, 40, ln.col, 1, null); }
      line(c, ex, 150, ex + 10, ln.y, P.line, 1.5);
      line(c, nx + (ln.k === 'C' ? 34 : 20), ln.y, gx - 17, gy + (ln.y - gy) * 0.35, P.line, 1.4, [4, 4]);
      /* solicitudes */
      var T = u * p.durMs;
      for (var n = 0; vr > 0 && n < 90; n++) {
        var st = (n + hash(n, li)) / vr * 1000, rel = (G.L - st), eff = ln.k === 'A' ? hitEff * 0.35 : hitEff;
        if (rel < 0 || rel > 3200 || hash(n, li + 7) > clamp(st / (p.durMs * 0.5), 0.15, 1)) continue;
        var hit = hash(n, li + 3) < eff, from = { x: ex, y: 140 + li * 10 }, node = { x: nx, y: ln.y }, far = { x: gx - 20, y: gy + (ln.y - gy) * 0.35 };
        var leg1 = 520, leg2 = hit ? 0 : 560 + par.rtt * 0.8, leg3 = hit ? 0 : 560 + par.rtt * 0.8, leg4 = 520, tot = leg1 + leg2 + leg3 + leg4;
        if (rel > tot) continue;
        var pp, colr = ln.col;
        if (rel < leg1) pp = pos(from, node, rel / leg1);
        else if (rel < leg1 + leg2) { pp = pos(node, far, (rel - leg1) / leg2); }
        else if (rel < leg1 + leg2 + leg3) { pp = pos(far, node, (rel - leg1 - leg2) / leg3); colr = P.muted; }
        else { pp = pos(node, from, (rel - leg1 - leg2 - leg3) / leg4); colr = hit ? P.ok : P.muted; }
        if (hit && rel > leg1) { pp = pos(node, from, (rel - leg1) / (tot - leg1)); colr = P.ok; }
        c.save(); c.shadowColor = colr; c.shadowBlur = 6; circ(c, pp.x, pp.y, 3.2, colr); c.restore();
      }
      var rv = p.reveal && p.reveal[ln.k];
      if (rv) { badge(G, ex + (vw - ex) * 0.63, ln.y + 24, rv.ok, rv.short); if (p.reveal.best === ln.k) txt(c, '★ Recomendada', ex + (vw - ex) * 0.63, ln.y - 8, { s: 11.5, c: P.ok, a: 'center', w: 800 }); }
    });
    globe(G, gx, gy, 17, 'OSM');
    /* caché compartido: etiqueta */
    txt(c, 'caché ' + Math.round(par.hit * 100) + ' % · celular ' + par.rtt + ' ms', vw * 0.03, VH - 8, { s: 11.5, c: P.muted, w: 600 });
    txt(c, '● solicitud   ● respuesta del caché   ● respuesta del mapa', vw - 12, VH - 10, { s: 11, c: P.muted, a: 'right', w: 500 });
  }

  /* ================= P1 · cálculo del simulador = cálculo a mano ================= */
  function sceneP1(G, p) {
    var c = G.c, P = G.pal, vw = G.vw, u = G.u; ground(G, 330);
    var lx = vw * 0.06, rx = vw * 0.6, w = vw * 0.34;
    /* simulador */
    rr(c, lx, 90, w, 150, 12); c.fillStyle = P.surface; c.fill(); c.strokeStyle = P.teal; c.lineWidth = 2.2; c.stroke();
    txt(c, 'El simulador', lx + w / 2, 76, { s: 14, c: P.teal, a: 'center', w: 800 });
    var f = 'R = D / (1 − ρ)', nch = Math.floor(f.length * ease(seg(u, 0.05, 0.5)));
    txt(c, f.slice(0, nch), lx + w / 2, 135, { s: 22, c: P.ink, a: 'center', w: 700 });
    for (var g = 0; g < 2; g++) { var gx = lx + 40 + g * 46, gy = 200, ang = G.L / 400 * (g ? -1 : 1); c.save(); c.translate(gx, gy); c.rotate(ang); for (var t = 0; t < 8; t++) { c.rotate(TAU / 8); c.fillStyle = P.teal; c.fillRect(-3, -17, 6, 8); } circ(c, 0, 0, 12, P.teal); circ(c, 0, 0, 5, P.surface); c.restore(); }
    rr(c, lx + w - 78, 182, 62, 38, 6); c.fillStyle = P.surface2; c.fill(); txt(c, seg(u, 0.5, 0.78) > 0 ? (u > 0.9 || G.static ? '= ✓' : '…') : '…', lx + w - 47, 201, { s: 18, c: P.ink, a: 'center', w: 800 });
    /* a mano */
    rr(c, rx, 90, w, 150, 12); c.fillStyle = P.surface; c.fill(); c.strokeStyle = P.A; c.lineWidth = 2.2; c.stroke();
    txt(c, 'A mano', rx + w / 2, 76, { s: 14, c: P.A, a: 'center', w: 800 });
    for (var l = 0; l < 4; l++) { var lw = ease(seg(u, 0.12 + l * 0.12, 0.26 + l * 0.12)) * (w - 70); c.fillStyle = P.line; c.fillRect(rx + 16, 110 + l * 22, lw, 4); }
    var pen = ease(seg(u, 0.1, 0.58)); var penX = rx + 16 + pen * (w - 70) * (G.anim ? (0.9 + Math.sin(G.L / 120) * 0.1) : 1), penY = 110 + Math.floor(pen * 3.9) * 22;
    line(c, penX, penY - 2, penX + 12, penY - 16, P.ink, 3); c.lineCap = 'round';
    rr(c, rx + w - 70, 182, 54, 40, 6); c.fillStyle = '#12263F'; c.fill(); for (var k = 0; k < 9; k++) { c.fillStyle = (G.anim && Math.floor(G.L / 260) % 9 === k) ? P.teal : '#3D5878'; c.fillRect(rx + w - 65 + (k % 3) * 16, 196 + Math.floor(k / 3) * 8, 12, 5); }
    person(G, rx + w + 14, 330, 1.45, 2, { arm: 'point', still: !G.anim });
    /* balanza */
    var cx = vw * 0.5, cy = 270, tilt = (G.anim && u < 0.78 ? Math.sin(G.L / 380) * 0.16 * (1 - seg(u, 0.5, 0.78)) : 0);
    rr(c, cx - 5, cy, 10, 60, 3); c.fillStyle = P.muted; c.fill(); rr(c, cx - 30, 326, 60, 7, 3); c.fill();
    c.save(); c.translate(cx, cy); c.rotate(tilt); line(c, -48, 0, 48, 0, P.ink, 4); [-48, 48].forEach(function (sx) { line(c, sx, 0, sx, 18, P.muted, 1.5); circ(c, sx, 0, 3, P.ink); alpha(c, 1, function () { rr(c, sx - 20, 18, 40, 8, 4); c.fillStyle = P.ink; c.fill(); rr(c, sx - 14, -8 + 18 - 22, 28, 22, 5); c.fillStyle = sx < 0 ? P.teal : P.A; c.globalAlpha = 0.9; c.fill(); c.globalAlpha = 1; txt(c, '?', sx, 18 - 19 + 0.5 - 0, { s: 15, c: '#fff', a: 'center', w: 800 }); }); }); c.restore();
    txt(c, p.reveal ? (p.reveal === 'pass' ? '=' : '≠') : '=  ?', cx, 232, { s: 26, c: p.reveal === 'fail' ? P.bad : P.ink, a: 'center', w: 800 });
  }

  /* ================= P8 · mismo escenario, mismos números (sin azar) ================= */
  function sceneP8(G, p) {
    var c = G.c, P = G.pal, vw = G.vw, u = G.u; ground(G, 330);
    var xs = [vw * 0.05, vw * 0.55], mw = vw * 0.4;
    for (var m = 0; m < 2; m++) {
      var x = xs[m], col = m ? P.B : P.A;
      txt(c, 'Ejecución ' + (m + 1), x + mw / 2, 52, { s: 14, c: col, a: 'center', w: 800 });
      rr(c, x, 150, mw, 100, 12); c.fillStyle = P.surface; c.fill(); c.strokeStyle = col; c.lineWidth = 2.2; c.stroke();
      var gx = x + mw / 2, gy = 200; c.save(); c.translate(gx, gy); c.rotate(G.L / 350 * (m ? -1 : 1)); for (var t = 0; t < 10; t++) { c.rotate(TAU / 10); c.fillStyle = col; c.fillRect(-3.5, -24, 7, 9); } circ(c, 0, 0, 17, col); circ(c, 0, 0, 7, P.surface); c.restore();
      circ(c, x + 14, 164, 4, G.anim && Math.floor(G.L / 250) % 2 ? P.ok : P.line);
      /* cinta */
      rr(c, x - 10, 262, mw + 20, 12, 6); c.fillStyle = '#34495F'; c.fill(); for (var s = 0; s < 14; s++) { var sx = x - 6 + ((s * (mw + 20) / 14 + (G.anim ? G.L / 12 : 0)) % (mw + 20)); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(Math.min(sx, x + mw + 6), 266, 4, 4); }
      /* tarjeta de entrada: igual en las dos */
      var inT = ease(seg(u, 0.05, 0.4)), cardX = lerp(x - 40, x + mw * 0.3, inT);
      if (u < 0.5) { rr(c, cardX - 22, 224, 44, 34, 5); c.fillStyle = P.surface2; c.fill(); c.strokeStyle = P.ink; c.lineWidth = 1.5; c.stroke(); for (var d = 0; d < 3; d++) circ(c, cardX - 10 + d * 10, 241, 3, P.ink); }
      /* salida: ticket (idéntico en las dos ejecuciones) */
      if (u >= 0.5) {
        var e1 = ease(seg(u, 0.5, 0.74)), e2 = ease(seg(u, 0.78, 0.95)), sx0 = lerp(x + mw * 0.5, x + mw * (m ? 0.3 : 0.7), e1), sy0 = lerp(222, 244, e1);
        var fx = vw / 2 + (m ? 34 : -34), px = lerp(sx0, fx, e2), py = lerp(sy0, 306, e2);
        rr(c, px - 26, py - 22, 52, 44, 6); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = col; c.lineWidth = 2.4; c.stroke();
        for (var q = 0; q < 3; q++) { c.fillStyle = '#9AA9BA'; c.fillRect(px - 18, py - 14 + q * 10, 36 - q * 6, 4); } txt(c, '#', px, py + 14, { s: 12, c: col, a: 'center', w: 800 });
      }
      person(G, x + (m ? mw + 22 : -22) , 330, 1.5, m ? 3 : 0, { arm: 'point', face: m ? -1 : 1, still: !G.anim });
    }
    /* dado tachado */
    var dx = vw / 2, dy = 70; rr(c, dx - 20, dy - 20, 40, 40, 8); c.fillStyle = P.surface; c.fill(); c.strokeStyle = P.muted; c.lineWidth = 2; c.stroke(); [[-8, -8], [8, 8], [0, 0], [-8, 8], [8, -8]].forEach(function (o) { circ(c, dx + o[0], dy + o[1], 2.6, P.muted); });
    line(c, dx - 26, dy + 26, dx + 26, dy - 26, P.bad, 4); txt(c, 'sin azar', dx, dy + 38, { s: 12.5, c: P.muted, a: 'center', w: 700 });
    if (u > 0.92 || G.static) txt(c, p.reveal === 'fail' ? '≠' : '=', vw / 2, 306, { s: 32, c: p.reveal === 'fail' ? P.bad : P.ok, a: 'center', w: 800 });
  }

  /* ================= P2 · la señal del celular empeora → la app tarda más ================= */
  function sceneP2(G, p) {
    var c = G.c, P = G.pal, vw = G.vw, u = G.u; ground(G, 348);
    c.fillStyle = '#2E8B57'; c.globalAlpha = 0.22; c.beginPath(); c.moveTo(vw * 0.35, 348); c.quadraticCurveTo(vw * 0.62, 140, vw, 348); c.fill(); c.globalAlpha = 1;
    c.fillStyle = '#2E8B57'; c.globalAlpha = 0.14; c.beginPath(); c.moveTo(vw * 0.2, 348); c.quadraticCurveTo(vw * 0.5, 200, vw * 0.8, 348); c.fill(); c.globalAlpha = 1;
    var tx = vw * 0.08; line(c, tx, 348, tx, 150, P.ink, 4); line(c, tx - 12, 348, tx, 150, P.ink, 2); line(c, tx + 12, 348, tx, 150, P.ink, 2); circ(c, tx, 146, 6, P.bad);
    var prog = ease(seg(u, 0.08, 0.85)), sig = Math.max(1, Math.round(lerp(4, 1, prog)));
    for (var w = 0; w < 4; w++) { var rad = 22 + w * 16 + (G.anim ? (G.L / 22 % 16) : 0); alpha(c, clamp(sig / 4 - w * 0.08, 0.1, 0.6) * (1 - (rad - 22) / 80), function () { c.beginPath(); c.arc(tx, 146, rad, -0.9, 0.9); c.strokeStyle = P.bad; c.lineWidth = 2; c.stroke(); }); }
    var px = lerp(vw * 0.25, vw * 0.78, prog), py = 348 - Math.sin(prog * 3.1) * 70 * 0.9 - prog * 40;
    py = 348 - (1 - Math.pow(1 - prog, 2)) * 0 - prog * 52;
    person(G, px, py, 1.5, 4, { walk: G.L / 140, still: !G.anim || prog >= 1, arm: 'phone', bag: true });
    bars(G, px - 14, py - 90, sig, true, sig > 2 ? P.ok : sig > 1 ? '#D4A017' : P.bad); txt(c, sig + '/4', px + 22, py - 96, { s: 12, c: P.muted, w: 700 });
    var period = lerp(900, 2800, prog) , ph = G.anim ? ((G.L % period) / period) : 0.5, A = { x: tx, y: 150 }, B = { x: px + 8, y: py - 70 };
    trail(G, A, B, P.line);
    var pp = ph < 0.5 ? pos(A, B, ph * 2) : pos(B, A, (ph - 0.5) * 2); envelope(G, pp.x, pp.y, ph < 0.5 ? P.teal : P.ok);
    stopwatch(G, vw - 100, 74, 26, G.anim ? (G.L / period) * TAU : 4.2 * (1)); txt(c, 'tiempo de carga', vw - 100, 116, { s: 11.5, c: P.muted, a: 'center', w: 600 });
    var barW = vw * 0.18; rr(c, vw - 100 - barW / 2, 128, barW, 10, 5); c.fillStyle = P.line; c.fill(); rr(c, vw - 100 - barW / 2, 128, Math.max(8, barW * lerp(0.25, 1, prog)), 10, 5); c.fillStyle = prog > 0.6 ? P.bad : P.teal; c.fill();
  }

  /* ================= P3 · más aciertos de caché → más rápido ================= */
  function sceneP3(G, p) {
    var c = G.c, P = G.pal, vw = G.vw, u = G.u; ground(G, 340);
    var me = { x: vw * 0.1, y: 250 }, shelf = { x: vw * 0.4, y: 250 }, far = { x: vw * 0.9, y: 150 };
    person(G, me.x, 340, 1.5, 1, { arm: 'phone', still: !G.anim });
    /* estante de caché */
    rr(c, shelf.x - 38, 170, 76, 92, 6); c.fillStyle = P.surface; c.fill(); c.strokeStyle = P.teal; c.lineWidth = 2.2; c.stroke(); txt(c, 'Caché', shelf.x, 156, { s: 13.5, c: P.teal, a: 'center', w: 800 });
    for (var r = 0; r < 3; r++) line(c, shelf.x - 34, 200 + r * 30, shelf.x + 34, 200 + r * 30, P.line, 2);
    var have = Math.floor(ease(seg(u, 0.1, 0.9)) * 6.99);
    for (var i = 0; i < 6; i++) if (i < have) { var bxx = shelf.x - 30 + (i % 3) * 22, byy = 188 + Math.floor(i / 3) * 30 - 8 + 0; var pop = G.anim ? 1 : 1; rr(c, bxx, byy + 6, 18, 18, 3); c.fillStyle = [P.A, P.B, P.C][i % 3]; c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1; }
    globe(G, far.x, far.y + 20, 26, 'Mapa (lejos)');
    trail(G, { x: shelf.x + 38, y: 230 }, { x: far.x - 26, y: far.y + 30 }, P.line);
    /* solicitudes */
    var T0 = G.L, per = 640;
    for (var n = Math.max(0, Math.floor((T0 - 3600) / per)); n <= Math.floor(T0 / per); n++) {
      var rel = T0 - n * per, ts = (n * per) / p.durMs, hp = clamp(0.05 + ease(seg(ts * 0.9 + 0.1, 0.1, 0.9)) * 0.9, 0, 0.95), hit = hash(n, 5) < hp;
      if (!G.anim) break;
      var A = { x: me.x + 14, y: 232 }, S = { x: shelf.x - 38, y: 232 }, F = { x: far.x - 20, y: far.y + 34 }, pp, col;
      if (hit) { var tot = 900; if (rel > tot) continue; pp = rel < tot / 2 ? pos(A, S, rel / (tot / 2)) : pos(S, A, (rel - tot / 2) / (tot / 2)); col = rel < tot / 2 ? P.teal : P.ok; }
      else { var tot2 = 2500; if (rel > tot2) continue; var a = rel / tot2; if (a < 0.25) pp = pos(A, S, a / 0.25); else if (a < 0.5) pp = pos(S, F, (a - 0.25) / 0.25); else if (a < 0.75) pp = pos(F, S, (a - 0.5) / 0.25); else pp = pos(S, A, (a - 0.75) / 0.25); col = a < 0.5 ? P.teal : P.muted; }
      envelope(G, pp.x, pp.y - (hit ? 0 : 0), col);
    }
    /* velocímetro */
    var gx = vw * 0.62, gy = 108, ang = lerp(-0.9, 0.9, 1 - ease(seg(u, 0.1, 0.9)));
    c.beginPath(); c.arc(gx, gy, 38, Math.PI * 1.1, Math.PI * 1.9); c.strokeStyle = P.line; c.lineWidth = 10; c.stroke();
    c.beginPath(); c.arc(gx, gy, 38, Math.PI * 1.1, Math.PI * 1.1 + 0.8 * Math.PI * (1 - ang / 1.8 - 0.5 + 0.5)); c.strokeStyle = P.ok; c.lineWidth = 10; c.stroke();
    line(c, gx, gy, gx + Math.sin(ang) * 32, gy - Math.cos(ang) * 32, P.ink, 3); circ(c, gx, gy, 4, P.ink); txt(c, 'qué tan rápida', gx, gy + 30, { s: 12, c: P.muted, a: 'center', w: 600 });
    txt(c, 'cada respuesta guardada ahorra un viaje largo', vw * 0.5, 392, { s: 13, c: P.muted, a: 'center', w: 600 });
  }

  /* ================= P10 · el doble de usuarios → margen de la API pública a la mitad ================= */
  function sceneP10(G, p) {
    var c = G.c, P = G.pal, vw = G.vw, u = G.u; ground(G, 340);
    var n1 = 6, n2 = 12, doubled = seg(u, 0.45, 0.62);
    for (var i = 0; i < n2; i++) {
      var tIn = i < n1 ? 0.02 + i * 0.05 : 0.45 + (i - n1) * 0.025, w = ease(seg(u, tIn, tIn + 0.18)); if (w <= 0) continue;
      var col = i % 6, row = Math.floor(i / 6), tx = vw * 0.06 + col * (vw * 0.062) + row * 14, ty = 342 - row * 34, x = lerp(-20, tx, w), mv = w < 1;
      person(G, x, ty + (row ? 0 : 0), 1.2, i + 2, { walk: mv ? G.L / 90 + i : 0, still: !mv, arm: mv ? 'none' : 'phone' });
    }
    if (doubled > 0 || G.static) alpha(c, ease(Math.max(doubled, G.static ? 1 : 0)), function () { rr(c, vw * 0.06, 52, 112, 30, 15); c.fillStyle = P.A; c.fill(); txt(c, '× 2 usuarios', vw * 0.06 + 56, 67.5, { s: 12.5, c: '#fff', a: 'center', w: 800 }); });
    /* API pública */
    var ax = vw * 0.55; line(c, ax, 340, ax, 120, P.muted, 5); rr(c, ax - 36, 78, 72, 44, 8); c.fillStyle = P.surface; c.fill(); c.strokeStyle = P.muted; c.lineWidth = 2; c.stroke(); txt(c, 'API pública', ax, 100, { s: 12.5, c: P.ink, a: 'center', w: 800 });
    var rate = (doubled > 0.5 || G.static ? 2 : 1) * (G.anim ? 1 : 0), per = 760 / Math.max(1, rate);
    for (var k = 0; k < 16 && rate; k++) { var st = (G.L + k * per) % (per * 8), a = (st / (per * 4)); if (a > 1) continue; var y0 = 300 - (k % 3) * 26; envelope(G, lerp(vw * 0.32, ax - 40, a), lerp(y0, 224, a) - Math.sin(a * 3.14) * 12, P.A); }
    /* tanque de margen */
    var tx = vw * 0.8, ty = 96, tw = 56, th = 200, level = lerp(1, 0.5, ease(Math.max(seg(u, 0.5, 0.78), G.static ? 1 : 0)));
    rr(c, tx, ty, tw, th, 8); c.fillStyle = P.surface; c.fill(); c.strokeStyle = P.ink; c.lineWidth = 2; c.stroke();
    c.save(); rr(c, tx, ty, tw, th, 8); c.clip(); var wave = G.anim ? Math.sin(G.L / 260) * 2 : 0; c.fillStyle = level > 0.7 ? P.ok : '#D4A017'; c.globalAlpha = 0.85; c.fillRect(tx, ty + th * (1 - level) + wave, tw, th * level); c.restore();
    line(c, tx - 8, ty + th / 2, tx + tw + 8, ty + th / 2, P.ink, 1.5, [4, 4]); txt(c, '½', tx + tw + 14, ty + th / 2, { s: 14, c: P.ink, w: 800 });
    txt(c, 'margen', tx + tw / 2, ty - 14, { s: 13.5, c: P.ink, a: 'center', w: 800 });
    txt(c, 'se comprueba: ¿cae a la mitad?', tx + tw / 2, ty + th + 18, { s: 11.5, c: P.muted, a: 'center', w: 600 });
  }

  /* ================= P12 · servidor propio de mapas ================= */
  function sceneP12(G, p) {
    var c = G.c, P = G.pal, vw = G.vw, u = G.u; ground(G, 340);
    var me = { x: vw * 0.1, y: 238 }, pub = { x: vw * 0.9, y: 120 }, own = { x: vw * 0.42, y: 258 };
    person(G, me.x, 340, 1.5, 5, { arm: 'phone', still: !G.anim });
    globe(G, pub.x, pub.y + 16, 26, 'API pública');
    var phase2 = seg(u, 0.4, 0.58), installed = phase2 > 0.98 || G.static;
    /* tráfico: lento y largo al principio, corto después */
    var per = 300;
    for (var n = Math.max(0, Math.floor((G.L - 3400) / per)); n <= Math.floor(G.L / per) && G.anim; n++) {
      var rel = G.L - n * per, useOwn = (u > 0.52) && hash(n, 2) < 0.9;
      var A = { x: me.x + 16, y: 230 };
      if (useOwn) { var tot = 900; if (rel > tot) continue; var a = rel / tot, pp = a < 0.5 ? pos(A, { x: own.x - 22, y: 250 }, a * 2) : pos({ x: own.x - 22, y: 250 }, A, (a - 0.5) * 2); envelope(G, pp.x, pp.y, a < 0.5 ? P.B : P.ok); }
      else { var tot2 = 3200; if (rel > tot2) continue; var b = rel / tot2, pp2 = b < 0.5 ? pos(A, { x: pub.x - 24, y: pub.y + 22 }, b * 2) : pos({ x: pub.x - 24, y: pub.y + 22 }, A, (b - 0.5) * 2); envelope(G, pp2.x, pp2.y, P.A); }
    }
    trail(G, { x: me.x + 16, y: 230 }, { x: pub.x - 24, y: pub.y + 22 }, P.line);
    /* instalación del servidor propio */
    if (!installed && phase2 > 0) { var wx = lerp(vw * 0.62, own.x + 44, ease(phase2)); person(G, wx, 340, 1.2, 7, { walk: G.L / 90, face: -1, arm: 'point' }); serverBox(G, wx - 46, 296, 30, 40, P.B, 0, null); }
    if (installed) { serverBox(G, own.x - 22, own.y - 6, 44, 60, P.B, 1, 'Overpass propio'); alpha(c, 1, function () { coin(G, own.x + 44, 214 - (G.anim ? Math.abs(Math.sin(G.L / 300)) * 6 : 0), 11); txt(c, '+ costo', own.x + 62, 214, { s: 12, c: P.warn || '#8A5A00', w: 700 }); }); }
    else if (phase2 <= 0) { rr(c, own.x - 22, own.y - 6, 44, 60, 8); c.strokeStyle = P.line; c.lineWidth = 2; c.setLineDash([5, 5]); c.stroke(); c.setLineDash([]); txt(c, '¿propio?', own.x, own.y + 24, { s: 12, c: P.muted, a: 'center', w: 600 }); }
    txt(c, installed ? '⚡ viaje corto' : '🐢 viaje largo', vw * 0.3, 150, { s: 14, c: installed ? P.ok : P.muted, a: 'center', w: 800 });
    txt(c, installed ? 'respuestas más cortas y menos carga externa' : 'todas las consultas viajan lejos y se acumulan', vw * 0.5, 392, { s: 13, c: P.muted, a: 'center', w: 600 });
  }

  /* ================= P4 · poco dinero, no se pueden pagar servidores ================= */
  function sceneP4(G, p) {
    var c = G.c, P = G.pal, vw = G.vw, u = G.u; ground(G, 340);
    person(G, vw * 0.1, 340, 1.6, 3, { arm: 'point', still: !G.anim });
    /* billetera */
    var wx = vw * 0.17, wy = 250; rr(c, wx, wy, 64, 48, 8); c.fillStyle = '#8A5A2B'; c.fill(); rr(c, wx + 40, wy + 14, 24, 20, 6); c.fillStyle = '#6B431C'; c.fill(); circ(c, wx + 52, wy + 24, 3, '#E7B416');
    var left = 1 - ease(seg(u, 0.18, 0.8)), nCoins = Math.ceil(5 * left + 0.0001); for (var i = 0; i < nCoins; i++) coin(G, wx + 22 + (i % 3) * 8, wy - 4 - Math.floor(i / 3) * 10 - i * 0, 9);
    txt(c, 'presupuesto', wx + 32, wy + 66, { s: 12, c: P.muted, a: 'center', w: 600 });
    /* servidores con precio */
    var sx = vw * 0.5, labels = ['Servidor 1', 'Servidor 2', 'Servidor 3'];
    for (var s = 0; s < 3; s++) {
      var x = sx + s * (vw * 0.14), t0 = 0.12 + s * 0.2, ap = ease(seg(u, t0, t0 + 0.12)), paid = u > t0 + 0.2 || G.static ? (s < 1 ? true : false) : false;
      if (ap <= 0) continue; var hasMoney = s < 1 || (G.static ? false : u < t0 + 0.1);
      alpha(c, ap, function () {
        serverBox(G, x, 140 + (1 - ap) * 14, 50, 70, s === 0 ? P.B : P.muted, s === 0 ? 1 : 0, labels[s]);
        rr(c, x + 6, 110 + (1 - ap) * 14, 38, 20, 10); c.fillStyle = P.surface; c.fill(); c.strokeStyle = P.line; c.lineWidth = 1; c.stroke(); txt(c, '$$', x + 25, 120.5 + (1 - ap) * 14, { s: 12.5, c: '#8A5A00', a: 'center', w: 800 });
        if (s > 0 && u > t0 + 0.14) { lock(G, x + 25, 168, 1.3, P.bad); alpha(c, 1, function () { txt(c, '✕ sin fondos', x + 25, 242, { s: 11.5, c: P.bad, a: 'center', w: 800 }); }); }
        if (s === 0 && u > t0 + 0.14) txt(c, '✓ pagado', x + 25, 242, { s: 11.5, c: P.ok, a: 'center', w: 800 });
      });
    }
    /* monedas volando */
    if (G.anim) for (var k = 0; k < 4; k++) { var a = ((G.L / 900) + k * 0.25) % 1, sIdx = Math.min(2, Math.floor(u * 3.2)); if (u > 0.15 && u < 0.85) { var tx = sx + 25 + sIdx * (vw * 0.14); coin(G, lerp(wx + 40, tx, a), lerp(wy, 180, a) - Math.sin(a * 3.14) * 40, 7); } }
    txt(c, 'cuando el dinero se acaba, ya no se pueden agregar servidores', vw * 0.5, 392, { s: 13, c: P.muted, a: 'center', w: 600 });
  }

  /* ================= P5 · la recomendada es la de mayor puntaje entre las que cumplen ================= */
  function sceneP5(G, p) {
    var c = G.c, P = G.pal, vw = G.vw, u = G.u; ground(G, 350);
    var cols = [P.A, P.B, P.C], names = ['A', 'B', 'C'], target = [0.64, 0.86, 0.96], elig = [true, true, false], base = 350, mh = 220, bw = vw * 0.12, x0 = vw * 0.34, gap = vw * 0.17;
    for (var i = 0; i < 3; i++) {
      var x = x0 + i * gap, grow = ease(seg(u, 0.06 + i * 0.07, 0.5 + i * 0.05)), wob = G.anim && u < 0.55 ? Math.sin(G.L / 230 + i * 2) * 8 * (1 - grow) : 0, h = Math.max(3, target[i] * mh * grow + wob);
      rr(c, x, base - h, bw, h, 6); c.fillStyle = elig[i] ? cols[i] : P.line; c.fill();
      if (!elig[i]) { c.save(); rr(c, x, base - h, bw, h, 6); c.clip(); for (var s = -h; s < bw + h; s += 14) line(c, x + s, base, x + s + h, base - h, 'rgba(180,35,49,.45)', 3); c.restore(); }
      txt(c, names[i], x + bw / 2, base - 14 - (h > 30 ? 0 : 0), { s: 18, c: '#fff', a: 'center', w: 800 });
      if (!elig[i] && grow > 0.9) { lock(G, x + bw / 2, base - h - 20, 1.3, P.bad); txt(c, 'no cumple', x + bw / 2, base - h - 42, { s: 11.5, c: P.bad, a: 'center', w: 800 }); }
    }
    /* juez */
    var jx = lerp(vw * 0.08, x0 - 44, ease(seg(u, 0.1, 0.6))), jy = 350;
    var jp = G.anim && u < 0.85 ? G.L / 120 : 0; person(G, jx, jy, 1.7, 6, { walk: u > 0.1 && u < 0.6 ? jp : 0, still: u <= 0.1 || u >= 0.6, arm: 'point' });
    rr(c, vw * 0.04, 70, 150, 24, 12); c.fillStyle = P.surface; c.fill(); txt(c, 'mayor puntaje que cumple', vw * 0.04 + 75, 82.5, { s: 12, c: P.ink, a: 'center', w: 700 });
    var drop = ease(seg(u, 0.78, 0.95)), crownY = lerp(40, base - target[1] * mh - 30, drop); txt(c, '👑', x0 + gap + bw / 2, crownY, { s: 30, a: 'center' });
    if (G.anim && u >= 0.95) { for (var q = 0; q < 6; q++) { var an = G.L / 300 + q; circ(c, x0 + gap + bw / 2 + Math.cos(an) * 26, base - target[1] * mh - 30 + Math.sin(an) * 16, 2.2, '#E7B416'); } }
  }

  /* ================= P6 · situación extrema: siempre hay propuesta ================= */
  function sceneP6(G, p) {
    var c = G.c, P = G.pal, vw = G.vw, u = G.u; ground(G, 340);
    /* multitud densa */
    var rows = 4, cols = Math.floor(vw * 0.34 / 14);
    for (var r = 0; r < rows; r++) for (var q = 0; q < cols; q++) {
      var idx = r * cols + q, tIn = 0.02 + (idx / (rows * cols)) * 0.5, w = ease(seg(u, tIn, tIn + 0.12)); if (w <= 0) continue;
      var x = lerp(-14, 10 + q * 14 + (r % 2) * 6, w), y = 336 - r * 26, mv = w < 1;
      person(G, x, y, 0.5, idx, { walk: mv ? G.L / 70 + idx : 0, still: !mv, arm: 'none' });
    }
    rr(c, 8, 52, 176, 26, 13); c.fillStyle = P.surface; c.fill(); txt(c, '👥 miles de usuarios a la vez', 18, 65.5, { s: 12.5, c: P.ink, w: 700 });
    /* billetera casi vacía */
    var wx = vw * 0.44, wy = 250; rr(c, wx, wy, 56, 42, 8); c.fillStyle = '#8A5A2B'; c.fill(); coin(G, wx + 28, wy - 4, 8); txt(c, 'poco dinero', wx + 28, wy + 58, { s: 12, c: P.muted, a: 'center', w: 600 });
    /* impresora → propuesta */
    var px = vw * 0.62, py = 190; rr(c, px, py, 100, 60, 8); c.fillStyle = P.surface; c.fill(); c.strokeStyle = P.teal; c.lineWidth = 2.2; c.stroke(); txt(c, 'Simulador', px + 50, py + 12, { s: 12, c: P.teal, a: 'center', w: 800 }); circ(c, px + 86, py + 46, 3.5, G.anim && Math.floor(G.L / 220) % 2 ? P.ok : P.line);
    var out = ease(seg(u, 0.42, 0.9)), docH = 118 * out;
    if (out > 0) { c.save(); c.beginPath(); c.rect(px + 8, py + 52, 84, 130); c.clip(); rr(c, px + 12, py + 56 - 118 + docH, 76, 118, 4); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = P.ink; c.lineWidth = 1.5; c.stroke(); var oy = py + 56 - 118 + docH; txt(c, 'Propuesta', px + 50, oy + 14, { s: 12, c: '#12263F', a: 'center', w: 800 }); for (var l = 0; l < 4; l++) { var chk = seg(u, 0.62 + l * 0.06, 0.7 + l * 0.06); c.fillStyle = '#9AA9BA'; c.fillRect(px + 34, oy + 30 + l * 20, 44, 4); if (chk > 0) { c.strokeStyle = P.ok; c.lineWidth = 2.4; c.beginPath(); c.moveTo(px + 19, oy + 31 + l * 20); c.lineTo(px + 23, oy + 36 + l * 20); c.lineTo(px + 29, oy + 25 + l * 20); c.stroke(); } } c.restore(); }
    person(G, vw * 0.9, 340, 1.5, 2, { arm: 'point', face: -1, still: !G.anim });
    txt(c, 'incluso en el peor caso, entrega una propuesta útil', vw * 0.5, 392, { s: 13, c: P.muted, a: 'center', w: 600 });
  }

  /* ================= P7 · datos mal escritos se rechazan ================= */
  function sceneP7(G, p) {
    var c = G.c, P = G.pal, vw = G.vw, u = G.u; ground(G, 350);
    var fx = vw * 0.06, fw = vw * 0.62, fy = 36;
    rr(c, fx, fy, fw, 304, 12); c.fillStyle = P.surface; c.fill(); c.strokeStyle = P.muted; c.lineWidth = 2; c.stroke(); txt(c, 'Escenario nuevo', fx + 16, fy + 22, { s: 14.5, c: P.navy || P.ink, w: 800 });
    var fields = [['Usuarios', '−5', 'debe ser ≥ 1'], ['Aciertos de caché', '150 %', 'máximo 100 %'], ['Red del celular', 'abc', 'no es un número'], ['Lugares', '20', null]];
    var scan = seg(u, 0.08, 0.82) * fields.length;
    fields.forEach(function (f, i) {
      var y = fy + 44 + i * 62, active = scan >= i && scan < i + 1, done = scan >= i + 1 || (G.static && true), bad = f[2];
      txt(c, f[0], fx + 18, y + 6, { s: 12.5, c: P.muted, w: 600 });
      rr(c, fx + 16, y + 14, fw - 150, 30, 7); c.fillStyle = P.surface2; c.fill(); c.strokeStyle = done && bad ? P.bad : active ? P.teal : P.line; c.lineWidth = active || (done && bad) ? 2.4 : 1.2; c.stroke();
      var shake = done && bad && G.anim && scan < i + 1.4 ? Math.sin(G.L / 30) * 2 : 0;
      txt(c, f[1], fx + 28 + shake, y + 29.5, { s: 15, c: P.ink, w: 700 });
      if (active) { alpha(c, 0.18, function () { rr(c, fx + 16, y + 14, fw - 150, 30, 7); c.fillStyle = P.teal; c.fill(); }); txt(c, 'revisando…', fx + fw - 126, y + 29.5, { s: 12, c: P.teal, w: 700 }); }
      if (done) { if (bad) { txt(c, '✕ ' + bad, fx + fw - 126, y + 29.5, { s: 12, c: P.bad, w: 800 }); } else txt(c, '✓ válido', fx + fw - 126, y + 29.5, { s: 12.5, c: P.ok, w: 800 }); }
    });
    /* botón bloqueado */
    var by = fy + 44 + 4 * 62 - 6; rr(c, fx + 16, by - 6, 150, 32, 8); c.fillStyle = P.line; c.fill(); txt(c, 'Calcular', fx + 52, by + 10, { s: 13.5, c: P.muted, w: 700 }); if (scan > 3.2 || G.static) lock(G, fx + 34, by + 10, 1.1, P.bad);
    if (scan > 3.2 || G.static) txt(c, 'no se calcula con datos inválidos', fx + 178, by + 10, { s: 12, c: P.bad, w: 700 });
    /* personaje con lista de control */
    var px = vw * 0.84; person(G, px, 350, 1.8, 0, { arm: 'point', face: -1, still: !G.anim });
    rr(c, px - 36, 70, 86, 96, 8); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = P.ink; c.lineWidth = 1.5; c.stroke();
    for (var k = 0; k < 4; k++) { c.fillStyle = '#9AA9BA'; c.fillRect(px - 8, 90 + k * 20, 40, 4); var done2 = scan >= k + 1 || G.static; c.strokeStyle = done2 ? (fields[k][2] ? P.bad : P.ok) : P.line; c.lineWidth = 2.2; rr(c, px - 28, 84 + k * 20, 14, 14, 3); c.stroke(); if (done2) { c.beginPath(); if (fields[k][2]) { c.moveTo(px - 25, 87 + k * 20); c.lineTo(px - 17, 95 + k * 20); c.moveTo(px - 17, 87 + k * 20); c.lineTo(px - 25, 95 + k * 20); } else { c.moveTo(px - 26, 91 + k * 20); c.lineTo(px - 22, 96 + k * 20); c.lineTo(px - 15, 85 + k * 20); } c.stroke(); } }
  }

  /* ================= P9 · los pesos del equipo cambian la recomendación ================= */
  function sceneP9(G, p) {
    var c = G.c, P = G.pal, vw = G.vw, u = G.u; ground(G, 350);
    var sx = vw * 0.06, sw = vw * 0.42, phase = u < 0.5 ? 0 : 1, t1 = ease(seg(u, 0.08, 0.34)), t2 = ease(seg(u, 0.54, 0.8));
    var vals = [lerp(0.2, 0.85, t1) * (1 - t2) + 0.2 * t2 * 0 + (1 - t2) * 0, lerp(0.2, 0.2, 0) + t2 * 0.65];
    var cost = lerp(0.2, 0.85, t1) * (1 - t2) + lerp(0.85, 0.15, t2) * t2, avail = lerp(0.2, 0.2, 0) * (1 - t2) + lerp(0.2, 0.85, t2) * t2;
    [['Costo', cost, P.A], ['Disponibilidad', avail, P.B]].forEach(function (s, i) {
      var y = 100 + i * 100; txt(c, s[0], sx, y - 22, { s: 14, c: P.ink, w: 800 }); rr(c, sx, y - 4, sw, 8, 4); c.fillStyle = P.line; c.fill(); rr(c, sx, y - 4, sw * s[1], 8, 4); c.fillStyle = s[2]; c.fill();
      var kx = sx + sw * s[1]; circ(c, kx, y, 13, P.surface, s[2], 3); circ(c, kx, y, 4, s[2]);
      if ((i === 0 && u < 0.45 && u > 0.05) || (i === 1 && u > 0.5 && u < 0.85)) person(G, kx + 6, y + 70 - 0, 1.2, i + 4, { arm: 'point', still: !G.anim, face: 1 });
    });
    /* podio */
    var bx = vw * 0.6, bw = vw * 0.1, base = 330, aH = lerp(150, 90, ease(seg(u, 0.54, 0.8))) , bH = lerp(90, 150, ease(seg(u, 0.54, 0.8)));
    rr(c, bx, base - aH, bw, aH, 6); c.fillStyle = P.A; c.fill(); rr(c, bx + bw + 14, base - bH, bw, bH, 6); c.fillStyle = P.B; c.fill();
    txt(c, 'A', bx + bw / 2, base - 16, { s: 20, c: '#fff', a: 'center', w: 800 }); txt(c, 'B', bx + bw * 1.5 + 14, base - 16, { s: 20, c: '#fff', a: 'center', w: 800 });
    var win = u < 0.52 ? 0 : 1, wx = bx + win * (bw + 14) + bw / 2, wy = base - (win ? bH : aH) - 24 - (G.anim ? Math.abs(Math.sin(G.L / 260)) * 6 : 0);
    var move = ease(seg(u, 0.52, 0.62)), arrowX = lerp(bx + bw / 2, bx + bw * 1.5 + 14, move);
    txt(c, '★', arrowX, wy - (win ? 0 : 0), { s: 28, c: '#D4A017', a: 'center', w: 800 }); txt(c, 'recomendada', arrowX, wy - 26, { s: 12, c: P.ink, a: 'center', w: 800 });
    txt(c, 'lo que más le importa al equipo cambia el resultado', vw * 0.5, 392, { s: 13, c: P.muted, a: 'center', w: 600 });
  }

  /* ================= P11 · un requisito imposible descarta todo ================= */
  function sceneP11(G, p) {
    var c = G.c, P = G.pal, vw = G.vw, u = G.u; ground(G, 350);
    var gx = vw * 0.58; rr(c, gx, 70, 16, 280, 4); c.fillStyle = P.ink; c.fill(); rr(c, gx - 70, 76, 140, 42, 8); c.fillStyle = P.surface; c.fill(); c.strokeStyle = P.bad; c.lineWidth = 2.4; c.stroke(); txt(c, 'Latencia ≤ 1 ms', gx, 97, { s: 14, c: P.bad, a: 'center', w: 800 });
    var cards = [['A', P.A], ['B', P.B], ['C', P.C]], rejected = 0;
    cards.forEach(function (cd, i) {
      var t0 = 0.08 + i * 0.22, a = seg(u, t0, t0 + 0.16), back = seg(u, t0 + 0.16, t0 + 0.3), x = lerp(vw * 0.04, gx - 70, ease(a)) - ease(back) * 60, y = 150 + i * 62;
      if (back > 0.99 || G.static) rejected++;
      rr(c, x, y, 66, 46, 8); c.fillStyle = cd[1]; c.fill(); txt(c, cd[0], x + 33, y + 24, { s: 22, c: '#fff', a: 'center', w: 800 });
      if (a >= 1 && back < 1 || G.static) { c.save(); c.translate(gx - 76, y + 23); c.rotate(G.anim ? Math.sin(G.L / 50) * 0.1 : 0); txt(c, '✕', 0, 0, { s: 28, c: P.bad, a: 'center', w: 800 }); c.restore(); }
    });
    person(G, gx + 54, 350, 1.8, 3, { arm: 'point', face: -1, shirt: '#12263F', still: !G.anim });
    rr(c, gx + 28, 150, 58, 40, 6); c.fillStyle = P.bad; c.fill(); txt(c, 'NO', gx + 57, 170, { s: 18, c: '#fff', a: 'center', w: 800 });
    /* libreta de motivos */
    var nx = vw * 0.74, ny = 200; rr(c, nx, ny, vw * 0.22, 130, 8); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = P.ink; c.lineWidth = 1.5; c.stroke(); txt(c, 'Motivos', nx + 12, ny + 16, { s: 12.5, c: '#12263F', w: 800 });
    ['A', 'B', 'C'].forEach(function (n, i) { var sh = seg(u, 0.3 + i * 0.22, 0.42 + i * 0.22) > 0.5 || G.static; if (sh) txt(c, n + ' ✕ latencia', nx + 12, ny + 42 + i * 26, { s: 12.5, c: '#B42331', w: 700 }); else { c.fillStyle = '#C5CFDA'; c.fillRect(nx + 12, ny + 40 + i * 26, vw * 0.1, 4); } });
    txt(c, 'ninguna cumple → el motivo queda registrado', vw * 0.5, 392, { s: 13, c: P.muted, a: 'center', w: 600 });
  }

  var SCENES = { users: sceneUsers, P1: sceneP1, P2: sceneP2, P3: sceneP3, P4: sceneP4, P5: sceneP5, P6: sceneP6, P7: sceneP7, P8: sceneP8, P9: sceneP9, P10: sceneP10, P11: sceneP11, P12: sceneP12 };
  var CAPTION = {
    P1: 'El simulador y una persona calculan la misma fórmula; una balanza compara los dos resultados.',
    P8: 'Dos ejecuciones idénticas pasan por la misma máquina; el dado tachado indica que no hay azar.',
    P2: 'Una persona se aleja de la antena: la señal baja y cada viaje de la solicitud tarda más.',
    P3: 'El estante de caché se va llenando: las solicitudes respondidas ahí evitan el viaje largo al mapa.',
    P10: 'Entra el doble de personas a la API pública y se observa cuánto margen queda.',
    P12: 'Las consultas viajan a la API pública; llega un servidor propio y las respuestas se acortan.',
    P4: 'El presupuesto se gasta en servidores hasta que no alcanza para pagar el siguiente.',
    P5: 'Tres alternativas compiten por puntaje; la que no cumple queda descartada y la mejor entre las que cumplen recibe la corona.',
    P6: 'Una multitud enorme llega con poco dinero: el simulador igual entrega una propuesta.',
    P7: 'Un formulario con datos mal escritos: cada campo se revisa y el botón se bloquea si hay errores.',
    P9: 'Se mueven los deslizadores de costo y disponibilidad y la recomendación cambia de alternativa.',
    P11: 'Las tres alternativas se enfrentan a un requisito imposible y ninguna pasa.'
  };

  function heightFor(W) { var vw = W >= 640 ? 800 : 520; return Math.round(W * VH / vw); }
  function draw(kind, ctx, W, H, p, pal) {
    p = p || {}; var vw = W >= 640 ? 800 : 520, s = W / vw, ck = clock(p), fn = SCENES[kind] || SCENES.P1;
    var G = { c: ctx, pal: pal, vw: vw, u: ck.u, L: ck.L, anim: ck.anim, static: !!p.static, p: p };
    ctx.save(); ctx.clearRect(0, 0, W, H); ctx.scale(s, s);
    rr(ctx, 0.5, 0.5, vw - 1, VH - 1, 14); ctx.fillStyle = pal.surface2; ctx.fill(); ctx.save(); rr(ctx, 0.5, 0.5, vw - 1, VH - 1, 14); ctx.clip();
    try { fn(G, p); } catch (e) { txt(ctx, 'No se pudo dibujar la escena', 20, 30, { s: 14, c: pal.bad }); }
    ctx.restore();
    if (p.reveal && kind !== 'users') { var ok = p.reveal === 'pass'; badge(G, vw - 84, 26, ok, ok ? 'Pasa' : 'Falla'); }
    else if (!p.static && p.waiting) { rr(ctx, vw / 2 - 118, 8, 236, 26, 13); ctx.fillStyle = pal.surface; ctx.fill(); ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.stroke(); txt(ctx, 'Esperando el resultado real…', vw / 2, 21.5, { s: 12.5, c: pal.ink, a: 'center', w: 700 }); }
    ctx.restore();
  }
  return { draw: draw, heightFor: heightFor, CAPTION: CAPTION, kinds: Object.keys(SCENES) };
});
