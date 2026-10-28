/* Pruebas del modelo de Locus. Se ejecutan en Node (node run_tests.js) y dentro del simulador (pestaña Pruebas). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LocusTests = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 1e-6 : tol);
  const f = (x, d) => (typeof x === 'number' ? Number(x.toFixed(d === undefined ? 3 : d)) : x);

  function suite(M) {
    const P = M.PARAMS, c = P.common;
    const proj = () => M.defaultProject();
    const ref = () => Object.assign({}, M.defaultScenarios()[0].vars);
    const T = [];
    const add = (id, name, desc, run) => T.push({ id: id, name: name, desc: desc, run: run });

    add('P1', 'Cálculo manual del monolito',
      'Recalcula a mano λ, la demanda D, la utilización ρ y el tiempo de respuesta R del monolito y los compara con el modelo.',
      () => {
        const v = { users: 120, reqPerMin: 3, hit: 0.5, rtt: 100, pois: 20 };
        const r = M.computeArch('B', v, proj());
        const lambda = 120 * 3 / 60;
        const D = 6 + 0.05 * 20 + 20 * 20 * 2 / 1000 + (1 - 0.5) * 0.4 * 20 + 0.5 * 2;
        const k = r.services[0].inst;
        const rho = lambda * D / 1000 / k;
        const R = D / (1 - rho);
        return { expected: 'D=' + f(D) + ' ms, ρ=' + f(rho, 5) + ', R=' + f(R), obtained: 'D=' + f(r.services[0].D) + ' ms, ρ=' + f(r.services[0].rho, 5) + ', R=' + f(r.services[0].R),
                 pass: near(r.services[0].D, D) && near(r.services[0].rho, rho) && near(r.services[0].R, R) };
      });

    add('P2', 'Más latencia de red, más latencia total',
      'Si solo aumenta el RTT del celular, la latencia p95 de cada alternativa debe subir.',
      () => {
        const lo = M.runScenario(Object.assign(ref(), { rtt: 50 }), proj()), hi = M.runScenario(Object.assign(ref(), { rtt: 400 }), proj());
        const ok = M.ARCHS.every(k => hi.results[k].latencyP95 > lo.results[k].latencyP95);
        return { expected: 'p95(400 ms) > p95(50 ms) en A, B y C', obtained: M.ARCHS.map(k => k + ': ' + f(lo.results[k].latencyP95, 0) + ' → ' + f(hi.results[k].latencyP95, 0)).join(' | '), pass: ok };
      });

    add('P3', 'Más caché, menos latencia y más disponibilidad',
      'Al subir los aciertos de caché de 0.1 a 0.9, el p95 no sube y la disponibilidad no baja en ninguna alternativa.',
      () => {
        const lo = M.runScenario(Object.assign(ref(), { hit: 0.1 }), proj()), hi = M.runScenario(Object.assign(ref(), { hit: 0.9 }), proj());
        const ok = M.ARCHS.every(k => hi.results[k].latencyP95 <= lo.results[k].latencyP95 && hi.results[k].availability >= lo.results[k].availability);
        return { expected: 'p95 baja y disponibilidad sube o se mantiene', obtained: M.ARCHS.map(k => k + ': ' + f(lo.results[k].latencyP95, 0) + ' → ' + f(hi.results[k].latencyP95, 0) + ' ms; ' + f(lo.results[k].availability * 100, 3) + ' → ' + f(hi.results[k].availability * 100, 3) + ' %').join(' | '), pass: ok };
      });

    add('P4', 'El presupuesto limita las instancias',
      'Con un presupuesto de 1 USD el monolito y los microservicios no pueden pagar su infraestructura y deben incumplir el requisito de costo; el cliente directo no.',
      () => {
        const q = Object.assign(proj(), { budgetUsd: 1 });
        const r = M.runScenario(ref(), q).results;
        const costFail = k => !r[k].checks.find(x => x.key === 'cost').ok;
        return { expected: 'A cumple costo; B y C lo incumplen y usan 1 instancia por servicio', obtained: 'A: ' + f(r.A.cost, 2) + ' USD; B: ' + f(r.B.cost, 2) + ' USD con ' + r.B.services.map(s => s.inst) + '; C: ' + f(r.C.cost, 2) + ' USD con ' + r.C.services.map(s => s.inst),
                 pass: !costFail('A') && costFail('B') && costFail('C') && r.B.services.every(s => s.inst === 1) && r.C.services.every(s => s.inst === 1) };
      });

    add('P5', 'La recomendación coincide con el cálculo',
      'En los 4 escenarios predefinidos, la alternativa recomendada es la de mayor puntaje entre las que cumplen todos los requisitos obligatorios, recalculado fuera del modelo.',
      () => {
        const rows = [];
        let ok = true;
        M.defaultScenarios().forEach(s => {
          const p = proj(), run = M.runScenario(s.vars, p);
          const feas = M.ARCHS.filter(k => run.results[k].feasible);
          let best = null;
          feas.forEach(k => { if (best === null || run.results[k].total > run.results[best].total) best = k; });
          if (best !== run.recommendation.best) ok = false;
          rows.push(s.id + '→' + (run.recommendation.best || 'ninguna'));
        });
        return { expected: 'Recomendación = máximo puntaje entre alternativas factibles (o «ninguna» si no hay)', obtained: rows.join(', '), pass: ok };
      });

    add('P6', 'Escenario imposible: ninguna alternativa',
      'Con 20 000 usuarios, 30 solicitudes por minuto y 50 USD de presupuesto, el simulador no debe inventar una recomendación.',
      () => {
        const q = Object.assign(proj(), { budgetUsd: 50 });
        const run = M.runScenario({ users: 20000, reqPerMin: 30, hit: 0.2, rtt: 100, pois: 30 }, q);
        return { expected: 'status = none y sin alternativa recomendada', obtained: 'status = ' + run.recommendation.status + ', mejor = ' + run.recommendation.best, pass: run.recommendation.status === 'none' && run.recommendation.best === null };
      });

    add('P7', 'Validación de entradas inválidas',
      'Rechaza usuarios negativos, caché mayor a 0.99, texto en lugar de número, lugares decimales y pesos que suman 0.',
      () => {
        const p = proj();
        const cases = [
          M.validate(Object.assign(ref(), { users: -5 }), p),
          M.validate(Object.assign(ref(), { hit: 1.2 }), p),
          M.validate(Object.assign(ref(), { rtt: NaN }), p),
          M.validate(Object.assign(ref(), { pois: 7.5 }), p),
          M.validate(ref(), Object.assign(proj(), { weights: { lat: 0, av: 0, cost: 0, scal: 0, simp: 0 } })),
          M.validate(ref(), p)
        ];
        const ok = cases.slice(0, 5).every(e => e.length > 0) && cases[5].length === 0 && M.runScenario(Object.assign(ref(), { users: -5 }), p).ok === false;
        return { expected: '5 entradas inválidas rechazadas y la entrada de referencia aceptada', obtained: cases.map(e => e.length).join(' / ') + ' errores', pass: ok };
      });

    add('P8', 'Resultados repetibles',
      'Ejecutar dos veces el mismo escenario produce exactamente los mismos números.',
      () => {
        const a = JSON.stringify(M.runScenario(ref(), proj())), b = JSON.stringify(M.runScenario(ref(), proj()));
        return { expected: 'Salidas idénticas', obtained: a === b ? 'Idénticas' : 'Distintas', pass: a === b };
      });

    add('P9', 'Los pesos cambian la decisión',
      'En el escenario de referencia, con todo el peso en costo gana la alternativa más barata que cumple; con todo el peso en disponibilidad gana la más disponible. Las dos respuestas deben ser distintas.',
      () => {
        const v = ref();
        const pc = Object.assign(proj(), { weights: { lat: 0, av: 0, cost: 1, scal: 0, simp: 0 } });
        const pa = Object.assign(proj(), { weights: { lat: 0, av: 1, cost: 0, scal: 0, simp: 0 } });
        const rc = M.runScenario(v, pc), ra = M.runScenario(v, pa);
        const feas = M.ARCHS.filter(k => rc.results[k].feasible);
        const cheapest = feas.slice().sort((x, y) => rc.results[x].cost - rc.results[y].cost)[0];
        const mostAvail = feas.slice().sort((x, y) => ra.results[y].availability - ra.results[x].availability)[0];
        return { expected: 'costo → ' + cheapest + '; disponibilidad → ' + mostAvail + '; distintas', obtained: 'costo → ' + rc.recommendation.best + '; disponibilidad → ' + ra.recommendation.best,
                 pass: rc.recommendation.best === cheapest && ra.recommendation.best === mostAvail && cheapest !== mostAvail };
      });

    add('P10', 'La API externa limita al cliente directo',
      'Al duplicar los usuarios de la temporada alta, el margen de capacidad de A debe caer a la mitad (su techo no depende de servidores propios).',
      () => {
        const v1 = Object.assign({}, M.defaultScenarios()[1].vars), v2 = Object.assign({}, v1, { users: v1.users * 2 });
        const a = M.computeArch('A', v1, proj()), b = M.computeArch('A', v2, proj());
        return { expected: 'margen(2U) = margen(U) / 2', obtained: f(a.headroom, 3) + ' → ' + f(b.headroom, 3), pass: near(b.headroom, a.headroom / 2, 1e-9) };
      });

    add('P11', 'Cada requisito obligatorio puede descartar una alternativa',
      'Un requisito de latencia imposible (200 ms) deja fuera a las tres alternativas y la razón registrada es la latencia.',
      () => {
        const q = Object.assign(proj(), { latMaxMs: 200 });
        const run = M.runScenario(ref(), q);
        const ok = M.ARCHS.every(k => !run.results[k].feasible && run.results[k].checks.find(x => x.key === 'lat').ok === false);
        return { expected: 'A, B y C incumplen latencia', obtained: M.ARCHS.map(k => k + ': ' + f(run.results[k].latencyP95, 0) + ' ms').join(' | '), pass: ok };
      });

    add('P12', 'Overpass propio: menos latencia y menos carga externa, a cambio de costo',
      'En «Se hace viral», activar Overpass propio baja el p95 y el uso de la API externa del monolito, quita el límite 429 del cliente directo y deja una alternativa que cumple.',
      () => {
        const v = Object.assign({}, M.defaultScenarios()[2].vars);
        const on = M.runScenario(Object.assign({}, v, { selfHost: true }), proj()), off = M.runScenario(Object.assign({}, v, { selfHost: false }), proj());
        const b1 = on.results.B, b0 = off.results.B;
        const ok = b1.latencyP95 < b0.latencyP95 && b1.uExt < b0.uExt && on.recommendation.status === 'ok' && on.results.A.pRateLimit === 0;
        return { expected: 'p95(con) < p95(sin) y uso externo(con) < uso externo(sin); recomendación válida con la opción', obtained: 'B p95 ' + f(b0.latencyP95, 0) + ' → ' + f(b1.latencyP95, 0) + ' ms; uso externo ' + f(b0.uExt, 2) + ' → ' + f(b1.uExt, 2) + '; recomendada: ' + on.recommendation.best, pass: ok };
      });

    return T;
  }

  function runAll(M) {
    return suite(M).map(t => {
      let r;
      try { r = t.run(); } catch (e) { r = { expected: '', obtained: 'Error: ' + e.message, pass: false }; }
      return { id: t.id, name: t.name, desc: t.desc, expected: r.expected, obtained: r.obtained, pass: r.pass };
    });
  }
  return { suite: suite, runAll: runAll };
});
