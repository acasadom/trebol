# Trebol

Un lenguaje derivado de Rebol para hacer interfaces web (y de escritorio) bonitas
sin escribir HTML ni CSS. Homoicónico: las interfaces son datos que se generan y
transforman con el propio lenguaje.

```rebol
view [
    title "Clients"
    form [
        field name "Name" required
        field email "Email" required email
        submit "Save" [save values]
    ]
]
```

> Estado: **fase 1** (núcleo). Hoy funcionan `load` y `mold`: el lenguaje se
> lee y se escribe, pero todavía no se evalúa. Diseño completo y hoja de ruta en
> [`docs/design.md`](docs/design.md).

## Requisitos

Node.js 22.18 o superior. No hay paso de compilación: Node ejecuta el TypeScript directamente.

```sh
npm install
npm run check        # tipos + tests
```

## Probarlo

```sh
npm run mold -- examples/load-tour.trb          # lee el fichero y lo vuelve a escribir
npm run mold -- --all examples/load-tour.trb    # con sintaxis de construcción
echo '[a: 1 b: 30-Oct-2026 c: $12.50]' | npm run mold
```

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `src/core` | núcleo del lenguaje, portable a Zig |
| `src/host` | host del navegador (fase 2) |
| `src/ui` | dialecto de UI (fase 3) |
| `test` | tests, incluida una prueba de ida y vuelta con valores aleatorios |
| `examples` | ficheros `.trb` de ejemplo |
| `docs` | diseño y decisiones |
