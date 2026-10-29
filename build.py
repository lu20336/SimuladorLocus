"""Genera index.html (documento completo) a partir de app.html, model.js, tests.js, runner.js y scenes.js."""
import re
m = open('model.js', encoding='utf-8').read()
t = open('tests.js', encoding='utf-8').read()
r = open('runner.js', encoding='utf-8').read()
n = open('scenes.js', encoding='utf-8').read()
a = open('app.html', encoding='utf-8').read()
body = a.replace('/*__MODEL__*/', m).replace('/*__TESTS__*/', t).replace('/*__RUNNER__*/', r).replace('/*__SCENES__*/', n)
title = re.search(r'<title>.*?</title>', body).group(0)
rest = body.replace(title, '', 1).replace('<meta name="claude:viewport-fit-sides" content="cover">', '', 1)
full = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + title + '\n</head>\n<body>\n' + rest + '\n</body>\n</html>\n')
open('index.html', 'w', encoding='utf-8').write(full)
print('index.html generado:', len(full), 'caracteres')
