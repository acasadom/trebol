# Metasistema: diseño de la administración y de sus procedimientos

Este documento describe la aplicación para la que existe Trebol: la reescritura de una plataforma de
administración electrónica. `design.md` describe el lenguaje y el dialecto de UI; este, el sistema
que se construye con ellos. Las especificaciones del sistema original están en
`claypy/prepro/current/ESPECIFICACION_FUNCIONAL.md` y `ESPECIFICACION_TECNICA.md`. Su código es una
solución concreta del problema, no algo que haya que portar.

## 1. Qué es y qué queda fuera

Una administración pública solo puede hacer lo que una ley le permite, y cada cosa que hace sigue un
**procedimiento** que dice cómo se aplica esa ley: qué hay que presentar, plazos, quién evalúa, el
sentido de la resolución, el silencio administrativo... Cada caso concreto de un procedimiento es un
**expediente**: la solicitud de beca de una persona es un expediente del procedimiento "Solicitud de
beca".

El sistema es un **metasistema**: no trae procedimientos ni estructura fijos, sino las herramientas
para definirlos. Con el mismo diseñador se definen:

- la **estructura de la administración**: la jerarquía política y la de servicios administrativos,
  hechas con grupos;
- los **procedimientos**: sus datos, sus vistas y su ficha pública.

Hay incluso un **procedimiento para hacer procedimientos**: cada expediente suyo es un procedimiento
en preparación que, una vez aprobado, entra en el catálogo de la administración.

Un sistema recién instalado **no tiene ningún procedimiento**, ni siquiera ese: trae solo el
mecanismo (grupos, el diseñador, el tipo de campo `design` y la acción de publicar) y el
administrador lo construye todo con él.

Dos públicos usan el sistema:

- **personal**: define la estructura y los procedimientos, y más adelante tramita expedientes;
- **ciudadanía**: entra en la sede como en el vestíbulo del ayuntamiento, ve el directorio de
  unidades y los trámites por materia o con el buscador, y los inicia.

**Fuera de este documento**, para más adelante: el tramitador (el flujo de cada expediente por sus
estados, con una vista por estado), las notificaciones, los componentes funcionales, los informes y
la aplicación de escritorio.

## 2. Modelo de objetos

### 2.1 Todo es un objeto

Hay un único tipo de registro, el **objeto**:

```
objeto: id, clase (id de otro objeto), valores { campo-id: valor }
```

Un **Concepto** es un objeto que además define campos y vistas, es decir, una clase. Que las clases
sean objetos no es un caso especial: un Concepto tiene clase (su metaclase), valores, permisos y se
puede buscar, referenciar y agrupar como cualquier otro objeto.

La cadena termina en el Concepto raíz `concept`, que es instancia de sí mismo (como `type` en Python
o `Metaclass` en Smalltalk). El arranque crea este objeto a mano; todo lo demás se crea por el
camino normal.

```
"Solicitud de beca" (expediente 4711)
    clase -> Becas 2027           (un procedimiento: un Concepto)
        clase -> concept          (raíz; su clase es él mismo)
```

Si "Becas 2027" se creó por la vía administrativa (sección 6), el Concepto guarda además un enlace
al expediente del procedimiento para hacer procedimientos del que salió.

Además de la relación *instancia de*, un Concepto puede **heredar** de otro (`extends`, herencia
simple): hereda sus campos y sus vistas y puede añadir o especializar.

### 2.2 Campos de clase, de instancia y de ambos

Cada campo declara a qué nivel vive su valor:

| Nivel | Quién da el valor | Ejemplo |
| --- | --- | --- |
| `class` | el Concepto; lo comparten todas sus instancias | plazo de resolución, sentido del silencio, las opciones de un desplegable |
| `instance` | cada instancia | nombre del solicitante, importe pedido |
| `both` | el Concepto da un valor por defecto; la instancia puede cambiarlo | unidad responsable, icono |

