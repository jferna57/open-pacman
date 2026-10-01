# SPEC 01 — Cuatro fantasmas con comportamientos distintos

> **Estado:** Approved
> **Depende en:** —
> **Fecha:** 2026-10-01
> **Objetivo:** Cuatro fantasmas en juego, cada uno con un comportamiento distinto de persecución (`hunter`, `ambusher`, `random`, `patrol`).

## Por qué existe esta spec

Hoy hay 2 fantasmas (`hunter` con distancia Manhattan y `random`) pero `render.js` ya tiene 4 colores. Esta spec pasa a 4 fantasmas, unifica la lógica de decisión en un único comparador y añade dos comportamientos nuevos (`ambusher` y `patrol`).

## Alcance

**Dentro:**

- 4 entradas en `GHOST_STARTS`, todas en la fila 14 de la pen: (12,14), (13,14), (14,14), (15,14).
- 4 valores de `ghost.kind`: `hunter`, `ambusher`, `random`, `patrol`.
- Función `ghostTarget( game, g )` que devuelve la celda objetivo según el `kind`, y `decideGhost` refactorizado para consumirla.
- `PATROL_CORNERS` en `maze.js` con las 2 esquinas de escape del `patrol`.
- `cornerIndex` en el fantasma, inicializado y reiniciado junto a las posiciones.
- `GHOST_COLORS` reordenado para que rojo=hunter, rosa=ambusher, cian=random, naranja=patrol.

**Fuera de alcance (specs futuras):**

- Tiempos de salida de la pen (punto de salida y temporizador por fantasma).
- Fantasmas comibles, power-ups, estados `frightened`/`eaten`.
- Velocidades distintas por fantasma.
- Balance de dificultad con 4 fantasmas y 3 vidas.
- Cualquier cambio en `MAZE`, el HUD o el overlay.

## Modelo de datos

```js
// src/js/maze.js
const GHOST_STARTS = [
  { x: 12, y: 14, kind: 'hunter' },   // rojo
  { x: 13, y: 14, kind: 'ambusher' }, // rosa
  { x: 14, y: 14, kind: 'random' },   // cian
  { x: 15, y: 14, kind: 'patrol' },   // naranja
];
const PATROL_CORNERS = [ { x: 1, y: 29 }, { x: 26, y: 1 } ];

// fantasma en src/js/game.js (createGame)
{
  x, y, dir,
  speed: 0.1,
  kind: 'hunter',
  cornerIndex: 0, // solo lo usa 'patrol': alterna entre PATROL_CORNERS
}

// src/js/render.js
const GHOST_COLORS = [ '#ff0000', '#ffb8ff', '#00ffff', '#ffb852' ];
```

Convenciones:

- Coordenadas de celda, origen arriba-izquierda; enteras al decidir (`aligned()`).
- Un `kind` = una celda objetivo. La dirección se elige minimizando la distancia Manhattan a la celda vecina.
- Objetivo del `hunter`: la celda de Pac-Man.
- Objetivo del `ambusher`: celda de Pac-Man + 3 celdas en `pacman.dir`. Si la celda resultante es muro o está fuera del grid, se usa la celda de Pac-Man.
- Objetivo del `patrol`: `PATROL_CORNERS[ cornerIndex ]`. Al llegar a esa celda, `cornerIndex = 1 - cornerIndex`.
- Objetivo del `random`: ninguno; elige al azar entre las direcciones legales.
- Velocidades sin cambios: todos a `GHOST_SPEED = 0.1` (1/10 celda/frame).

## Plan de implementación

1. `maze.js`: sustituir `GHOST_STARTS` por las 4 entradas y añadir `PATROL_CORNERS` con su `window.PATROL_CORNERS`. Prueba manual: abrir `src/index.html`, en consola `PATROL_CORNERS.length === 2` y se ven 4 fantasmas (los dos nuevos en rojo por el fallback de color), sin errores.
2. `game.js`: añadir `cornerIndex: 0` al mapa de fantasmas de `createGame()` y resetearlo a `0` en `resetPositions()`. Prueba manual: al perder una vida, los 4 fantasmas vuelven a su celda inicial.
3. `game.js`: añadir `ghostTarget( game, g )` con las 4 ramas y reescribir `decideGhost` para usar el objetivo (Manhattan para `hunter`/`ambusher`/`patrol`, azar para `random`), manteniendo el giro de 180 en callejones. Prueba manual: el rojo sigue a Pac-Man, el rosa se adelanta, el naranja va a la esquina inferior izquierda y luego a la superior derecha, el cian va errático.
4. `render.js`: reordenar `GHOST_COLORS` a `[ rojo, rosa, cian, naranja ]`. Prueba manual: el agresivo se dibuja rojo, el errático cian.

