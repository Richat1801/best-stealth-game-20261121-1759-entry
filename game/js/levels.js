// Level definitions for The Velvet Hour.
// Each map is a 24 x 15 grid of tiles:
//   '#' wall   '.' floor   'C' crate (blocks movement and sight)
//   'B' bush   (dense foliage: blocks sight, hides the player inside, slows movement)
//   'P' player start   'E' exit   '*' moon-gem (collect them all to unlock the exit)
//   'G' guard spawn (patrol routes are listed per level, in tile coordinates)
//   'M' security camera mount (sweeps a cone; listed per level)
export const TILE = 40;
export const COLS = 24;
export const ROWS = 15;

export const LEVELS = [
  {
    name: 'Level 1 — The Marble Hall',
    briefing:
      'Slip past the night wardens, pocket all three moon-gems, and reach the green exit unseen.',
    par: 90,
    map: [
      '########################',
      '#P....C......B......*..#',
      '#......................#',
      '#.###.....####.....###.#',
      '#.#.......#......#.....#',
      '#.#..B....#..C...#.....#',
      '#.#.......#......#.....#',
      '#.#..###..#..###..#..E.#',
      '#.#.......#......#.....#',
      '#.#..C....#..B...#.....#',
      '#.#.......#......#.....#',
      '#.###.....####.....###.#',
      '#......................#',
      '#*.....B.......C.....*.#',
      '########################',
    ],
    guards: [
      { path: [[5, 2], [17, 2], [17, 1], [5, 1]], speed: 58, pause: 1.2 },
      { path: [[18, 12], [6, 12], [6, 9], [18, 9]], speed: 58, pause: 1.2 },
    ],
    cameras: [],
  },
  {
    name: 'Level 2 — The Gallery of Whispers',
    briefing:
      'Three wardens now, and the hall is full of crates. Coins distract a warden — click to toss one.',
    par: 120,
    map: [
      '########################',
      '#P...#......C.....B...*#',
      '#....#..............#..#',
      '#.C..#..####..###...#..#',
      '#....#..#......#....#..#',
      '#.B..#..#..*...#....#..#',
      '#....#..#......#....#..#',
      '###.####.####.####.###.#',
      '#......................#',
      '#..C.....B......C......#',
      '#......................#',
      '#..B....####....C....*.#',
      '#......................#',
      '#*....C......B.......E.#',
      '########################',
    ],
    guards: [
      { path: [[3, 1], [19, 1], [19, 5], [3, 5]], speed: 66, pause: 0.9 },
      { path: [[2, 8], [21, 8], [21, 10], [2, 10]], speed: 66, pause: 0.9 },
      { path: [[12, 12], [12, 9], [20, 9], [20, 12]], speed: 72, pause: 0.7 },
    ],
    cameras: [],
  },
  {
    name: 'Level 3 — The Moonpearl Vault',
    briefing:
      'The vault at last. Cameras sweep the floor — their red cones raise the alarm just as fast.',
    par: 150,
    map: [
      '########################',
      '#P....#.....C....B....*#',
      '#.....#................#',
      '#.###.#..####...###..#.#',
      '#.#...#..#......#....#.#',
      '#.#.B.#..#..*...#..C.#.#',
      '#.#...#..#......#....#.#',
      '#.###.#..####...###..#.#',
      '#.....#................#',
      '#..C..#....B.....C...#.#',
      '#.....#................#',
      '#.###.....####....###..#',
      '#......................#',
      '#*...B......C......*..E#',
      '########################',
    ],
    guards: [
      { path: [[7, 1], [20, 1], [20, 4], [7, 4]], speed: 74, pause: 0.8 },
      { path: [[2, 8], [21, 8], [21, 10], [2, 10]], speed: 74, pause: 0.8 },
      { path: [[11, 13], [4, 13], [4, 12], [11, 12]], speed: 80, pause: 0.6 },
      { path: [[20, 12], [20, 5], [18, 5], [18, 12]], speed: 80, pause: 0.6 },
    ],
    cameras: [
      { tx: 11, ty: 2, base: Math.PI / 2, sweep: 1.1, speed: 0.55, range: 230 },
      { tx: 11, ty: 10, base: -Math.PI / 2, sweep: 1.1, speed: 0.65, range: 230 },
    ],
  },
];

// Parse one map into a grid of tile chars plus the interesting points.
export function parseLevel(def) {
  const grid = def.map.map((row) => row.split(''));
  let playerStart = null;
  let exit = null;
  const gems = [];
  const guardSpawns = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = grid[y][x];
      if (ch === 'P') { playerStart = { x, y }; grid[y][x] = '.'; }
      if (ch === 'E') { exit = { x, y }; grid[y][x] = '.'; }
      if (ch === '*') { gems.push({ x, y, taken: false }); grid[y][x] = '.'; }
      if (ch === 'G') { guardSpawns.push({ x, y }); grid[y][x] = '.'; }
    }
  }
  return { grid, playerStart, exit, gems, guardSpawns };
}

export function tileAt(grid, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
  return grid[ty][tx];
}

export function isSolidTile(ch) {
  return ch === '#' || ch === 'C';
}

export function blocksSightTile(ch) {
  return ch === '#' || ch === 'C' || ch === 'B';
}