Leer un campo en un objeto busca primero en el objeto, luego en su clase y luego en lo que esa clase
hereda (`extends`). Es la delegación de los objetos de Trebol, así que en el frontend no hace falta
copiar valores de la clase a cada instancia.

### 2.3 Identidad estable de los campos

Cada campo tiene un **id interno** que no cambia nunca y una **etiqueta** por idioma que se puede
cambiar cuando se quiera. Los datos se guardan por id, así que renombrar un campo es cambiar su
etiqueta y no toca ningún dato. Esto sustituye al diccionario de alias del sistema original
(`renamedAttrs`). Borrar un campo es la única operación destructiva y pide confirmación.

## 3. Campos

### 3.1 Tipos

| Tipo | Valor | Notas |
| --- | --- | --- |
| `text` | cadena corta | buscable |
| `long-text` | texto con formato | se muestra saneado, nunca como HTML crudo |
| `number`, `money`, `date` | número, importe, fecha | con formato del idioma activo |
| `yes-no` | lógico | |
| `password` | cadena | solo se envía; el backend guarda el hash |
| `choice` | una opción | las opciones son un valor de nivel `class` del mismo campo |
| `ref` | id de un objeto | `to`: Concepto destino |
| `concept-ref` | id de un Concepto | "es de la clase X" |
| `refs` | lista de ids | `ordered` si el orden importa |
| `table` | lista de subregistros | sus columnas son campos (como el `Set` de varios campos original) |
| `calculated` | derivado | expresión sobre otros campos; solo lectura |
| `link` | id de un objeto | enlace simbólico dentro de un grupo (sección 5) |
| `file`, `image`, `address` | referencia a fichero, imagen, dirección | `address` con mapa |
| `design` | campos y vistas de un Concepto | el valor que edita el diseñador (sección 6) |

### 3.2 Propiedades comunes

`id`, `label` (por idioma), `help` (por idioma), `level`, `required`, `unique`, `searchable` (sale en
el buscador avanzado), `summary` (columna del listado), `read-only` y permisos por rol (sección 8).

## 4. Vistas

Una vista es un bloque del dialecto de UI de Trebol: dice **dónde** va cada campo, no **qué** es. Los
campos se definen una vez en el Concepto y las vistas los colocan por id; así un mismo campo puede
salir en varias vistas.

```rebol
concept grant [
    label [es "Solicitud de beca"  en "Grant application"]
    fields [
        amount: money [label [es "Importe" en "Amount"] level instance required]
        level: choice [
            label [es "Nivel de estudios" en "Level of studies"]
            level both
            options [es ["Grado" "Máster"] en ["Degree" "Master"]]
        ]
        transcript: file [label [es "Expediente académico" en "Transcript"] required]
    ]
    views [
        apply [                       ; lo que rellena quien solicita
            panel #personal [field applicant  field level]
            panel #documents [field amount  field transcript]
        ]
    ]
]
```

- **Distribución en flujo**: filas, columnas, rejillas con columnas que ocupa cada componente,
  pestañas y paneles. Se adapta sola a móvil. No hay posiciones absolutas.
- **Vistas sin código**: una vista solo coloca campos y elementos estáticos (títulos, textos,
  imágenes). Las acciones las pone el marco de la aplicación (sección 7). Esto permite que la
  ciudadanía o el personal sin conocimientos técnicos diseñen sin poder ejecutar nada.
- **Varias vistas por Concepto**, con nombre: por ejemplo la ficha pública del trámite, la solicitud
  y la vista interna.
- **Herencia de vistas**: cada componente tiene id; la vista de un Concepto hijo parte de la del
  padre y guarda solo sus cambios (componentes ocultos, añadidos y dónde).
- **Modos**: la misma vista se pinta para ver, crear o editar; los permisos y `read-only` deciden
  qué es editable.

## 5. Conceptos de serie y grupos

Un sistema vacío trae solo estos Conceptos. Son objetos normales: el administrador puede ampliarlos
con el diseñador (añadir campos y vistas), pero no borrarlos.