## Criterios de aceptación

- [ ] `createGame().ghosts.length === 4`.
- [ ] Los 4 `kind` son exactamente `hunter`, `ambusher`, `random` y `patrol`, uno de cada uno.
- [ ] Las 4 posiciones iniciales son (12,14), (13,14), (14,14) y (15,14).
- [ ] El `hunter` reduce la distancia Manhattan a Pac-Man en cada decisión.
- [ ] El `ambusher` se dirige a la celda 3 posiciones por delante de Pac-Man y cae a la celda de Pac-Man si esa celda es muro o está fuera del grid.
- [ ] El `patrol` va a (1,29), al llegar cambia a (26,1), y al llegar vuelve a (1,29).
- [ ] El `random` elige entre las direcciones legales de forma no determinista: dos partidas seguidas dan trayectorias distintas.
- [ ] Ningún fantasma elige la dirección inversa a la suya salvo en callejones sin salida.
- [ ] Los 4 fantasmas se dibujan en rojo, rosa, cian y naranja, en el orden de `GHOST_STARTS`.
- [ ] Los 4 fantasmas mantienen `speed === 0.1`.
- [ ] Al perder una vida, los 4 vuelven a su celda inicial y `cornerIndex` vuelve a `0`.
- [ ] La consola no muestra errores al cargar ni durante 2 minutos de partida.

## Decisiones

- **Sí:** 4 fantasmas en vez de 2. Aprovecha los 4 colores que ya existen en `render.js`.
- **Sí:** mantener `hunter` como nombre del agresivo en vez de renombrarlo a `chaser`. El término ya existe en el código y el diff queda mínimo.
- **Sí:** los 4 tipos comparten un único comparador Manhattan y solo cambian la celda objetivo. Una IA por tipo en funciones separadas dispararía el coste sin aportar aquí.
- **Sí:** `patrol` con dos esquinas fijas que alterna, en vez de una ruta de waypoints. Dos datos en lugar de un array de destinos.
- **Sí:** `cornerIndex` (`0`/`1`) en el fantasma en vez de un objeto `target` mutado. Evita que dos fantasmas compartan el mismo objeto al copiar desde `GHOST_STARTS`.
- **No:** distancia Euclídea. Los actores solo se mueven en 4 direcciones; Manhattan encaja con la rejilla y con el código actual.
- **No:** velocidad por fantasma. El modelo de rejilla exige velocidades `1/N`; mezclar fracciones desincroniza a los actores del laberinto.
- **No:** lógica de salida de la pen. Es el siguiente paso natural y merece spec propia.
- **No:** tocar `MAZE`. Las celdas (12..15, 14) ya son transitable para fantasmas.

## Riesgos

| Riesgo                                                                     | Mitigación                                                                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Reordenar `GHOST_COLORS` descoloca el color de un fantasma existente       | El orden de `GHOST_COLORS` y de `GHOST_STARTS` queda escrito en la spec; se cambian en el mismo paso (paso 4).     |
| El `patrol` se queda encerrado en una esquina sin salida hacia su objetivo | (1,29) y (26,1) están conectadas al resto del laberinto, y `choices` siempre incluye el giro de 180 en callejones. |
| El objetivo del `ambusher` cae en un muro y el fantasma se vuelve perezoso | Fallback definido: si la celda objetivo no es transitable, se apunta a la celda de Pac-Man.                        |
| 4 fantasmas hacen la partida injugable con 3 vidas                         | Fuera de alcance (balance). Se ajusta en una spec de dificultad si aparece.                                        |

## Qué **no** incluye esta spec

- Tiempos de salida del pen.
- Fantasmas comibles y power-ups.
- Velocidades distintas por fantasma.
- Balance de dificultad.
- Cambios en `MAZE`, HUD u overlay.

Cada uno de esos, si aterriza, va en su propia spec.
