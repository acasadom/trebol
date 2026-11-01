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

Leer un campo de nivel `class` o `both` en un objeto busca primero en el objeto, luego en su clase y
luego en lo que esa clase hereda (`extends`); uno de nivel `instance` solo en el objeto. En el
frontend lo hace `value-of`, así que no hace falta copiar valores de la clase a cada instancia.

### 2.3 Identidad estable de los campos

Cada campo tiene un **id interno** que no cambia nunca y una **etiqueta** por idioma que se puede
cambiar cuando se quiera. Los datos se guardan por id, así que renombrar un campo es cambiar su
etiqueta y no toca ningún dato. Esto sustituye al diccionario de alias del sistema original
(`renamedAttrs`). Borrar un campo es la única operación destructiva y pide confirmación.

Lo mismo vale para las opciones de un `choice`: cada opción tiene un id y una etiqueta por idioma, y
el objeto guarda el id. Renombrar una opción o cambiar de idioma no toca los datos.

## 3. Campos

### 3.1 Tipos

| Tipo | Valor | Notas |
| --- | --- | --- |
| `text` | cadena corta | buscable; con `translated` es un texto por idioma |
| `long-text` | texto con formato | se muestra saneado, nunca como HTML crudo |
| `number`, `money`, `date` | número, importe, fecha | con formato del idioma activo |
| `yes-no` | lógico | |
| `password` | cadena | solo se envía; el backend guarda el hash |
| `choice` | id de una opción | las opciones son un valor de nivel `class` del mismo campo; cada una tiene id y etiqueta por idioma |
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
            options [
                degree [es "Grado" en "Degree"]
                master [es "Máster" en "Master"]
            ]
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

En la definición, cada campo es `id: tipo [propiedades]`: `label` y `help` (un texto o
`[es ... en ...]`), `level`, las marcas `required unique searchable summary read-only translated
ordered`, `to` (Concepto destino de una referencia), `options` (de un `choice`), `columns` (de una
`table`) y `expr` (de un `calculated`). Sin `level`, un campo es de instancia. Fuera de `fields`,
`nombre: valor` da el valor de nivel `class` de un campo del propio Concepto (`deadline: 30`).

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
- todo usuario tiene un grupo de **inicio** (su *home*, como en Unix): es donde entra y la raíz de
  lo que ve; hay además un inicio **público** para quien entra sin sesión;
- el sistema vacío tiene la raíz, el inicio del administrador y el inicio público;
- dentro de un grupo, el orden por defecto es el de creación, y se puede reorganizar a mano.

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

### 7.1 Navegación

El sistema se recorre como un sistema de ficheros, o como habitaciones con puertas:

- un **grupo** es una carpeta (o una habitación): se entra y se sale de él, y muestra lo que
  contiene, subgrupos, Conceptos y enlaces simbólicos;
- abrir un **Concepto** muestra la **lista** de sus objetos en su vista resumen (los campos marcados
  `summary`); sobre esa lista se filtra, se busca, se crea, se edita, se borra y se duplica;
- abrir un **objeto** muestra su vista completa, la del diseñador, con anterior y siguiente para
  recorrer la lista sin volver a ella;
- una ruta de migas (breadcrumb) dice siempre dónde se está y permite volver a cualquier nivel.