| Concepto | Qué es |
| --- | --- |
| `concept` | raíz: la clase de las clases (etiqueta, campos, vistas, `extends`) |
| `group` | contenedor jerárquico: contiene grupos, Conceptos y objetos, en el orden que se le dé |
| `user` | quien inicia sesión |
| `role` | conjunto de permisos que se asigna a usuarios (sección 8) |

### 5.1 Grupos

Toda la organización se hace con **grupos**, que son la jerarquía de composición del sistema:

- un grupo **contiene** otros grupos, Conceptos y objetos, en un orden fijado a mano;
- un grupo puede tener además **enlaces simbólicos**: muestra algo que no contiene ni es suyo, que
  sigue viviendo en su grupo de origen y con sus permisos;
- cada usuario tiene un grupo de **inicio**: al entrar ve el árbol que parte de él.

La estructura de una administración se construye así:

- las **áreas y servicios** administrativos son grupos (instancias de `group`, o de un Concepto que
  hereda de `group` si se les quieren añadir campos, como horario o dirección de atención);
- la **jerarquía política** también son grupos; sus últimos niveles se relacionan, uno a uno o uno a
  varios, con los servicios administrativos mediante enlaces simbólicos dentro del grupo político;
- los **procedimientos** viven en el grupo del servicio que los tramita, y los expedientes en el de
  su procedimiento;
- las **materias** del catálogo ciudadano son grupos con enlaces simbólicos a los procedimientos de
  cada una.

El catálogo que ve la ciudadanía es lo que su rol (`public`) puede navegar desde el grupo de inicio
público.

## 6. El diseñador

El diseñador es la vista de edición del tipo de campo `design`: paleta a la izquierda, lienzo en el
centro y propiedades a la derecha. Soltar un componente de entrada en el lienzo crea un campo y lo
coloca; soltar uno de distribución solo coloca. Quitarlo de la vista no borra el campo; borrar el
campo es una acción aparte, con confirmación.

Como `design` es un tipo de campo más, el mismo mecanismo sirve para todo:

- **diseñar un Concepto directamente** es editar su `design` (lo hace el administrador, y así crea
  también el procedimiento para hacer procedimientos);
- **diseñar un procedimiento por la vía administrativa** es rellenar un expediente de ese
  procedimiento para hacer procedimientos, un Concepto que tiene un campo `design`;
- **aprobarlo** es la acción del marco `publish`: convierte el `design` de un objeto en un Concepto
  nuevo, en el grupo que se indique;
- **ampliar un Concepto de serie** (añadir campos a `group`, por ejemplo) es editar su `design`.

Habrá dos niveles de paleta: la completa, para programadores, con todo el dialecto, y un
subconjunto para el personal, que es la que se usa dentro de un campo `design`.

### Versiones

Un procedimiento aplica una ley, y las leyes cambian. Modificar un procedimiento publicado crea una
**versión nueva**; los expedientes ya iniciados siguen con la versión con la que empezaron. Añadir
un campo opcional o cambiar etiquetas no necesita versión nueva.

## 7. Arquitectura de la aplicación

- **Marco fijo**, escrito en Trebol por programadores: navegación, listados, buscador y las
  **acciones**, que son siempre las mismas (crear, ver, editar, borrar, duplicar, aprobar, publicar,
  mover en el árbol...). Su centro es un panel vacío donde se pinta la vista del objeto activo.
- **Navegación dentro de la aplicación** (SPA), sin depender del atrás y adelante del navegador. Aun
  así, cada objeto (un expediente, un trámite, un grupo) tiene su propio **enlace**, que abre la
  aplicación en él, para compartirlo o volver desde un correo.
- **Multilingüe desde el principio**: las etiquetas de los campos y vistas son por idioma, los
  textos del marco salen de un diccionario, y fechas e importes se formatean según el idioma activo.
  Los idiomas los configura cada administración; el principal por defecto es el castellano. No es
  obligatorio rellenar todos: lo que falta en un idioma se muestra en el principal.
