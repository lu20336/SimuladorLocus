const M = require('./model.js'), T = require('./tests.js');
const res = T.runAll(M);
res.forEach(r => console.log((r.pass ? 'OK   ' : 'FALLA') + ' ' + r.id + ' ' + r.name + '\n       esperado: ' + r.expected + '\n       obtenido: ' + r.obtained));
const bad = res.filter(r => !r.pass).length;
console.log('\n' + (res.length - bad) + '/' + res.length + ' pruebas pasan');
process.exit(bad ? 1 : 0);
