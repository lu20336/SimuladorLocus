# Simulador de arquitectura de Locus (Actividad 9)

Simulador web que compara tres arquitecturas para Locus (cliente directo, monolito con caché y microservicios), calcula indicadores, verifica requisitos obligatorios y recomienda una alternativa con su cálculo a la vista. Equipo Tres Felices Tigres, Universidad Libre, Ingeniería Aplicada.

Los resultados son estimaciones del modelo, no mediciones de rendimiento real.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `app.html` | Interfaz del simulador (plantilla) |
| `model.js` | Modelo de simulación (funciones puras) |
| `tests.js`, `run_tests.js` | 12 pruebas del modelo |
| `build.py` | Une los tres archivos anteriores en `index.html` |
| `index.html` | Simulador completo, listo para publicar |
| `.github/workflows/pages.yml` | Publica en GitHub Pages en cada `push` a `main` |

## Uso local

```bash
node run_tests.js      # corre las pruebas
python3 build.py       # regenera index.html
```

Abre `index.html` en el navegador. En la pestaña Resultados, «Exportar informe en PDF» abre el diálogo de impresión: elige «Guardar como PDF».

## Publicar en GitHub Pages

1. Crea un repositorio vacío en GitHub, por ejemplo `locus-simulador`.
2. Desde esta carpeta:
   ```bash
   git init
   git add .
   git commit -m "Simulador de arquitectura de Locus"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/locus-simulador.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. En la pestaña **Actions** espera a que termine «Publicar simulador en GitHub Pages». El enlace queda en `https://TU_USUARIO.github.io/locus-simulador/`.

Cada cambio que subas a `main` corre las pruebas, regenera `index.html` y vuelve a publicar.