- **Backend**: FastAPI con SQLite al principio. Lee el esquema JSON de cada Concepto (sección 9) y
  guarda los objetos. Mientras no exista, el servidor de desarrollo sirve un backend falso en memoria
  que habla el mismo protocolo.

## 8. Usuarios, roles y permisos

- De serie solo hay dos roles: **administrador** (todo) y **público** (lo que se le conceda; es lo
  que ve quien no ha iniciado sesión).
- El administrador crea más roles (por ejemplo "Tramitación de Urbanismo") y los asigna a usuarios.
- Un permiso concede una **operación** (crear, ver, editar, borrar, navegar, diseñar) sobre un
  **destino** (un Concepto, una rama del árbol de grupos o un campo) a un **rol**.
- Los permisos se heredan hacia abajo por el árbol de grupos y por `extends`.
- Hay roles **relativos al objeto**: quien lo creó y el equipo del grupo donde vive. Cubren las
  listas de propietarios y de equipo del sistema original.
- El backend aplica los permisos siempre; el frontend solo los usa para no enseñar lo que no se
  puede hacer.

## 9. Esquema JSON para el backend

Cada Concepto produce su esquema, que el backend usa para validar y guardar:

```json
{
  "id": "grant",
  "class": "concept",
  "group": "education-grants",
  "version": 1,
  "label": { "es": "Solicitud de beca", "en": "Grant application" },
  "fields": [
    { "id": "amount", "type": "money", "level": "instance", "required": true },
    { "id": "level", "type": "choice", "level": "both",
      "options": { "es": ["Grado", "Máster"], "en": ["Degree", "Master"] } },
    { "id": "transcript", "type": "file", "level": "instance", "required": true }
  ]
}
```

Las vistas no forman parte del esquema: el backend las guarda como texto Trebol sin interpretarlas.

## 10. Fases

Sustituyen a la fase 5 de `design.md` (escritorio), que pasa a después de estas.

| Fase | Contenido | Gate |
| --- | --- | --- |
| 5 · Modelo | objetos y Conceptos en Trebol, formato de definición, esquema JSON, backend falso, i18n | un Concepto definido en Trebol produce su esquema y sus objetos se guardan y leen del backend falso |
| 6 · Vistas | pintar vistas en modo ver, crear y editar dentro del marco; campos nuevos (fecha, importe, referencias, tabla, fichero); navegación interna | crear, ver y editar objetos de un Concepto escrito a mano, en dos idiomas |
| 7 · Diseñador | paleta, lienzo y propiedades; tipo `design`; acción `publish` | diseñar con el ratón un procedimiento para hacer procedimientos, crear con él un procedimiento, publicarlo y abrir un expediente suyo |
| 8 · Estructura y sede | grupos, enlaces simbólicos e inicio por usuario; roles y permisos; catálogo y buscador para la ciudadanía | definir un ayuntamiento pequeño (jerarquía política y servicios) y entrar en su sede como ciudadano |
| Después | tramitador (estados y vistas por estado), notificaciones, informes, escritorio | |

## 11. Decisiones del propietario (2026-11-01)

- Cada objeto tiene su propio enlace, aunque la navegación sea interna.
- Idioma principal: castellano; no es obligatorio rellenar todos los idiomas.
- Cambiar un procedimiento publicado crea una versión; los expedientes en curso siguen con la suya.
- El sistema vacío no trae procedimientos ni campos de procedimiento.
- La estructura (política y administrativa) son grupos; la relación entre ambas jerarquías es un
  enlace simbólico dentro del grupo político.
- Las agrupaciones libres son grupos, que contienen Conceptos y objetos y admiten enlaces
  simbólicos.

## 12. Preguntas abiertas

1. ¿El grupo de inicio público (lo que ve quien no ha iniciado sesión) es uno solo por
   administración?
2. Los Conceptos dentro de un grupo y los objetos dentro de un grupo, ¿se muestran mezclados en el
   orden manual o separados (primero subgrupos, luego Conceptos, luego objetos)?
