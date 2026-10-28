/* Locus · Simulador de arquitectura (Actividad 9) — modelo de simulación.
   Funciones puras, sin DOM. Funciona en navegador (global LocusModel) y Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LocusModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Parámetros del modelo (supuestos documentados) ---------- */
  const PARAMS = {
    common: {
      rhoTarget: 0.7,          // utilización objetivo del autoescalado
      rhoMax: 0.98,            // tope numérico para evitar división por cero
      rhoExtTarget: 0.5,       // uso máximo cómodo de la API pública (es un servicio compartido con límites)
      tExtBaseMs: 900,         // latencia base de Overpass/Nominatim
      tExtPerPoiMs: 25,        // ms extra por cada lugar devuelto
      routeUsPerN2: 2,         // µs por n² del vecino más cercano (servidor)
      clientCpuFactor: 8,      // el teléfono es ~8 veces más lento que el servidor
      renderMs: 120,           // pintar el itinerario en pantalla
      cacheReadMs: 2,          // leer una respuesta del caché
      parseMsPerPoi: 0.4,      // interpretar la respuesta del mapa por lugar
      extAvail: 0.99,          // disponibilidad de los espejos públicos de Overpass
      dbAvail: 0.9995,         // Firestore
      hostingAvail: 0.9995,    // Firebase Hosting (la página)
      instAvail: 0.995,        // una instancia de servidor
      minReplicas: 2,          // réplicas mínimas deseadas por servicio
      dutyHoursPerDay: 3,      // horas al día a la carga simulada
      daysPerMonth: 30,
      freeOpsPerMonth: 600000, // cuota gratuita de Firestore (20 000 al día)
      usdPerMillionOps: 0.9,
      opsPerRequest: 0.2,      // 1 de cada 10 solicitudes guarda un itinerario (2 operaciones)
      extCapPerIpRps: 8,       // solicitudes por segundo que tolera la API pública por IP
      extCapGlobalRps: 40,     // parte de la capacidad pública que le corresponde a Locus con clientes en IP distintas
      rateLimitPerIpPerMin: 6, // solicitudes por minuto por usuario antes de recibir 429
      rateLimitBackoffMs: 2000,
      p95Queue: 3.0,           // factor de cola para el percentil 95
      p95Ext: 1.5,             // factor de la API externa para el percentil 95
      selfHostTExtBaseMs: 300, // Overpass propio: consulta local, sin cola pública
      selfHostCapRps: 60,      // solicitudes por segundo que atiende el Overpass propio
      selfHostUsd: 30,         // costo mensual de la máquina de Overpass propio
      p95Ramp: 0.05            // proporción de fallos de caché a partir de la cual el p95 ve la API externa completa
    },
    A: { label: 'Cliente directo', short: 'A', localCacheFactor: 0.35, fixedUsd: 0, effortPw: 6,
         services: [] },
    B: { label: 'Monolito con caché', short: 'B', fixedUsd: 15, effortPw: 10, hops: 0,
         services: [
           { key: 'mono', name: 'Servidor monolítico', base: 6, perPoi: 0.05, route: true, cache: true,
             costUsd: 20, maxInst: 6, egress: true }
         ] },
    C: { label: 'Microservicios', short: 'C', fixedUsd: 45, effortPw: 24, hops: 3, hopBaseMs: 12, hopPerPoiMs: 0.4,
         services: [
           { key: 'gw', name: 'Gateway', base: 3, perPoi: 0.15, route: false, cache: false, costUsd: 12, maxInst: 8, egress: false },
           { key: 'pois', name: 'Servicio de lugares', base: 4, perPoi: 0.05, route: false, cache: true, costUsd: 12, maxInst: 8, egress: true },
           { key: 'route', name: 'Servicio de rutas', base: 3, perPoi: 0.1, route: true, cache: false, costUsd: 12, maxInst: 8, egress: false },
           { key: 'itin', name: 'Servicio de itinerarios', base: 4, perPoi: 0.1, route: false, cache: false, costUsd: 12, maxInst: 8, egress: false }
         ] }
  };
  const ARCHS = ['A', 'B', 'C'];

  /* ---------- Variables y validación ---------- */
  const VARS = {
    users:     { label: 'Usuarios simultáneos en el pico', unit: 'usuarios', min: 1, max: 50000, int: true, step: 1 },
    reqPerMin: { label: 'Solicitudes por usuario',        unit: 'por minuto', min: 0.1, max: 30, step: 0.1 },
    hit:       { label: 'Aciertos de caché',              unit: 'fracción', min: 0, max: 0.99, step: 0.01 },
    rtt:       { label: 'Latencia de red del celular',    unit: 'ms', min: 5, max: 2000, step: 5 },
    pois:      { label: 'Lugares por itinerario',         unit: 'lugares', min: 3, max: 60, int: true, step: 1 }
  };
  const PROJECT_FIELDS = {
    latMaxMs:   { label: 'Latencia máxima (p95)', min: 200, max: 60000 },
    availMinPct:{ label: 'Disponibilidad mínima (%)', min: 90, max: 99.999 },
    budgetUsd:  { label: 'Presupuesto mensual (USD)', min: 0, max: 100000 },
    teamSize:   { label: 'Integrantes del equipo', min: 1, max: 30, int: true },
    weeksAvail: { label: 'Semanas disponibles', min: 1, max: 104 },
    dedication: { label: 'Dedicación al proyecto', min: 0.05, max: 1 }
  };
  const WEIGHT_KEYS = ['lat', 'av', 'cost', 'scal', 'simp'];

  function defaultProject() {
    return {
      name: 'Locus',
      description: 'Plataforma web que arma itinerarios de viaje por Colombia con datos de OpenStreetMap, ordena las paradas por cercanía y guarda el plan en Firebase.',
      users: 'Turistas que planean un viaje a un destino nuevo en Colombia, desde un celular y con conexión móvil variable.',
      latMaxMs: 5000, availMinPct: 99, budgetUsd: 120,
      teamSize: 3, weeksAvail: 12, dedication: 0.5,
      weights: { lat: 0.25, av: 0.2, cost: 0.2, scal: 0.15, simp: 0.2 }
    };
  }
  function defaultScenarios() {
    return [
      { id: 'ref', name: 'Referencia: piloto', base: true, vars: { users: 50, reqPerMin: 2, hit: 0.4, rtt: 80, pois: 20 } },
      { id: 'alta', name: 'Temporada alta', vars: { users: 600, reqPerMin: 3, hit: 0.6, rtt: 120, pois: 25 } },
      { id: 'viral', name: 'Se hace viral', vars: { users: 3000, reqPerMin: 3, hit: 0.9, rtt: 150, pois: 30, selfHost: true } },
      { id: 'rural', name: 'Red móvil rural', vars: { users: 150, reqPerMin: 2, hit: 0.3, rtt: 450, pois: 20 } }
    ];
  }

  function validate(v, proj) {
    const errs = [];
    const chk = (val, def, label) => {
      if (typeof val !== 'number' || !isFinite(val)) { errs.push(label + ': escribe un número.'); return; }
      if (val < def.min || val > def.max) errs.push(label + ': debe estar entre ' + def.min + ' y ' + def.max + '.');
      else if (def.int && !Number.isInteger(val)) errs.push(label + ': debe ser un número entero.');
    };
    if (v) Object.keys(VARS).forEach(k => chk(v[k], VARS[k], VARS[k].label));
    if (v && v.selfHost !== undefined && typeof v.selfHost !== 'boolean') errs.push('Overpass propio: debe ser sí o no.');
    if (proj) {
      Object.keys(PROJECT_FIELDS).forEach(k => chk(proj[k], PROJECT_FIELDS[k], PROJECT_FIELDS[k].label));
      const w = proj.weights || {};
      let sum = 0, ok = true;
      WEIGHT_KEYS.forEach(k => { if (typeof w[k] !== 'number' || !isFinite(w[k]) || w[k] < 0) ok = false; else sum += w[k]; });
      if (!ok) errs.push('Pesos de decisión: usa números mayores o iguales a 0.');
      else if (sum <= 0) errs.push('Pesos de decisión: al menos un peso debe ser mayor que 0.');
    }
    return errs;
  }

  /* ---------- Utilidades ---------- */
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const fmt = (x, d) => (Math.round(x * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toString();
  function routeMs(n, c, factor) { return n * n * c.routeUsPerN2 / 1000 * (factor || 1); }
  function tExt(n, c) { return c.tExtBaseMs + c.tExtPerPoiMs * n; }
  function demandMs(s, n, H, c) {
    let d = s.base + s.perPoi * n;
    if (s.route) d += routeMs(n, c);
    if (s.cache) d += (1 - H) * c.parseMsPerPoi * n + H * c.cacheReadMs;
    return d;
  }
  function md1(u, c) { const x = Math.min(u, c.rhoMax); return 1 + x / (2 * (1 - x)); }

  /* Reparto de instancias: cubre la demanda con utilización objetivo, mantiene réplicas mínimas
     y recorta (quitando de la que más tiene) cuando el costo supera el presupuesto. */
  function allocate(svcs, fixedAndUsage, budget, lambda, H, n, c, sh) {
    const inst = svcs.map(s => {
      const dem = demandMs(s, n, H, c);
      let needed = Math.ceil((lambda * dem / 1000) / c.rhoTarget);
      if (s.egress && !sh) needed = Math.max(needed, Math.ceil((lambda * (1 - H)) / (c.extCapPerIpRps * c.rhoExtTarget)));
      return Math.max(1, Math.min(s.maxInst, Math.max(needed, c.minReplicas)));
    });
    const cost = () => fixedAndUsage + svcs.reduce((a, s, i) => a + inst[i] * s.costUsd, 0);
    while (cost() > budget) {
      let idx = -1, best = 1;
      inst.forEach((k, i) => { if (k > best) { best = k; idx = i; } });
      if (idx < 0) break;
      inst[idx]--;
    }
    return inst;
  }

  /* ---------- Cálculo de una arquitectura ---------- */
  function computeArch(arch, v, proj, P) {
    P = P || PARAMS;
    const c = P.common, a = P[arch];
    const n = v.pois, H = v.hit, rtt = v.rtt;
    const lambda = v.users * v.reqPerMin / 60;
    const monthlyReq = lambda * 3600 * c.dutyHoursPerDay * c.daysPerMonth;
    const usage = Math.max(0, monthlyReq * c.opsPerRequest - c.freeOpsPerMonth) / 1e6 * c.usdPerMillionOps;
    const hitEff = arch === 'A' ? H * a.localCacheFactor : H;
    const lambdaExt = lambda * (1 - hitEff);
    const sh = !!v.selfHost;
    const tE = sh ? c.selfHostTExtBaseMs + c.tExtPerPoiMs * n : tExt(n, c);
    const trace = [];
    const T = (k, f, val) => trace.push({ k: k, f: f, v: val });
    T('λ (req/s)', 'usuarios × solicitudes por minuto / 60 = ' + v.users + ' × ' + v.reqPerMin + ' / 60', fmt(lambda, 2));
    T('Aciertos efectivos', arch === 'A' ? 'caché local = aciertos × ' + a.localCacheFactor + ' (solo el propio teléfono)' : 'caché compartido = aciertos', fmt(hitEff, 3));
    T('λ externa (req/s)', 'λ × (1 − aciertos efectivos)', fmt(lambdaExt, 2));
    T('T_ext (ms)', (sh ? c.selfHostTExtBaseMs + ' (Overpass propio)' : c.tExtBaseMs) + ' + ' + c.tExtPerPoiMs + ' × ' + n + ' lugares', fmt(tE, 0));

    const svcs = a.services;
    const shCost = sh ? c.selfHostUsd : 0;
    const inst = allocate(svcs, a.fixedUsd + usage + shCost, proj.budgetUsd, lambda, H, n, c, sh);
    const serviceRows = svcs.map((s, i) => {
      const D = demandMs(s, n, H, c);
      const rho = lambda * D / 1000 / inst[i];
      const R = D / (1 - Math.min(rho, c.rhoMax));
      return { key: s.key, name: s.name, inst: inst[i], D: D, rho: rho, R: R,
               cap: inst[i] * c.rhoTarget * 1000 / D, capMax: s.maxInst * c.rhoTarget * 1000 / D, avail: 1 - Math.pow(1 - c.instAvail, inst[i]) };
    });
    serviceRows.forEach(r => {
      T('Servicio «' + r.name + '»', 'D = ' + fmt(r.D, 2) + ' ms; ρ = λ·D/(k·1000) = ' + fmt(lambda, 2) + '×' + fmt(r.D, 2) + '/(' + r.inst + '×1000) = ' + fmt(r.rho, 3) + '; R = D/(1−ρ)', fmt(r.R, 2) + ' ms');
    });

    // capacidad de la API externa
    let egressInst = 0, extCap, extCapMax;
    if (sh) { extCap = c.selfHostCapRps; extCapMax = c.selfHostCapRps; egressInst = arch === 'A' ? 0 : inst[svcs.findIndex(s => s.egress)]; }
    else if (arch === 'A') { extCap = c.extCapGlobalRps; extCapMax = c.extCapGlobalRps; }
    else {
      const eIdx = svcs.findIndex(s => s.egress);
      egressInst = inst[eIdx];
      extCap = egressInst * c.extCapPerIpRps;
      extCapMax = svcs[eIdx].maxInst * c.extCapPerIpRps;
    }
    const uExt = lambdaExt / extCap;
    const tExtEff = tE * md1(uExt, c);
    T('Uso de la API externa', 'λ externa / capacidad = ' + fmt(lambdaExt, 2) + ' / ' + fmt(extCap, 1), fmt(uExt, 3));
    T('T_ext efectivo (ms)', 'T_ext × (1 + u / (2(1−u)))', fmt(tExtEff, 0));

    // latencia
    let mean, p95, fixed, queue = serviceRows.reduce((s, r) => s + r.R, 0), pRL = 0;
    const ramp = Math.min(1, (1 - hitEff) / c.p95Ramp);
    if (arch === 'A') {
      pRL = sh ? 0 : clamp((v.reqPerMin - c.rateLimitPerIpPerMin) / c.rateLimitPerIpPerMin, 0, 1);
      fixed = routeMs(n, c, c.clientCpuFactor) + c.renderMs;
      mean = fixed + hitEff * c.cacheReadMs + (1 - hitEff) * (rtt + tExtEff + pRL * c.rateLimitBackoffMs);
      p95 = fixed + rtt + c.p95Ext * ramp * tExtEff + Math.min(1, pRL / 0.05) * c.rateLimitBackoffMs;
      T('P(429) por IP', 'máx(0, mín(1, (r − ' + c.rateLimitPerIpPerMin + ') / ' + c.rateLimitPerIpPerMin + '))', fmt(pRL, 3));
    } else {
      const hops = a.hops, hopMs = (a.hopBaseMs || 0) + (a.hopPerPoiMs || 0) * n;
      fixed = rtt + hops * hopMs + c.renderMs;
      mean = fixed + queue + (1 - hitEff) * tExtEff;
      p95 = fixed + c.p95Queue * queue + c.p95Ext * ramp * tExtEff;
      if (hops) T('Saltos entre servicios', hops + ' × (' + a.hopBaseMs + ' + ' + a.hopPerPoiMs + ' × ' + n + ')', fmt(hops * hopMs, 1) + ' ms');
    }
    T('Latencia media (ms)', arch === 'A' ? 'ruta en el teléfono + render + (1−h)(RTT + T_ext efectivo + 429)' : 'RTT + saltos + render + Σ R + (1−h)·T_ext efectivo', fmt(mean, 0));
    T('Latencia p95 (ms)', arch === 'A' ? 'fijo + RTT + ' + c.p95Ext + ' × rampa × T_ext efectivo + reintento' : 'fijo + ' + c.p95Queue + ' × Σ R + ' + c.p95Ext + ' × rampa × T_ext efectivo', fmt(p95, 0));

    // capacidad
    const capExtSustainable = c.rhoExtTarget * extCap / (1 - hitEff);
    const capCpu = serviceRows.length ? Math.min.apply(null, serviceRows.map(r => r.cap)) : Infinity;
    const capacity = Math.min(capCpu, capExtSustainable);
    const headroom = capacity / lambda;
    const ceilExt = c.rhoExtTarget * extCapMax / (1 - hitEff);
    const ceilCpu = serviceRows.length ? Math.min.apply(null, serviceRows.map(r => r.capMax)) : Infinity;
    const ceiling = Math.min(ceilCpu, ceilExt);
    const scal = ceiling / lambda;
    T('Capacidad sostenible (req/s)', 'mín(capacidad de servidores, ' + c.rhoExtTarget + ' × capacidad externa / (1−h))', fmt(capacity, 1));
    T('Margen de capacidad', 'capacidad / λ', fmt(headroom, 2) + '×');
    T('Escalabilidad', 'techo técnico (instancias máximas) / λ = ' + fmt(ceiling, 1) + ' / ' + fmt(lambda, 2), fmt(scal, 2) + '×');

    // disponibilidad
    let avSvc = 1;
    serviceRows.forEach(r => { avSvc *= r.avail; });
    const avBroker = arch === 'C' ? 0.999 : 1;
    const avExt = 1 - (1 - (sh ? 0.995 : c.extAvail)) * (1 - hitEff);
    const avail = c.hostingAvail * c.dbAvail * avSvc * avBroker * avExt;
    T('Disponibilidad', 'hosting × base de datos × Π(1−(1−' + c.instAvail + ')^k) × ' + (arch === 'C' ? 'broker × ' : '') + '(1 − (1−' + c.extAvail + ')(1−h))', fmt(avail * 100, 3) + ' %');

    // costo y esfuerzo
    const infra = a.fixedUsd + shCost + svcs.reduce((s, x, i) => s + inst[i] * x.costUsd, 0);
    const cost = infra + usage;
    T('Costo mensual (USD)', 'fijo ' + a.fixedUsd + (sh ? ' + Overpass propio ' + shCost : '') + ' + Σ instancias×precio + uso de Firestore ' + fmt(usage, 2), fmt(cost, 2));
    const effortCap = proj.teamSize * proj.weeksAvail * proj.dedication;
    T('Esfuerzo (persona-semana)', 'requerido ' + a.effortPw + ' frente a ' + proj.teamSize + ' × ' + proj.weeksAvail + ' × ' + proj.dedication + ' disponibles', fmt(a.effortPw, 0) + ' / ' + fmt(effortCap, 1));

    // requisitos obligatorios
    const checks = [
      { key: 'lat', label: 'Latencia p95 ≤ ' + proj.latMaxMs + ' ms', ok: p95 <= proj.latMaxMs, value: p95, limit: proj.latMaxMs },
      { key: 'av', label: 'Disponibilidad ≥ ' + proj.availMinPct + ' %', ok: avail * 100 >= proj.availMinPct, value: avail * 100, limit: proj.availMinPct },
      { key: 'cap', label: 'Capacidad ≥ demanda pico', ok: headroom >= 1, value: headroom, limit: 1 },
      { key: 'cost', label: 'Costo ≤ presupuesto de ' + proj.budgetUsd + ' USD', ok: cost <= proj.budgetUsd + 1e-9, value: cost, limit: proj.budgetUsd },
      { key: 'team', label: 'Esfuerzo ≤ capacidad del equipo', ok: a.effortPw <= effortCap + 1e-9, value: a.effortPw, limit: effortCap }
    ];
    const feasible = checks.every(x => x.ok);

    // puntajes normalizados 0..1 para el apoyo a la decisión
    const unav = Math.max(1 - avail, 1e-9), unavMax = 1 - proj.availMinPct / 100;
    const scores = {
      lat: clamp(1 - p95 / proj.latMaxMs, 0, 1),
      av: clamp(Math.log10(unavMax / unav) / 1.5, 0, 1),
      cost: proj.budgetUsd > 0 ? clamp(1 - cost / proj.budgetUsd, 0, 1) : 0,
      scal: clamp(Math.log2(Math.max(scal, 1)) / 4, 0, 1),
      simp: effortCap > 0 ? clamp(1 - a.effortPw / effortCap, 0, 1) : 0
    };
    const wsum = WEIGHT_KEYS.reduce((s, k) => s + proj.weights[k], 0);
    const contrib = {};
    let total = 0;
    WEIGHT_KEYS.forEach(k => { contrib[k] = scores[k] * proj.weights[k] / wsum; total += contrib[k]; });

    return {
      arch: arch, label: a.label, lambda: lambda, hitEff: hitEff, lambdaExt: lambdaExt,
      services: serviceRows, egressInst: egressInst,
      latencyMean: mean, latencyP95: p95, capacity: capacity, headroom: headroom, ceiling: ceiling, scalability: scal,
      availability: avail, cost: cost, infraCost: infra, usageCost: usage, effort: a.effortPw, effortCap: effortCap,
      uExt: uExt, saturated: uExt >= 1, pRateLimit: pRL,
      checks: checks, feasible: feasible, scores: scores, contrib: contrib, total: total, trace: trace
    };
  }

  /* ---------- Escenario completo + recomendación explicable ---------- */
  const CRIT = { lat: 'latencia', av: 'disponibilidad', cost: 'costo', scal: 'escalabilidad', simp: 'simplicidad para el equipo' };

  function recommend(results, proj) {
    const list = ARCHS.map(k => results[k]);
    const feas = list.filter(r => r.feasible).sort((x, y) => y.total - x.total);
    const ranking = list.slice().sort((x, y) => (y.feasible - x.feasible) || (y.total - x.total));
    const rec = { ranking: ranking.map(r => r.arch), feasible: feas.map(r => r.arch), reasons: [], limitations: [], assumptions: [] };
    const sentence = [];
    if (feas.length) {
      const best = feas[0];
      rec.status = 'ok'; rec.best = best.arch;
      const topK = WEIGHT_KEYS.slice().sort((x, y) => best.contrib[y] - best.contrib[x]).slice(0, 2);
      sentence.push('Se recomienda «' + best.label + '» (' + best.arch + '): cumple los 5 requisitos obligatorios y suma ' + fmt(best.total, 3) + ' puntos de 1.');
      sentence.push('Sus mayores aportes vienen de ' + CRIT[topK[0]] + ' (' + fmt(best.contrib[topK[0]], 3) + ') y ' + CRIT[topK[1]] + ' (' + fmt(best.contrib[topK[1]], 3) + ').');
      if (feas.length > 1) {
        const second = feas[1];
        const diffs = WEIGHT_KEYS.map(k => ({ k: k, d: best.contrib[k] - second.contrib[k] })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0];
        sentence.push('Supera a «' + second.label + '» por ' + fmt(best.total - second.total, 3) + ' puntos; la mayor diferencia está en ' + CRIT[diffs.k] + ' (' + (diffs.d >= 0 ? '+' : '') + fmt(diffs.d, 3) + ').');
        rec.margin = best.total - second.total;
        if (rec.margin < 0.03) rec.limitations.push('La diferencia con la segunda opción es menor a 0.03 puntos: cambios pequeños en los supuestos podrían invertir el orden.');
      } else {
        sentence.push('Es la única alternativa que cumple todos los requisitos obligatorios.');
      }
    } else {
      rec.status = 'none';
      const closest = list.slice().sort((x, y) => x.checks.filter(c => !c.ok).length - y.checks.filter(c => !c.ok).length || y.total - x.total)[0];
      rec.best = null; rec.closest = closest.arch;
      sentence.push('Ninguna alternativa cumple todos los requisitos obligatorios con estas entradas.');
      sentence.push('La más cercana es «' + closest.label + '» (' + closest.arch + '), que incumple: ' + closest.checks.filter(c => !c.ok).map(c => c.label).join('; ') + '.');
      sentence.push('Para continuar hay que relajar un requisito (presupuesto, equipo, plazo o latencia) o reducir la demanda simulada.');
    }
    rec.text = sentence;
    list.forEach(r => {
      if (!r.feasible) rec.reasons.push('«' + r.label + '» queda fuera: ' + r.checks.filter(c => !c.ok).map(c => c.label + ' (resultado ' + fmt(c.value, c.key === 'av' ? 3 : 2) + ')').join('; ') + '.');
    });
    rec.assumptions.push('Los valores son estimaciones del modelo, no mediciones de rendimiento real.');
    rec.assumptions.push('La API pública de OpenStreetMap responde con ' + PARAMS.common.tExtBaseMs + ' ms más ' + PARAMS.common.tExtPerPoiMs + ' ms por lugar y tolera ' + PARAMS.common.extCapPerIpRps + ' solicitudes por segundo por dirección IP.');
    rec.assumptions.push('Los pesos de decisión definidos por el equipo: ' + WEIGHT_KEYS.map(k => CRIT[k] + ' ' + fmt(proj.weights[k], 2)).join(', ') + '.');
    rec.limitations.push('El modelo no considera fallas correlacionadas, picos súbitos dentro del minuto ni diferencias entre proveedores de nube.');
    return rec;
  }

  function runScenario(v, proj, P) {
    const errs = validate(v, proj);
    if (errs.length) return { ok: false, errors: errs };
    const results = {};
    ARCHS.forEach(k => { results[k] = computeArch(k, v, proj, P); });
    return { ok: true, vars: JSON.parse(JSON.stringify(v)), results: results, recommendation: recommend(results, proj) };
  }

  /* ---------- Barrido y sensibilidad ---------- */
  function sweep(v, proj, key, values) {
    return values.map(x => {
      const w = Object.assign({}, v); w[key] = x;
      const r = runScenario(w, proj);
      return { x: x, run: r };
    });
  }
  function sensitivity(v, proj) {
    const base = runScenario(v, proj);
    const out = [];
    Object.keys(VARS).forEach(k => {
      const def = VARS[k];
      const mk = f => {
        let x = v[k] * f;
        x = clamp(x, def.min, def.max);
        if (def.int) x = Math.round(x);
        const w = Object.assign({}, v); w[k] = x;
        const r = runScenario(w, proj);
        return { value: x, best: r.ok ? r.recommendation.best : null, changed: r.ok ? r.recommendation.best !== base.recommendation.best : false };
      };
      out.push({ key: k, label: def.label, low: mk(0.5), high: mk(2) });
    });
    return { base: base.recommendation.best, rows: out };
  }

  function compareToBase(scenarioRun, baseRun) {
    const out = {};
    ARCHS.forEach(k => {
      const a = scenarioRun.results[k], b = baseRun.results[k];
      out[k] = {
        latency: (a.latencyP95 - b.latencyP95) / b.latencyP95,
        cost: b.cost > 0 ? (a.cost - b.cost) / b.cost : 0,
        availability: a.availability - b.availability
      };
    });
    return out;
  }

  return { PARAMS: PARAMS, ARCHS: ARCHS, VARS: VARS, PROJECT_FIELDS: PROJECT_FIELDS, WEIGHT_KEYS: WEIGHT_KEYS, CRIT: CRIT,
           defaultProject: defaultProject, defaultScenarios: defaultScenarios, validate: validate,
           computeArch: computeArch, runScenario: runScenario, recommend: recommend,
           sweep: sweep, sensitivity: sensitivity, compareToBase: compareToBase,
           demandMs: demandMs, routeMs: routeMs, tExt: tExt };
});
