// maze.js
// Laberinto 28x31 fiel a la geometria del nivel 1 de Pac-Man.
// Se escribe como 31 strings de 28 chars (legible) y se parsea a numeros.
//   '#' pared(1) · '.' dot(2) · ' ' vacio transitable(0) · '-' puerta pen(3)
// Coordenadas: celda (x,y), origen arriba-izquierda. x in [0,27], y in [0,30].
// Simetrico respecto al eje vertical central (entre cols 13 y 14).

const MAZE_STR = [
  '############################', // 0  borde
  '#............##............#', // 1
  '#.####.#####.##.#####.####.#', // 2
  '#.####.#####.##.#####.####.#', // 3
  '#.####.#####.##.#####.####.#', // 4
  '#..........................#', // 5
  '#.####.##.########.##.####.#', // 6
  '#.####.##.########.##.####.#', // 7
  '#......##....##....##......#', // 8
  '######.#####.##.#####.######', // 9
  '######.#####.##.#####.######', // 10
  '######.##..........##.######', // 11
  '######.##.###--###.##.######', // 12  puerta pen cols 13-14
  '######.##.#      #.##.######', // 13  interior pen
  '          #      #          ', // 14  tunel (extremos abiertos) + pen
  '######.##.#      #.##.######', // 15  interior pen
  '######.##.########.##.######', // 16  fondo pen
  '######.##..........##.######', // 17
  '######.#####.##.#####.######', // 18
  '######.#####.##.#####.######', // 19
  '#............##............#', // 20
  '#.####.#####.##.#####.####.#', // 21
  '#.####.#####.##.#####.####.#', // 22
  '#...##................##...#', // 23  fila inicio Pacman (13,23)
  '###.##.##.########.##.##.###', // 24
  '###.##.##.########.##.##.###', // 25
  '#......##....##....##......#', // 26
  '#.##########.##.##########.#', // 27
  '#.##########.##.##########.#', // 28
  '#..........................#', // 29
  '############################', // 30  borde
];

function parseTile( ch ) {
  if ( ch === '#' ) return 1;
  if ( ch === '.' ) return 2;
  if ( ch === '-' ) return 3;
  return 0; // espacio = vacio transitable
}

// Matriz numerica pristina (no se muta; cada partida copia esto).
const MAZE = MAZE_STR.map( ( row ) => row.split( '' ).map( parseTile ) );

const TUNNEL_ROW = 14;
const PACMAN_START = { x: 13, y: 23 };
// releaseAt: dots que hay que comer para liberar al fantasma de la pen.
const GHOST_STARTS = [
  { x: 12, y: 14, kind: 'hunter', releaseAt: 0 },   // rojo
  { x: 13, y: 14, kind: 'ambusher', releaseAt: 0 }, // rosa
  { x: 14, y: 14, kind: 'random', releaseAt: 30 },  // cian
  { x: 15, y: 14, kind: 'patrol', releaseAt: 60 },  // naranja
];
// Esquinas que alterna el fantasma 'patrol' como destino.
const PATROL_CORNERS = [ { x: 1, y: 29 }, { x: 26, y: 1 } ];

// Ruta de salida de la pen: centro de la pen, puerta y corredor. Todo recto.
// Depende de la geometria de las filas 11-14 de MAZE_STR; si esas filas
// cambian, esta ruta hay que revisarla.
const PEN_EXIT_PATH = [
  { x: 13, y: 14 },
  { x: 13, y: 13 },
  { x: 13, y: 12 },
  { x: 13, y: 11 },
];
// Filas entre las que bobina un fantasma que aun no ha sido liberado. El
// bobin pasa por (x,14) por el medio y no cambia de columna.
const PEN_BOB_TOP = 13;
const PEN_BOB_BOTTOM = 15;

window.MAZE = MAZE;
window.TUNNEL_ROW = TUNNEL_ROW;
window.PACMAN_START = PACMAN_START;
window.GHOST_STARTS = GHOST_STARTS;
window.PATROL_CORNERS = PATROL_CORNERS;
window.PEN_EXIT_PATH = PEN_EXIT_PATH;
window.PEN_BOB_TOP = PEN_BOB_TOP;
window.PEN_BOB_BOTTOM = PEN_BOB_BOTTOM;
