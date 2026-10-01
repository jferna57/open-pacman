# SPEC 02 — Salida de los fantasmas de la pen

> **Estado:** Approved
> **Depende en:** SPEC 01
> **Fecha:** 2026-10-01
> **Objetivo:** Los cuatro fantasmas abandonan la pen por la puerta (13,12) siguiendo una ruta fija, y cada uno se libera según cuántos dots ha comido Pac-Man.

## Por qué existe esta spec

Hoy tres de los cuatro fantasmas **no salen nunca** de la pen. Es un bug de la IA de SPEC 01, no un fallo
de dibujo: `decideGhost` elige la dirección que minimiza la distancia Manhattan al objetivo, y desde
dentro de la pen ese objetivo siempre está muy por debajo (Pac-Man en `y=23`, la esquina del `patrol` en
`y=29`). El paso greedy-óptimo apunta al suelo de la caja, y la puerta en (13,12) queda _más lejos_ del
objetivo que (13,15), así que nunca se considera. El único que escapaba era el `random`, por azar, en el
frame 215.

Simulación de 6000 frames sobre el código actual, sin modificar el repo:

| idx | kind       | Celdas visitadas fuera de la pen     |
| --- | ---------- | ------------------------------------ |
| 0   | `hunter`   | 0                                    |
| 1   | `ambusher` | 0                                    |
| 2   | `random`   | sale en el frame 215, por casualidad |
| 3   | `patrol`   | 0                                    |

