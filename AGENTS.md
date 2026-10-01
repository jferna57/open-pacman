# AGENTS.md

Vanilla JS/HTML/CSS Pac-Man. **No `package.json`, no bundler, no test runner, no linter, no CI.** Don't introduce npm tooling unless asked.

## Run it

Open `src/index.html` in a browser. Scripts are classic `<script>` tags, not modules, so `file://` works — no dev server needed. Verification is manual: play it and watch the console.

## Architecture: globals, not modules

Files never import each other. They communicate only through `window.*`, assigned at the bottom of each file:

| File | Exports | Owns |
| --- | --- | --- |
| `src/js/maze.js` | `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS` | level data |
| `src/js/game.js` | `createGame`, `update`, `DIRS` | state + rules |
| `src/js/render.js` | `draw` | canvas painting |
| `src/js/main.js` | — (entrypoint) | rAF loop, keyboard, overlay |

The `<script>` order in `src/index.html` (`maze` → `game` → `render` → `main`) is load-bearing: `main.js` calls `createGame()` at top level. Adding a file means adding the tag in the right position **and** exporting via `window.X`.

## Code style (easy to get wrong)

WordPress-style spacing — a space just inside every paren, bracket and brace:

```js
if ( aligned( p.x ) ) {                        // not if (aligned(p.x))
for ( let i = 0; i < game.ghosts.length; i++ ) {
const d = DIRS[ p.dir ];
```

2-space indent, semicolons, `const`/`let` only (`var` appears nowhere).

Comments, in-game strings (`SCORE`, `VIDAS`, `GANASTE`, `PERDISTE`) and specs are in **Spanish**; identifiers are English. Match that split.

## Maze invariants (`src/js/maze.js`)

The maze is authored as **31 ASCII strings of exactly 28 chars**, parsed by `parseTile`: `#` wall (1), `.` dot (2), ` ` empty walkable (0), `-` pen door (3). A door blocks Pac-Man but not ghosts.

When editing it, keep:

- 31 rows, every row exactly 28 chars;
- mirror symmetry about the vertical axis between cols 13 and 14 (every row is currently a palindrome);
- `TUNNEL_ROW = 14` — row 14 is the tunnel, its edges are open by design;
- `PACMAN_START` / `GHOST_STARTS` pointing at the right cells if rows shift;
- canvas 560×620 = 28×20 × 31×20 in **both** `src/index.html` (`<canvas width height>`) and `src/css/style.css` (`#game-wrap`) — `TILE = 20` lives in `render.js`.

## `MAZE` is pristine — draw from `game.grid`

`createGame()` copies `MAZE` row-by-row into `game.grid`; eating a dot sets `game.grid[y][x] = 0`. Never mutate `MAZE`, and never render from it: `render.js` reads `game.grid` so eaten dots stay gone. Restarting is just calling `createGame()` again.

## Movement is grid-snapped; speeds must be `1/N`

`x`/`y` are floats, but all movement logic runs only when `aligned()` (within `1e-3` of an integer), then snaps to the cell. Speeds are fractions of a cell per frame — Pac-Man `0.125` (1/8), ghosts `0.1` (1/10) — which only stays on-grid because `1/N` lands exactly on a cell every N frames. A speed like `0.15` desyncs actors from the maze. Keep speeds as `1/N`.

There is no `deltaTime`: one `requestAnimationFrame` is one step, so the game assumes ~60fps. Don't add real-time pacing without reworking the speed model.

## States and the overlay

`game.state` is `'start' | 'playing' | 'won' | 'lost'`. `main.js` only calls `update()` while `'playing'`, then shows the overlay once on the transition. On collision `update()` decrements `lives` and calls `resetPositions()` (positions only — eaten dots and score survive), or sets `'lost'` at 0 lives.

Overlay gotcha: `showOverlay()` overwrites `overlay.innerHTML` with a **new** `<button id="action-btn">` and re-binds the click via `getElementById`. The static button in `index.html` is wired separately once at load, so keep that wiring when editing overlay markup, and don't expect the `actionBtn` reference captured at load to survive a `showOverlay()` call.

## Spec-driven development is the workflow

This repo exists to practice spec-driven development (`README.md`). Two **user-invoked** skills live in `.agents/skills/` (pinned by `skills-lock.json`, source `klerith/fernando-skills`):

- `/spec <feature>` → writes `specs/NN-slug.md` in state `Draft`. Never writes code.
- `/spec-impl NN-slug` → refuses to run unless the spec state means *Approved*, then branches `spec-NN-slug` and implements step by step, pausing for diff review.

Both are `disable-model-invocation: true` — **don't invoke them on your own initiative**. `specs/` doesn't exist yet, so the first spec is `specs/01-*.md`.

Git has **no commits yet** on `main` and the whole tree is untracked. `spec-impl` halts when `git status --short` is non-empty, so expect to be asked to commit before it can branch.

While implementing: never commit on your own, and if a spec looks suboptimal, say so and implement what was agreed — changes to the spec go in the spec, not the code.