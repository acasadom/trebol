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

> Estado: **fase 3** (UI mínima). El lenguaje, la red y un primer dialecto de
> UI funcionan: formularios con validación, tema claro y oscuro, sin CSS.
> Diseño completo y hoja de ruta en [`docs/design.md`](docs/design.md).

![Formulario de alta en tema claro](docs/screenshots/signup-light.png)

## Requisitos

Node.js 22.18 o superior. No hay paso de compilación: Node ejecuta el TypeScript directamente.

```sh
npm install
npm run check        # tipos + tests
```

## Probarlo

```sh
npm run dev          # y abre http://localhost:5173/examples/signup/
```

```sh
echo 'print 1 + 2 * 3' | npm run trb                 # evalúa (9: sin precedencia)
npm run trb -- fichero.trb
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
| `test` | tests en TS y en Trebol (`test/trebol`), incluida una prueba de ida y vuelta con valores aleatorios |
| `examples` | ficheros `.trb` de ejemplo |
| `docs` | diseño y decisiones |