SPEC 01 dejó esto anotado como spec siguiente ("Tiempos de salida de la pen, punto de salida y temporizador
por fantasma"). Esta spec lo resuelve.

## Alcance

**Dentro:**

- `releaseAt` en cada entrada de `GHOST_STARTS`: umbral de dots comidos que libera a cada fantasma
  (`0`, `0`, `30`, `60`).
- `PEN_EXIT_PATH` en `maze.js`: ruta de 4 celdas desde el centro de la pen hasta el corredor de la fila 11.
- `PEN_BOB_TOP` y `PEN_BOB_BOTTOM` en `maze.js`: filas entre las que bobina un fantasma que aún no ha sido
  liberado.
- `dotsEaten` en el estado del juego, incrementado en el mismo punto que `dotsRemaining`.
- Campos `mode` (`'house' | 'leaving' | 'chase'`), `exitStep` y `bobDir` en cada fantasma.
- Rama `house` en `moveGhost()`: bobin vertical, con override total de la IA.
- Rama `leaving` en `ghostTarget()` y `moveGhost()`: seguimiento de `PEN_EXIT_PATH` con avance de
  `exitStep`.
- Exención de la regla de inversión en `decideGhost()` mientras `mode === 'leaving'`.
- Progreso irreversible en `resetPositions()`: un fantasma ya liberado conserva `releaseAt = 0`.

**Fuera de alcance (specs futuras):**

- Fantasmas comibles, power-ups y estados `frightened` / `eaten`.
- BFS como métrica de distancia en `decideGhost()`, para la IA en general o solo dentro de la pen.
- Velocidades distintas por fantasma.
- Contador de dots que **no** se reinicie al morir.
- Que un fantasma liberado vuelva a entrar en la pen por su cuenta.
- Cualquier cambio en `MAZE`, el HUD o el overlay.

## Modelo de datos

```js
// src/js/maze.js
const GHOST_STARTS = [
  { x: 12, y: 14, kind: "hunter", releaseAt: 0 }, // rojo
  { x: 13, y: 14, kind: "ambusher", releaseAt: 0 }, // rosa
  { x: 14, y: 14, kind: "random", releaseAt: 30 }, // cian
  { x: 15, y: 14, kind: "patrol", releaseAt: 60 }, // naranja
];

// Ruta de salida: centro de la pen, puerta, corredor. Todo recto.
const PEN_EXIT_PATH = [
  { x: 13, y: 14 },
  { x: 13, y: 13 },
  { x: 13, y: 12 },
  { x: 13, y: 11 },
];

const PEN_BOB_TOP = 13; // fila superior del bobin
const PEN_BOB_BOTTOM = 15; // fila inferior del bobin
```

```js
// fantasma, en createGame() de game.js
{
  x, y, dir,
  speed: 0.1,
  kind: 'hunter',
  cornerIndex: 0,      // SPEC 01, sin cambios
  releaseAt: 0,        // dots que hay que comer para liberarlo
  mode: 'house',       // 'house' | 'leaving' | 'chase'
  exitStep: 0,         // índice en PEN_EXIT_PATH, solo si mode === 'leaving'
  bobDir: 'up',        // sentido del bobin, solo si mode === 'house'
}
```

```js
// estado del juego, en createGame() de game.js
{
  state: 'start',
  score: 0,
  lives: 3,
  dotsRemaining: dots,
  dotsEaten: 0,   // nuevo: se reinicia a 0 en cada muerte
  grid,
  pacman: { /* sin cambios */ },
  ghosts: [ /* los 4 de arriba */ ],
}
```

Convenciones:

- Coordenadas de celda, origen arriba-izquierda, enteras al decidir (`aligned()`).
- Velocidades sin cambios: Pac-Man `0.125`, fantasmas `0.1`.
- `releaseAt` vive **dentro** de cada entrada de `GHOST_STARTS`, no en un array paralelo indexado por
  posición, para que no pueda desincronizarse de `kind` ni del color.
- `PEN_BOB_TOP` y `PEN_BOB_BOTTOM` son las filas 13 y 15, las dos extremas de la pen. El bobin pasa por
  (x,14) por el medio.
- El bobin no cambia de columna: cada fantasma sube y baja en la que empieza.

### Máquina de estados de un fantasma

```
        dotsEaten >= releaseAt
house ──────────────────────────► leaving ──── exitStep >= 4 ────► chase
  ▲                                  │                              │
  └──────────── resetPositions ──────┴──────────────────────────────┘
```

- `house`: bobin vertical. La IA no interviene: se ignoran `kind`, `dir` y cualquier objetivo.
- `leaving`: objetivo fijo `PEN_EXIT_PATH[ exitStep ]`. Al estar alineado sobre ese waypoint, `exitStep++`.
- `chase`: comportamiento normal de SPEC 01 según `kind`.
- El único criterio de salida de `leaving` es `exitStep >= PEN_EXIT_PATH.length`. No se compara `y`
  contra ninguna constante: son dos fuentes de verdad para el mismo evento y discrepan.

## Plan de implementación

1. `maze.js`: añadir `releaseAt` a las 4 entradas de `GHOST_STARTS`, y añadir `PEN_EXIT_PATH`,
   `PEN_BOB_TOP` y `PEN_BOB_BOTTOM` con sus `window.*`. Prueba manual: abrir `src/index.html`, en consola
   `PEN_EXIT_PATH.length === 4` y `GHOST_STARTS.map( g => g.releaseAt )` da `[ 0, 0, 30, 60 ]`. El
   juego sigue igual: los 4 fantasmas se quedan quietos donde estaban, sin errores.

2. `game.js`: añadir `dotsEaten: 0` al objeto que devuelve `createGame()` e incrementarlo junto a
   `game.dotsRemaining--` en `movePacman()`. Añadir `mode: 'house'`, `exitStep: 0`, `bobDir: 'up'` y
   `releaseAt: g.releaseAt` al mapa de fantasmas de `createGame()`. Prueba manual:
   `createGame().ghosts.every( g => g.mode === 'house' )` es `true`, y al comer dots el contador sube de
   uno en uno.

3. `game.js`: en `resetPositions()`, resetear `mode = 'house'`, `exitStep = 0` y `bobDir = 'up'` en cada
   fantasma, y poner `game.dotsEaten = 0`. Sin la parte irreversible todavía. Prueba manual: al perder
   una vida, los 4 vuelven a su celda inicial. Sin cambios observables, porque aún no hay liberación.

4. `game.js`: rama `house` al principio de `moveGhost()`. Sube y baja entre `PEN_BOB_TOP` y
   `PEN_BOB_BOTTOM` forzando `dir = bobDir` e invirtiendo `bobDir` al llegar a cada extremo, y hace
   `return` antes de la lógica normal. Si `dotsEaten >= releaseAt`, cambia a `mode = 'leaving'` en vez de
   bobinar. Prueba manual: los 4 fantasmas suben y bajan dentro de la caja indefinidamente y **ninguno**
   sale. El `random` ya no se escapa por azar: es el cambio esperado en este paso.

5. `game.js`: rama `leaving`. En `ghostTarget()`, devolver `PEN_EXIT_PATH[ g.exitStep ]` antes de
   evaluar `kind`. En `moveGhost()`, al estar alineado, comprobar si el fantasma está sobre
   `PEN_EXIT_PATH[ exitStep ]`; si lo está, `exitStep++`; si `exitStep` llega a `PEN_EXIT_PATH.length`,
   `mode = 'chase'`. Prueba manual: con `dotsEaten` a 0, el rojo y el rosa salen de la pen y se ponen a
   perseguir; el cian y el naranja siguen bobinando.

6. `game.js`: en `decideGhost()`, eximir a `mode === 'leaving'` de la exclusión de `OPPOSITE`. Sin esto,
   un fantasma que bobina en la fila 13 mirando hacia arriba no puede bajar al primer waypoint y da un
   rodeo. Prueba manual: el naranja, que empieza en (15,14), sale en línea recta por (14,14) → (13,14)
   → (13,13) → (13,12) → (13,11), sin zigzag.

7. `game.js`: en `resetPositions()`, poner `releaseAt = 0` a cualquier fantasma cuyo `mode` no sea
   `'house'`, antes de devolverlo a la pen. Prueba manual: tras perder una vida, el rojo y el rosa
   vuelven a la caja y salen de inmediato, mientras el cian y el naranja siguen esperando su umbral.

## Criterios de aceptación

- [ ] `PEN_EXIT_PATH` tiene exactamente 4 entradas: (13,14), (13,13), (13,12), (13,11).
- [ ] Los 4 `releaseAt` son `0`, `0`, `30`, `60` en el orden de `GHOST_STARTS`.
- [ ] `createGame().dotsEaten === 0`, y sube en 1 por cada dot comido, en el mismo `if` que
      decrementa `dotsRemaining`.
- [ ] Los 4 fantasmas arrancan con `mode === 'house'`, `exitStep === 0` y `bobDir === 'up'`.
- [ ] Mientras `mode === 'house'`, un fantasma solo pisa las filas 13, 14 y 15, y nunca cambia de columna.
- [ ] Con `dotsEaten === 0`, salen exactamente 2 fantasmas: el `hunter` y el `ambusher`. El `random` y
      el `patrol` siguen en `house`.
- [ ] Con `dotsEaten === 30`, el `random` también sale. El `patrol` sigue en `house`.
- [ ] Con `dotsEaten === 60`, salen los 4.
- [ ] Ningún fantasma sale de la pen sin haber pasado por `PEN_EXIT_PATH` completo: la secuencia de
      celdas que recorre en `leaving` es un prefijo exacto de `PEN_EXIT_PATH` desde su celda de salida.
- [ ] El `hunter` recorre `12,14 → 13,14 → 13,13 → 13,12 → 13,11`. El `ambusher`
      `13,14 → 13,13 → 13,12 → 13,11`. El `random` `14,14 → 13,14 → 13,13 → 13,12 → 13,11`. El
      `patrol` `15,14 → 14,14 → 13,14 → 13,13 → 13,12 → 13,11`.
- [ ] Un fantasma en `leaving` puede invertir su dirección si el waypoint lo exige. Ningún otro modo
      puede.
- [ ] Un fantasma en `leaving` nunca permanece más de 50 frames consecutivos sin alcanzar su siguiente
      waypoint.
- [ ] `ghostTarget()` nunca se llama con `exitStep >= PEN_EXIT_PATH.length`: no hay `TypeError` al leer
      `.x` de un waypoint `undefined`.
- [ ] Al morir, los 4 vuelven a la pen con `mode === 'house'`, `exitStep === 0`, `bobDir === 'up'` y
      `dotsEaten === 0`.
- [ ] Al morir, un fantasma que ya estaba en `leaving` o `chase` conserva `releaseAt === 0` y sale de
      nuevo de inmediato. Uno que seguía en `house` conserva su `releaseAt` original.
- [ ] `resetPositions()` es la única función que muta `releaseAt`.
- [ ] La puerta (3) en (13,12) y (14,12) sigue bloqueando a Pac-Man y no a los fantasmas: el cambio no
      altera `isWall()`.
- [ ] `MAZE` no se ha modificado.
- [ ] La consola no muestra errores al cargar ni durante 2 minutos de partida.

> Criterios verificables headless: los datos, los umbrales 0/0/30/60, las cuatro rutas literales, el bobin
> en filas 13/14/15 con columna fija, el reinicio con progreso irreversible y 20 000 frames con
> colisiones reales sin excepciones ni atasco se comprobaron sobre una implementación de referencia en un
> fichero temporal, sin tocar el repo. El último criterio queda pendiente de la prueba manual en
> navegador, que no se puede automatizar aquí: no hay runner de tests.

## Decisiones

- **Sí:** ruta de waypoints fija en vez de corregir la IA. La pen es un callejón sin salida para un
  objetivo que está siempre por debajo; cualquier heurística local sigue atascada. Una ruta de 4 celdas
  rectas hace que el `decideGhost()` existente sea correcto sin tocar su heurística.
- **Sí:** un solo criterio de salida, `exitStep >= PEN_EXIT_PATH.length`, en el mismo punto donde avanza
  `exitStep`. La primera versión de la implementación usaba `y <= PEN_EXIT_PATH[ 3 ].y` después de mover, y
  fallaba: en el frame siguiente `exitStep` ya valía 4 y `PEN_EXIT_PATH[ 4 ].x` lanzaba `TypeError`.
  Comparar `y` además de `exitStep` son dos fuentes de verdad para el mismo evento, y discrepan.
- **Sí:** exención de `OPPOSITE` mientras `leaving`. Medido: sin ella el `patrol` recorre
  `15,13 → 14,13 → 13,13 → 13,14 → 12,14 → 12,13 → 13,12`. Sale igual, pero con 3 celdas de más y un
  zigzag visible. Con ella la ruta es exactamente `PEN_EXIT_PATH` y el criterio de aceptación puede
  afirmar la secuencia literal.
- **Sí:** `releaseAt` dentro de cada entrada de `GHOST_STARTS`. Un array paralelo `RELEASE_AT[ i ]`
  indexado por posición se desincroniza de `kind` y de `GHOST_COLORS` en cuanto alguien reordena
  `GHOST_STARTS`.
- **Sí:** la liberación la dispara `dotsEaten` y no un contador de frames. Es independiente de los ~60fps
  que ya asumimos, y reproduce la rampa de dificultad del original.
- **Sí:** umbrales `0 / 0 / 30 / 60`, escalonado clásico. Medido con un bot que juega de verdad (BFS al
  dot más cercano): 30 dots son 4,0 s de supervivencia, 60 dots son 21,5 s. El rojo y el rosa salen de
  inmediato, el cian es holgado, el naranja es exigente.
- **Sí:** bobin vertical mientras esperan. Da vida a la caja y es la señal visual de "este fantasma aún no
  ha salido". Además hace imposible que el `random` se escape por accidente, que es justo el
  comportamiento que esta spec elimina.
- **Sí:** `resetPositions()` devuelve a los 4 a la pen y pone `dotsEaten = 0`. La partida se pone igual de
  difícil en cada vida.
- **Sí:** un fantasma ya liberado recibe `releaseAt = 0` al morir, así que vuelve a salir de inmediato.
  Hace que la liberación sea irreversible y que el umbral 60 no dependa de sobrevivir 21 s **consecutivos**.
  Los dots comidos antes de morir no se conservan, pero sí el haber sido liberado.
- **No:** BFS como métrica de distancia. Arreglaría la causa raíz y dejaría obsoleta la decisión de
  SPEC 01 sobre Manhattan, además de cambiar el carácter de los cuatro comportamientos. La ruta fija es
  más pequeña y no toca la IA existente.
- **No:** mantener `dotsEaten` acumulado al morir. El original lo reinicia, y conservarlo haría la
  partida más fácil en cada vida sin que nadie lo haya pedido.
- **No:** que los fantasmas vuelvan a entrar en la pen después de salir. Ningún `kind` de SPEC 01 tiene un
  objetivo dentro de la pen, así que no harían falta más reglas.
- **No:** un estado `frightened` ni pausa al liberar. Van en su propia spec si aparecen.

## Riesgos

| Riesgo                                                                                                                                                                 | Mitigación                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El umbral 60 exige ~21,5 s de supervivencia en una sola vida, y `dotsEaten` se reinicia al morir, así que el naranja puede no aparecer nunca en una partida de 3 vidas | Medido: 30 dots son 4,0 s, así que el cian es seguro. Si en la prueba manual el naranja no sale en 3 vidas, la corrección es bajar un número: `releaseAt` de 60 a 30. No hace falta tocar lógica. |
| `releaseAt` pasa a ser mutable y su valor original se pierde al morir                                                                                                  | Único punto de mutación: `resetPositions()`. Declarado en un criterio de aceptación.                                                                                                              |
| La ruta de waypoints depende de la geometría exacta de la pen; si `MAZE` cambia, `PEN_EXIT_PATH` queda obsoleto                                                        | `PEN_EXIT_PATH` está al lado de `GHOST_STARTS` en `maze.js` y su comentario dice qué representa. Editar las filas 12-15 de `MAZE` obliga a revisarlo.                                             |
| `moveGhost()` crece con tres ramas (`house`, `leaving`, normal) y un `return` en medio                                                                                 | La rama `house` hace `return` temprano y no comparte nada con las otras dos. El código de `leaving` son 6 líneas.                                                                                 |
| El `random` deja de comportarse erráticamente dentro de la pen                                                                                                         | Es intencional: el bobin sustituye al azar en `house`, y el comportamiento errático de SPEC 01 se conserva intacto una vez `chase`.                                                               |
| `dotsEaten` y `dotsRemaining` son dos contadores del mismo evento y podrían desincronizarse                                                                            | Se incrementan y decrementan en el mismo `if` de `movePacman()`. La suma `dotsEaten + dotsRemaining` es constante durante toda la partida.                                                        |

## Qué **no** incluye esta spec

- Fantasmas comibles, power-ups y estados `frightened` / `eaten`.
- BFS como métrica de distancia, ni para la pen ni para el resto de la IA.
- Velocidades distintas por fantasma.
- Un contador de dots que sobreviva a la muerte.
- Que un fantasma liberado pueda volver a entrar en la pen.
- Cambios en `MAZE`, el HUD o el overlay.

Cada uno de esos, si aterriza, va en su propia spec.
