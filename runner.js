/* Orquestador de ejecución del simulador de Locus.
 * Separa tres cosas: (1) la ejecución real (item.execute), (2) la duración visual (minMs) y (3) el resultado.
 * La animación nunca decide el resultado: un ítem solo pasa a «completada / con observaciones / fallida»
 * cuando existe el resultado real Y ya transcurrió la duración visual (si la animación está activa).
 * Funciona en Node (pruebas con reloj falso) y en el navegador (requestAnimationFrame). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LocusRunner = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function create(env) {
    env = env || {};
    var now = env.now || function () { return Date.now(); };
    var raf = env.raf || function (f) { return setTimeout(function () { f(now()); }, 16); };
    var caf = env.caf || function (h) { clearTimeout(h); };
    var onChange = env.onChange || function () {};
    var onFrame = env.onFrame || function () {};
    var st = null, handle = null, runSeq = 0;

    function emitChange() { try { onChange(snapshot()); } catch (e) { /* la interfaz no debe romper la ejecución */ } }
    function emitFrame() { try { onFrame(snapshot()); } catch (e) { /* idem */ } }

    function snapshot() {
      if (!st) return { runId: 0, status: 'idle', items: [], counts: counts([]), idx: -1, percent: 0, animate: true, minMs: 5000, stopping: false };
      var items = st.items.map(function (it) {
        return { id: it.id, label: it.label, meta: it.meta, state: it.state, summary: it.summary, result: it.result, error: it.error,
          startedAt: it.startedAt, doneAt: it.doneAt, t01: it.t01, waiting: it.waiting };
      });
      var c = counts(items), total = items.length - c.skipped;
      return { runId: st.runId, status: st.status, items: items, counts: c, idx: st.idx, animate: st.animate, minMs: st.minMs, stopping: st.stopRequested,
        percent: total > 0 ? Math.round(100 * (c.done + c.warn + c.error) / total) : 0 };
    }
    function counts(items) {
      var c = { total: items.length, pending: 0, running: 0, done: 0, warn: 0, error: 0, skipped: 0 };
      items.forEach(function (i) { c[i.state] = (c[i.state] || 0) + 1; });
      return c;
    }

    function schedule() { if (!handle && st && st.status === 'running') handle = raf(tick); }
    function cancelFrame() { if (handle) { caf(handle); handle = null; } }

    function begin(i) {
      var token = st.runId, it = st.items[i];
      st.idx = i;
      it.state = 'running'; it.startedAt = now(); it.t01 = 0; it.waiting = false;
      var out;
      try { out = it.execute(); } catch (e) { it._err = e; out = undefined; }
      if (it._err) { /* se revelará como error en el siguiente cuadro */ }
      else if (out && typeof out.then === 'function') {
        out.then(function (r) { if (st && st.runId === token) { it._res = r; it.ready = true; } },
                 function (e) { if (st && st.runId === token) { it._err = e || new Error('Error desconocido'); } });
      } else { it._res = out; it.ready = true; }
      emitChange();
      schedule();
    }

    function reveal(it) {
      var c;
      if (it._err) {
        it.state = 'error'; it.error = String(it._err && it._err.message || it._err); it.summary = 'Falló la ejecución: ' + it.error;
      } else {
        try { c = it.classify ? it.classify(it._res) : { state: 'done' }; } catch (e) { c = { state: 'error', summary: 'No se pudo interpretar el resultado: ' + e.message }; }
        it.state = c.state === 'warn' || c.state === 'error' ? c.state : 'done';
        it.summary = c.summary || '';
        it.result = it._res;
        if (it.commit) { try { it.commit(it._res); } catch (e) { it.state = 'error'; it.error = e.message; it.summary = 'No se pudo guardar el resultado: ' + e.message; } }
      }
      it.t01 = 1; it.waiting = false; it.doneAt = now();
    }

    function finish() {
      st.status = 'finished'; st.finishedAt = now();
      cancelFrame();
      emitChange();
    }

    function advance() {
      var i = st.idx + 1;
      if (st.stopRequested) {
        for (var k = i; k < st.items.length; k++) { st.items[k].state = 'skipped'; st.items[k].summary = 'Omitida: la secuencia se detuvo antes de empezar esta prueba.'; }
        return finish();
      }
      if (i >= st.items.length) return finish();
      begin(i);
    }

    function tick() {
      handle = null;
      if (!st || st.status !== 'running') return;
      var it = st.items[st.idx];
      if (!it || it.state !== 'running') return;
      if (it._err) { reveal(it); emitChange(); return advance(); }
      var el = now() - it.startedAt;
      it.t01 = st.animate ? Math.min(1, el / st.minMs) : 1;
      if (it.t01 >= 1 && it.ready) { reveal(it); emitChange(); return advance(); }
      if (it.t01 >= 1 && !it.waiting) { it.waiting = true; emitChange(); }
      else emitFrame();
      schedule();
    }

    return {
      /* items: [{id,label,meta,execute(),classify(result)->{state,summary},commit(result)}] */
      start: function (items, opts) {
        if (!items || !items.length || (st && st.status === 'running')) return false;
        opts = opts || {};
        st = { runId: ++runSeq, status: 'running', idx: -1, animate: opts.animate !== false, minMs: opts.minMs || 5000, stopRequested: false,
          startedAt: now(), items: items.map(function (x) {
            return { id: x.id, label: x.label, meta: x.meta, execute: x.execute, classify: x.classify, commit: x.commit, state: 'pending', summary: '', result: null,
              error: null, startedAt: null, doneAt: null, t01: 0, waiting: false, ready: false, _res: undefined, _err: null };
          }) };
        begin(0);
        return true;
      },
      /* Acorta la animación de la prueba actual y de las siguientes; el resultado real no cambia. */
      skip: function () { if (st && st.status === 'running') { st.animate = false; cancelFrame(); tick(); } },
      /* No hay cancelación real del cálculo: solo evita que empiecen las pruebas siguientes. */
      stopAfterCurrent: function () { if (st && st.status === 'running') { st.stopRequested = true; emitChange(); } },
      reset: function () { cancelFrame(); st = null; runSeq++; emitChange(); },
      snapshot: snapshot,
      isRunning: function () { return !!st && st.status === 'running'; },
      hasFrameHandle: function () { return !!handle; }
    };
  }
  return { create: create };
});
