// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS, PATROL_CORNERS, PEN_EXIT_PATH,
// PEN_BOB_TOP, PEN_BOB_BOTTOM.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    dotsEaten: 0, // sube 1 por cada dot comido; se reinicia al morir
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      cornerIndex: 0, // solo lo usa 'patrol': alterna entre PATROL_CORNERS
      releaseAt: g.releaseAt, // dots que hay que comer para sacarlo de la pen
      mode: 'house',           // 'house' | 'leaving' | 'chase'
      exitStep: 0,             // indice en PEN_EXIT_PATH, solo si mode === 'leaving'
      bobDir: 'up',            // sentido del bobin, solo si mode === 'house'
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
      game.dotsEaten++;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Celda objetivo de un fantasma segun su 'kind'. Un kind = un destino, y la
// direccion se elige minimizando la distancia Manhattan a la celda vecina.
// Devuelve null para 'random', que no necesita objetivo.
function ghostTarget( game, g ) {
  const grid = game.grid;
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );

  // Saliendo de la pen: el unico objetivo es el siguiente waypoint. Tiene
  // prioridad sobre 'kind'.
  if ( g.mode === 'leaving' ) return PEN_EXIT_PATH[ g.exitStep ];

  // Persigue directo.
  if ( g.kind === 'hunter' ) return { x: px, y: py };

  // Se adelanta 3 celdas en la direccion de Pacman.
  if ( g.kind === 'ambusher' ) {
    const d = DIRS[ p.dir ];
    const tx = px + d.x * 3;
    const ty = py + d.y * 3;
    // Si la celda es muro o esta fuera del grid, apuntar a Pacman.
    if ( isWall( grid, tx, ty, 'ghost' ) ) return { x: px, y: py };
    return { x: tx, y: ty };
  }

  // Ronda por dos esquinas alternando.
  if ( g.kind === 'patrol' ) {
    const corner = PATROL_CORNERS[ g.cornerIndex ];
    if ( g.x === corner.x && g.y === corner.y ) g.cornerIndex = 1 - g.cornerIndex;
    return PATROL_CORNERS[ g.cornerIndex ];
  }

  return null;
}

function decideGhost( game, g ) {
  const grid = game.grid;

  // Saliendo de la pen se permite el giro de 180: un fantasma que acaba de
  // subir mirando hacia arriba tiene que poder bajar al siguiente waypoint.
  // En el resto de modos sigue valiendo la regla de no invertir.
  const allowed = g.mode === 'leaving' ? () => true : ( dir ) => dir !== OPPOSITE[ g.dir ];
  const options = Object.keys( DIRS ).filter(
    ( dir ) => allowed( dir ) && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  const target = ghostTarget( game, g );
  // Sin objetivo: errático.
  if ( !target ) {
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    return;
  }

  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // En la pen: bobin vertical y nada mas. La IA no interviene, no se miran
  // kind, dir ni ningun objetivo. Al alcanzar su umbral de dots comidos el
  // fantasma pasa a 'leaving' y deja de bobinar.
  if ( g.mode === 'house' ) {
    if ( game.dotsEaten >= g.releaseAt ) {
      g.mode = 'leaving';
      return;
    }
    if ( aligned( g.x ) && aligned( g.y ) ) {
      g.x = Math.round( g.x );
      g.y = Math.round( g.y );
      // Invertir al tocar cada extremo. El bobin no cambia de columna.
      if ( g.bobDir === 'up' && g.y <= PEN_BOB_TOP ) g.bobDir = 'down';
      else if ( g.bobDir === 'down' && g.y >= PEN_BOB_BOTTOM ) g.bobDir = 'up';
      g.dir = g.bobDir;
    }
    const bd = DIRS[ g.dir ];
    g.x += bd.x * g.speed;
    g.y += bd.y * g.speed;
    return;
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    // Saliendo de la pen: al pisar el waypoint se avanza. Al terminar la ruta
    // el fantasma pasa a 'chase'. Unico criterio de salida: exitStep completo.
    if ( g.mode === 'leaving' ) {
      const wp = PEN_EXIT_PATH[ g.exitStep ];
      if ( wp && g.x === wp.x && g.y === wp.y ) {
        g.exitStep++;
        if ( g.exitStep >= PEN_EXIT_PATH.length ) g.mode = 'chase';
      }
    }
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.dotsEaten = 0;
  game.ghosts.forEach( ( g, i ) => {
    // Progreso irreversible: un fantasma ya liberado conserva el umbral 0 y
    // sale de inmediato en la siguiente vida, aunque dotsEaten vuelva a 0.
    // Hay que leer mode ANTES de resetearlo.
    if ( g.mode !== 'house' ) g.releaseAt = 0;
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.cornerIndex = 0;
    g.mode = 'house';
    g.exitStep = 0;
    g.bobDir = 'up';
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
