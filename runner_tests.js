/* Pruebas del orquestador de ejecución (reloj falso, sin navegador). Se ejecutan con run_tests.js. */
const R = require('./runner.js');

function harness(opts) {
  let t = 0, q = [], nextId = 1, cancelled = 0;
  const changes = [], frames = [];
  const runner = R.create({
    now: () => t,
    raf: (f) => { const id = nextId++; q.push({ id, f }); return id; },
    caf: (id) => { cancelled++; q = q.filter(x => x.id !== id); },
    onChange: (s) => changes.push(s), onFrame: (s) => frames.push(s)
  });
  // avanza el reloj y dispara los cuadros pendientes
  const step = (ms) => { t += ms; const cur = q; q = []; cur.forEach(x => x.f(t)); };
  const run = (ms, every) => { for (let e = 0; e < ms; e += (every || 100)) step(every || 100); };
  return { runner, step, run, changes, frames, pending: () => q.length, cancelled: () => cancelled, time: () => t };
}
const item = (id, o) => Object.assign({ id, label: id, execute: () => ({ ok: true }), classify: () => ({ state: 'done', summary: 'ok' }) }, o || {});

const T = [];
const add = (id, name, fn) => T.push({ id, name, fn });

add('R1', 'La animación dura al menos 5 s aunque el resultado sea inmediato', () => {
  const h = harness(); h.runner.start([item('a')], { minMs: 5000 });
  h.run(4900); const mid = h.runner.snapshot().items[0].state;
  h.run(300); const end = h.runner.snapshot().items[0].state;
  return { pass: mid === 'running' && end === 'done', obtained: 'a los 4,9 s: ' + mid + ' · a los 5,2 s: ' + end };
});
add('R2', 'Una prueba lenta sigue esperando el resultado real', () => {
  let resolve; const p = new Promise(r => { resolve = r; });
  const h = harness(); h.runner.start([item('a', { execute: () => p })], { minMs: 5000 });
  h.run(8000); const s = h.runner.snapshot().items[0];
  return { pass: s.state === 'running' && s.waiting === true && s.t01 === 1, obtained: 'a los 8 s: ' + s.state + ', esperando=' + s.waiting };
});
add('R3', 'Una prueba que falla no se presenta como exitosa', () => {
  const h = harness();
  h.runner.start([item('a', { execute: () => { throw new Error('boom'); } }), item('b')], { minMs: 5000 });
  h.run(200); const a = h.runner.snapshot().items[0];
  return { pass: a.state === 'error' && /boom/.test(a.error), obtained: a.state + ' · ' + a.error };
});
add('R4', 'La clasificación real manda: «con observaciones» y «fallida» se respetan', () => {
  const h = harness();
  h.runner.start([item('a', { classify: () => ({ state: 'warn' }) }), item('b', { classify: () => ({ state: 'error' }) }), item('c')], { animate: false });
  h.run(500, 20); const s = h.runner.snapshot();
  return { pass: s.items.map(i => i.state).join() === 'warn,error,done' && s.status === 'finished', obtained: s.items.map(i => i.state).join() };
});
add('R5', 'Ejecución secuencial: una a la vez y las pendientes no figuran como completadas', () => {
  const h = harness(); h.runner.start([item('a'), item('b'), item('c')], { minMs: 1000 });
  h.run(1100, 50); const s = h.runner.snapshot();
  return { pass: s.items.map(i => i.state).join() === 'done,running,pending' && s.counts.running === 1 && s.percent === 33, obtained: s.items.map(i => i.state).join() + ' · ' + s.percent + ' %' };
});
add('R6', 'Reiniciar descarta resultados tardíos de la ejecución anterior', () => {
  let resolve; const p = new Promise(r => { resolve = r; });
  let committed = 0;
  const h = harness(); h.runner.start([item('a', { execute: () => p, commit: () => { committed++; } })], { minMs: 1000 });
  h.run(500); h.runner.reset(); resolve({ ok: true });
  h.runner.start([item('n', { commit: () => { committed += 10; } })], { minMs: 1000 });
  return new Promise(res => setTimeout(() => { h.run(1500); const s = h.runner.snapshot();
    res({ pass: committed === 10 && s.items.length === 1 && s.items[0].id === 'n', obtained: 'commits=' + committed + ', ítems=' + s.items.map(i => i.id).join() }); }, 5));
});
add('R7', 'Saltar la animación no cambia los resultados', () => {
  const h = harness(); h.runner.start([item('a', { classify: () => ({ state: 'warn' }) }), item('b')], { minMs: 5000 });
  h.run(300); h.runner.skip(); h.run(300, 20); const s = h.runner.snapshot();
  return { pass: s.status === 'finished' && s.items[0].state === 'warn' && s.items[1].state === 'done' && h.time() < 1500, obtained: s.items.map(i => i.state).join() + ' a los ' + h.time() + ' ms' };
});
add('R8', 'Detener evita que empiecen las siguientes, sin borrar la actual', () => {
  const h = harness(); let ran = 0;
  h.runner.start([item('a', { execute: () => { ran++; return 1; } }), item('b', { execute: () => { ran++; return 1; } }), item('c', { execute: () => { ran++; return 1; } })], { minMs: 1000 });
  h.run(300); h.runner.stopAfterCurrent(); h.run(1500, 50); const s = h.runner.snapshot();
  return { pass: s.items.map(i => i.state).join() === 'done,skipped,skipped' && ran === 1 && s.status === 'finished', obtained: s.items.map(i => i.state).join() + ' · ejecutadas=' + ran };
});
add('R9', 'Sin temporizadores colgados al terminar o reiniciar', () => {
  const h = harness(); h.runner.start([item('a')], { minMs: 500 }); h.run(1000, 50);
  const afterFinish = h.pending() + (h.runner.hasFrameHandle() ? 1 : 0);
  h.runner.start([item('b')], { minMs: 5000 }); h.run(300); h.runner.reset();
  const afterReset = h.pending() + (h.runner.hasFrameHandle() ? 1 : 0);
  return { pass: afterFinish === 0 && afterReset === 0, obtained: 'pendientes tras terminar=' + afterFinish + ', tras reiniciar=' + afterReset };
});
add('R10', 'No se puede iniciar otra ejecución mientras hay una en curso', () => {
  const h = harness(); const a = h.runner.start([item('a')], { minMs: 1000 }); const b = h.runner.start([item('x')], { minMs: 1000 });
  return { pass: a === true && b === false && h.runner.snapshot().items[0].id === 'a', obtained: 'primera=' + a + ', segunda=' + b };
});
add('R11', 'El resultado real solo se guarda al terminar la animación', () => {
  let saved = false;
  const h = harness(); h.runner.start([item('a', { commit: () => { saved = true; } })], { minMs: 5000 });
  h.run(2500); const early = saved; h.run(3000);
  return { pass: early === false && saved === true, obtained: 'a los 2,5 s guardado=' + early + ' · a los 5,5 s guardado=' + saved };
});
add('R12', 'Ejecuciones consecutivas no reutilizan estados', () => {
  const h = harness(); h.runner.start([item('a', { classify: () => ({ state: 'error' }) })], { animate: false }); h.run(200, 20);
  h.runner.start([item('b')], { animate: false }); h.run(200, 20); const s = h.runner.snapshot();
  return { pass: s.items.length === 1 && s.items[0].id === 'b' && s.items[0].state === 'done' && s.counts.error === 0, obtained: s.items.map(i => i.id + ':' + i.state).join() + ' · errores=' + s.counts.error };
});

async function runAll() {
  const out = [];
  for (const t of T) {
    let r; try { r = await t.fn(); } catch (e) { r = { pass: false, obtained: 'Error: ' + e.message }; }
    out.push({ id: t.id, name: t.name, pass: r.pass, obtained: r.obtained });
  }
  return out;
}
module.exports = { runAll };
