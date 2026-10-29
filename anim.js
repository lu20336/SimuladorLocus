/* Animaciones del simulador de Locus (canvas 2D, sin dependencias).
 * Son una REPRESENTACIÓN visual: dibujan los parámetros configurados (usuarios, solicitudes, caché, red, lugares)
 * y nunca calculan ni anticipan resultados. El veredicto de cada alternativa solo se pinta cuando llega `reveal`,
 * que proviene de la ejecución real del modelo. Las funciones son puras respecto al estado de la aplicación. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LocusAnim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var clamp = function (x, a, b) { return Math.min(b, Math.max(a, x)); };
  var frac = function (x) { return x - Math.floor(x); };
  var hash = function (i, k, seed) { return frac(Math.sin(i * 127.1 + k * 311.7 + (seed || 0) * 74.7) * 43758.5453); };

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function text(ctx, s, x, y, o) {
    o = o || {};
    ctx.font = (o.weight || 500) + ' ' + (o.size || 12) + 'px Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'middle';
    ctx.fillStyle = o.color || '#000';
    ctx.fillText(s, x, y);
  }
  function fit(ctx, s, maxW) { /* recorta con «…» si no cabe */
    if (ctx.measureText(s).width <= maxW) return s;
    while (s.length > 2 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }

  /* ---------- Escenario: usuarios → solicitudes → alternativas → OpenStreetMap ---------- */
  var LANES = [
    { k: 'A', name: 'Cliente directo', nodes: [{ x: 0.44, l: 'Celular', cache: true }] },
    { k: 'B', name: 'Monolito con caché', nodes: [{ x: 0.36, l: 'Servidor' }, { x: 0.58, l: 'Caché', cache: true }] },
    { k: 'C', name: 'Microservicios', nodes: [{ x: 0.30, l: 'Gateway' }, { x: 0.45, l: 'Servicios' }, { x: 0.60, l: 'Caché', cache: true }] }
  ];

  function layout(W, H) {
    var small = W < 520, top = 50, laneH = (H - top - 8) / 3;
    return { small: small, top: top, laneH: laneH, uz: { x0: 10, x1: Math.round(W * (small ? 0.2 : 0.17)), y0: top + 8, y1: H - 12 },
      osm: { x: W - (small ? 62 : 100), w: small ? 54 : 92 }, nodeW: small ? 46 : 64, nodeH: small ? 22 : 26 };
  }

  function lanePath(L, W, lane, idx) {
    var cy = L.top + L.laneH * (idx + 0.5), pts = [{ x: L.uz.x1 + 4, y: cy }];
    lane.nodes.forEach(function (n) { pts.push({ x: Math.round(W * n.x), y: cy, cache: !!n.cache }); });
    pts.push({ x: L.osm.x, y: cy, osm: true });
    return pts;
  }

  /* p: {t01, durMs, users, reqPerMin, hit, rtt, pois, selfHost, reduced, static, reveal} */
  function drawScenario(ctx, W, H, p, pal) {
    var L = layout(W, H), t = clamp(p.t01, 0, 1) * p.durMs, lambda = p.users * p.reqPerMin / 60;
    var animated = !p.static && !p.reduced;
    ctx.clearRect(0, 0, W, H);
    rrect(ctx, 0.5, 0.5, W - 1, H - 1, 12); ctx.fillStyle = pal.surface2; ctx.fill();

    /* cabecera con los parámetros configurados */
    var shownFrac = p.static || p.reduced ? 1 : clamp(t / (p.durMs * 0.6), 0, 1);
    var nDots = Math.min(p.users, 60), per = Math.ceil(p.users / Math.max(1, nDots)), shownDots = Math.round(nDots * shownFrac);
    var usersNow = Math.min(p.users, Math.round(p.users * shownFrac));
    text(ctx, 'Usuarios simultáneos: ' + usersNow.toLocaleString('es-CO') + ' de ' + p.users.toLocaleString('es-CO'), 14, 14, { size: 12, weight: 700, color: pal.ink });
    var l2 = 'Aciertos de caché ' + Math.round(p.hit * 100) + ' %  ·  ' + p.reqPerMin + ' solic./min  ·  celular ' + p.rtt + ' ms  ·  ' + p.pois + ' lugares';
    if (L.small) { text(ctx, 'Caché ' + Math.round(p.hit * 100) + ' % · ' + p.reqPerMin + ' sol./min', 14, 30, { size: 11, color: pal.muted }); text(ctx, p.rtt + ' ms · ' + p.pois + ' lugares', 14, 43, { size: 11, color: pal.muted }); }
    else text(ctx, l2, 14, 31, { size: 11.5, color: pal.muted });
    if (nDots < p.users && !L.small) text(ctx, 'cada punto ≈ ' + per + ' usuarios', W - 14, 14, { size: 11, color: pal.muted, align: 'right' });

    /* usuarios: cuadrícula de puntos que se incorporan */
    var zw = L.uz.x1 - L.uz.x0, zh = L.uz.y1 - L.uz.y0, cols = Math.max(2, Math.round(Math.sqrt(nDots * zw / zh))), rows = Math.ceil(nDots / cols);
    var dx = zw / cols, dy = Math.min(zh / rows, dx * 1.6), r = Math.max(2, Math.min(5, dx * 0.32));
    for (var i = 0; i < nDots; i++) {
      var cx = L.uz.x0 + dx * (i % cols + 0.5), cy0 = L.uz.y0 + (zh - dy * rows) / 2 + dy * (Math.floor(i / cols) + 0.5);
      ctx.beginPath(); ctx.arc(cx, cy0, r, 0, 6.2832);
      if (i < shownDots) { ctx.fillStyle = pal.ink; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1; }
      else { ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.stroke(); }
    }

    /* OpenStreetMap */
    rrect(ctx, L.osm.x, L.top + 4, L.osm.w, H - L.top - 12, 10); ctx.fillStyle = pal.surface; ctx.fill(); ctx.strokeStyle = pal.muted; ctx.lineWidth = 1.2; ctx.stroke();
    text(ctx, L.small ? 'OSM' : 'OpenStreetMap', L.osm.x + L.osm.w / 2, L.top + 20, { size: L.small ? 9 : 11, weight: 700, color: pal.ink, align: 'center' });
    text(ctx, p.selfHost ? 'Overpass propio' : 'API pública', L.osm.x + L.osm.w / 2, L.top + 34, { size: L.small ? 9 : 10, color: pal.muted, align: 'center' });

    var rate = clamp(lambda * 4, 2, 32), gap = 1000 / rate, rttExtra = p.rtt * 1.2;
    LANES.forEach(function (lane, li) {
      var pts = lanePath(L, W, lane, li), cy = pts[0].y, cacheIdx = pts.length - 2;
      var eff = lane.k === 'A' ? p.hit * 0.35 : p.hit;
      /* pista y nodos */
      ctx.beginPath(); ctx.moveTo(pts[0].x, cy); ctx.lineTo(L.osm.x, cy); ctx.setLineDash([4, 4]); ctx.strokeStyle = pal.line; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
      text(ctx, lane.k + ' · ' + lane.name, pts[0].x + 4, cy - L.laneH * 0.5 + 9, { size: L.small ? 10 : 11, weight: 700, color: pal[lane.k] });
      /* paquetes de solicitudes */
      if (animated) {
        var segLen = [], tot = 0; for (var s = 0; s < pts.length - 1; s++) { var d = Math.abs(pts[s + 1].x - pts[s].x); segLen.push(d); tot += d; }
        var vel = (W * 0.6) / 1700, maxT = 2 * (tot / vel) + 2 * rttExtra + 100;
        var i0 = Math.max(0, Math.floor((t - maxT) / gap) - 1), i1 = Math.floor(t / gap) + 1;
        for (var n = i0; n <= i1; n++) {
          var sp = (n + hash(n, li, 1) * 0.8) * gap, rel = t - sp;
          if (rel < 0 || hash(n, li, 2) > clamp(sp / (p.durMs * 0.6), 0, 1)) continue;
          var hitP = hash(n, li, 3) < eff, stop = hitP ? cacheIdx : pts.length - 1, px = null, color = pal[lane.k];
          var legs = []; for (var q = 0; q < stop; q++) legs.push({ a: pts[q], b: pts[q + 1], ms: segLen[q] / vel + (q === 0 ? rttExtra : 0) });
          var back = legs.slice().reverse().map(function (g) { return { a: g.b, b: g.a, ms: g.ms }; });
          var all = legs.concat(back), acc = 0;
          for (var g = 0; g < all.length; g++) {
            if (rel <= acc + all[g].ms) { var u = (rel - acc) / all[g].ms; px = { x: all[g].a.x + (all[g].b.x - all[g].a.x) * u, y: cy }; if (g >= legs.length) color = hitP ? pal.ok : pal.muted; break; }
            acc += all[g].ms;
          }
          if (!px) continue;
          ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 7; ctx.beginPath(); ctx.arc(px.x, px.y, 2.6 + p.pois / 18, 0, 6.2832); ctx.fillStyle = color; ctx.fill(); ctx.restore();
        }
      } else {
        ctx.beginPath(); ctx.moveTo(pts[0].x + 6, cy); ctx.lineTo(L.osm.x - 8, cy); ctx.strokeStyle = pal[lane.k]; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
      }
      rrect(ctx, 4, L.top + L.laneH * li + 2, W - L.osm.w - 18, L.laneH - 4, 8); ctx.globalAlpha = 0.07; ctx.fillStyle = pal[lane.k]; ctx.fill(); ctx.globalAlpha = 1;
      lane.nodes.forEach(function (nd, ni) {
        var x = pts[ni + 1].x - L.nodeW / 2;
        rrect(ctx, x, cy - L.nodeH / 2, L.nodeW, L.nodeH, 7); ctx.fillStyle = pal.surface; ctx.fill(); ctx.strokeStyle = pal[lane.k]; ctx.lineWidth = nd.cache ? 2 : 1.2; ctx.stroke();
        ctx.font = '600 ' + (L.small ? 9.5 : 11) + 'px Inter, system-ui, sans-serif';
        text(ctx, fit(ctx, nd.l, L.nodeW - 6), pts[ni + 1].x, cy, { size: L.small ? 9.5 : 11, weight: 600, color: pal.ink, align: 'center' });
      });
      /* veredicto real (solo cuando llega del modelo) */
      var rv = p.reveal && p.reveal[lane.k], bx = L.osm.x - 8;
      if (rv) {
        var star = p.reveal.best === lane.k ? '★ ' : '';
        var lbl = star + (rv.short || rv.txt); ctx.font = '700 ' + (L.small ? 9.5 : 11) + 'px Inter, system-ui, sans-serif';
        var lw = ctx.measureText(lbl).width + 14; rrect(ctx, bx - lw + 4, cy - L.laneH * 0.5 + 1, lw, 18, 9); ctx.globalAlpha = 0.14; ctx.fillStyle = rv.ok ? pal.ok : pal.bad; ctx.fill(); ctx.globalAlpha = 1;
        text(ctx, lbl, bx - 3, cy - L.laneH * 0.5 + 10, { size: L.small ? 9.5 : 11, weight: 700, color: rv.ok ? pal.ok : pal.bad, align: 'right' });
        if (p.reveal.best === lane.k) { rrect(ctx, 4, L.top + L.laneH * li + 2, W - L.osm.w - 18, L.laneH - 4, 8); ctx.strokeStyle = pal.ok; ctx.lineWidth = 1.5; ctx.stroke(); }
      } else if (!p.static) text(ctx, 'evaluando…', bx, cy - L.laneH * 0.5 + 9, { size: L.small ? 9.5 : 10.5, color: pal.muted, align: 'right' });
    });
    /* leyenda mínima */
    if (animated && !L.small) text(ctx, '● solicitud   ● respuesta del caché   ● respuesta del mapa  (escala visual)', 14, H - 5, { size: 10, color: pal.muted, base: 'alphabetic' });
  }

  /* ---------- Pruebas del modelo: 4 variantes según lo que comprueban ---------- */
  var TEST_TITLES = {
    calc: ['Entradas', 'Fórmula del modelo', 'Cálculo a mano'],
    beh: ['Cambia una variable', 'El modelo recalcula', 'Se compara el efecto'],
    req: ['Latencia', 'Disponibilidad', 'Capacidad', 'Costo', 'Esfuerzo'],
    dec: ['A', 'B', 'C']
  };
  /* p: {group, t01, durMs, reveal: null|'pass'|'fail', name, reduced, static} */
  function drawTest(ctx, W, H, p, pal) {
    var t = clamp(p.t01, 0, 1) * p.durMs, animated = !p.static && !p.reduced, small = W < 520;
    ctx.clearRect(0, 0, W, H);
    rrect(ctx, 0.5, 0.5, W - 1, H - 1, 12); ctx.fillStyle = pal.surface2; ctx.fill();
    var titles = TEST_TITLES[p.group] || TEST_TITLES.calc, cy = H * 0.5, i;
    var pulse = animated ? (t / 900) % titles.length : -1;
    if (p.group === 'req') {
      var gw = (W - 40) / titles.length;
      titles.forEach(function (tt, k) {
        var cx = 20 + gw * (k + 0.5), on = animated && Math.floor(pulse) === k;
        rrect(ctx, cx - gw * 0.42, cy - 30, gw * 0.84, 60, 10); ctx.fillStyle = pal.surface; ctx.fill(); ctx.strokeStyle = on ? pal.teal : pal.line; ctx.lineWidth = on ? 2.5 : 1.2; ctx.stroke();
        text(ctx, tt, cx, cy - 6, { size: small ? 9.5 : 12, weight: 600, color: pal.ink, align: 'center' });
        text(ctx, on ? 'revisando…' : p.reveal ? '' : '·', cx, cy + 14, { size: 10.5, color: pal.muted, align: 'center' });
      });
    } else if (p.group === 'dec') {
      var bw = Math.min(90, (W - 60) / 3), colors = [pal.A, pal.B, pal.C];
      titles.forEach(function (tt, k) {
        var cx = W / 2 + (k - 1) * (bw + 24), hgt = 30 + (animated ? (Math.sin(t / 420 + k * 2.1) * 0.5 + 0.5) * 60 : 45);
        ctx.fillStyle = colors[k]; ctx.globalAlpha = 0.85; rrect(ctx, cx - bw / 2, cy + 40 - hgt, bw, hgt, 6); ctx.fill(); ctx.globalAlpha = 1;
        text(ctx, tt, cx, cy + 54, { size: 13, weight: 700, color: pal.ink, align: 'center' });
      });
      text(ctx, 'Se compara el puntaje de cada alternativa', W / 2, 20, { size: 11.5, color: pal.muted, align: 'center' });
    } else {
      var bwid = Math.min(150, (W - 60) / 3.2), xs = [W * 0.2, W * 0.5, W * 0.8];
      titles.forEach(function (tt, k) {
        var on = animated && Math.floor(pulse) === k;
        rrect(ctx, xs[k] - bwid / 2, cy - 26, bwid, 52, 10); ctx.fillStyle = pal.surface; ctx.fill(); ctx.strokeStyle = on ? pal.teal : pal.line; ctx.lineWidth = on ? 2.5 : 1.2; ctx.stroke();
        ctx.font = '600 ' + (small ? 10 : 12) + 'px Inter, system-ui, sans-serif';
        text(ctx, fit(ctx, tt, bwid - 10), xs[k], cy, { size: small ? 10 : 12, weight: 600, color: pal.ink, align: 'center' });
        if (k < 2) {
          var x0 = xs[k] + bwid / 2 + 4, x1 = xs[k + 1] - bwid / 2 - 4;
          ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x1, cy); ctx.strokeStyle = pal.muted; ctx.lineWidth = 1.5; ctx.stroke();
          if (animated) { var u = frac(t / 900 + k * 0.33); ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * u, cy, 3.5, 0, 6.2832); ctx.fillStyle = pal.teal; ctx.fill(); }
        }
      });
      if (p.group === 'calc') text(ctx, 'D, ρ y R se recalculan con las fórmulas del documento', W / 2, 20, { size: 11.5, color: pal.muted, align: 'center' });
      else text(ctx, 'Se mueve una variable y se observa qué hace el modelo', W / 2, 20, { size: 11.5, color: pal.muted, align: 'center' });
    }
    if (p.reveal) {
      var ok = p.reveal === 'pass', rx = W - 34, ry = 28;
      ctx.beginPath(); ctx.arc(rx, ry, 16, 0, 6.2832); ctx.fillStyle = ok ? pal.ok : pal.bad; ctx.fill();
      text(ctx, ok ? '✓' : '✕', rx, ry + 1, { size: 18, weight: 700, color: '#fff', align: 'center' });
    } else if (!p.static) text(ctx, 'ejecutando…', W - 14, 20, { size: 11, color: pal.muted, align: 'right' });
    text(ctx, p.name || '', 14, H - 12, { size: 11.5, weight: 600, color: pal.ink });
  }

  return { drawScenario: drawScenario, drawTest: drawTest, LANES: LANES };
});