Todo lo que la aplicación pide al servidor es esa navegación (contenido de un grupo, lista de un
Concepto con su filtro y orden, un objeto) y las acciones (crear, modificar, borrar, filtrar,
publicar). En pantalla ancha, grupo, lista y objeto pueden verse a la vez en columnas, como la vista
en columnas del Finder; en estrecho, un nivel cada vez con vuelta atrás (`split`).

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
      "options": [{ "id": "degree", "label": { "es": "Grado", "en": "Degree" } },
                  { "id": "master", "label": { "es": "Máster", "en": "Master" } }] },
    { "id": "transcript", "type": "file", "level": "instance", "required": true }
  ]
}
```

Las vistas no forman parte del esquema: el backend las guarda como texto Trebol sin interpretarlas.

### 9.1 Protocolo

Todo registro es un objeto, plano en JSON: `id`, `class`, `group` y `version` son claves del sistema
(ningún campo puede llamarse así) y el resto son valores por id de campo. Un Concepto es un objeto de
clase `concept`, así que el esquema de arriba es tal cual el objeto que se guarda; sus valores de
nivel `class` (un plazo, por ejemplo) van como claves más del mismo objeto.

```
GET    /api/objects?class=grant&group=g   lista, en orden de creación
GET    /api/objects/:id                   un objeto
POST   /api/objects                       crea (el id se genera si no viene)
PUT    /api/objects/:id                   sustituye; id y clase no cambian
DELETE /api/objects/:id                   borra; no si tiene instancias o contenido
```

Formatos: `money` es un número JSON escrito exacto (`1200.50`), `date` es `AAAA-MM-DD`, una
referencia es el id del objeto, un texto `translated` es `{ "es": ..., "en": ... }`. Las contraseñas
se guardan con hash y nunca se devuelven. Un error de validación responde 422 con
`{ "error": mensaje, "field": id }`. Los ids son cadenas; los de los Conceptos de serie y los del
arranque (`concept`, `group`, `user`, `role`, `root`, `admin-home`, `public-home`, `administrator`,
`public`, `admin`) son fijos.

El servidor de desarrollo sirve este protocolo en memoria (`tools/objects.ts`) hasta que exista el
backend real.

## 9.2 El modelo en Trebol

`src/model/model.trb` es el lado Trebol del modelo. Un objeto es un `map!` con la misma forma que su
JSON; un Concepto, también.

| Palabra | Qué hace |
| --- | --- |
| `concept nombre [...]` | define un Concepto (sección 4), lo registra en `concepts` y lo asigna a `nombre` |
| `schema-of c` | el esquema: el Concepto sin sus vistas; `to-json schema-of c` es el JSON de la sección 9 |
| `fields-of c`, `field-of campos id` | los campos con los heredados, y uno por id |
| `concept-of x`, `value-of obj id` | la clase de un objeto, y un valor con la caída a la clase |
| `i18n`, `tr x`, `translated x` | idioma activo y principal, diccionario del marco, texto en el idioma activo |
| `store`, `get-object`, `list-objects`, `create-object`, `update-object`, `delete-object` | el cliente del protocolo 9.1 |
| `save-concept c`, `load-concept id` | guarda un Concepto (crea o sustituye) y lo lee con lo que hereda |

Los valores leídos del almacén toman el tipo de su campo (`money!`, `date!`). Un rechazo del almacén
es un error con `message`, `field` y `status`, para que un formulario marque el campo.

## 10. Fases

Sustituyen a la fase 5 de `design.md` (escritorio), que pasa a después de estas.

| Fase | Contenido | Gate |
| --- | --- | --- |
| 5 · Modelo | objetos y Conceptos en Trebol, formato de definición, esquema JSON, backend falso, i18n | un Concepto definido en Trebol produce su esquema y sus objetos se guardan y leen del backend falso |
| 6 · Vistas | pintar vistas en modo ver, crear y editar dentro del marco; campos nuevos (fecha, importe, referencias, tabla, fichero); navegación interna | crear, ver y editar objetos de un Concepto escrito a mano, en dos idiomas |
| 7 · Diseñador | paleta, lienzo y propiedades; tipo `design`; acción `publish` | diseñar con el ratón un procedimiento para hacer procedimientos, crear con él un procedimiento, publicarlo y abrir un expediente suyo |
| 8 · Estructura y sede | grupos, enlaces simbólicos e inicio por usuario; roles y permisos; catálogo y buscador para la ciudadanía | definir un ayuntamiento pequeño (jerarquía política y servicios) y entrar en su sede como ciudadano |
| Después | tramitador (estados y vistas por estado), notificaciones, informes, escritorio | |

Estado: **fase 5 hecha**. El gate es un test (`test/model.test.ts`): el Concepto `grant`, definido en
Trebol, produce su esquema, se guarda en el almacén falso y sus objetos se crean, leen, modifican y
borran desde Trebol. Queda para la fase 6 dar formato a fechas e importes según el idioma.

## 11. Decisiones del propietario (2026-11-01)

- Cada objeto tiene su propio enlace, aunque la navegación sea interna.
- Idioma principal: castellano; no es obligatorio rellenar todos los idiomas.
- Cambiar un procedimiento publicado crea una versión; los expedientes en curso siguen con la suya.
- El sistema vacío no trae procedimientos ni campos de procedimiento.
- La estructura (política y administrativa) son grupos; la relación entre ambas jerarquías es un
  enlace simbólico dentro del grupo político.
- Las agrupaciones libres son grupos, que contienen Conceptos y objetos y admiten enlaces
  simbólicos.
- Todo usuario tiene un grupo de inicio; hay un inicio público para quien entra sin sesión. El
  sistema vacío tiene el inicio del administrador.
- Dentro de un grupo, orden de creación por defecto, reorganizable.
- Navegación como un sistema de ficheros (sección 7.1).
- Las opciones de un `choice` tienen id y etiqueta por idioma; el objeto guarda el id.
