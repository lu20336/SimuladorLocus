const M = require('./model.js'), T = require('./tests.js'), RT = require('./runner_tests.js');
const res = T.runAll(M);
res.forEach(r => console.log((r.pass ? 'OK   ' : 'FALLA') + ' ' + r.id + ' ' + r.name + '\n       esperado: ' + r.expected + '\n       obtenido: ' + r.obtained));
const bad = res.filter(r => !r.pass).length;
console.log('\n' + (res.length - bad) + '/' + res.length + ' pruebas del modelo pasan');
RT.runAll().then(rr => {
  rr.forEach(r => console.log((r.pass ? 'OK   ' : 'FALLA') + ' ' + r.id + ' ' + r.name + '\n       obtenido: ' + r.obtained));
  const bad2 = rr.filter(r => !r.pass).length;
  console.log('\n' + (rr.length - bad2) + '/' + rr.length + ' pruebas del orquestador pasan');
  process.exit(bad || bad2 ? 1 : 0);
});
