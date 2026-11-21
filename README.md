# best-stealth-game-20261121-1759-entry

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Richat1801/best-stealth-game-20261121-1759-entry/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Richat1801/best-stealth-game-20261121-1759-entry/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

**The Velvet Hour** — a top-down stealth game for make.fun's "Make the best stealth game" bounty. You are Wren, a cat burglar, and tonight the Marrowgate Museum is yours — if no warden ever sees you.

## The game

- **Goal:** slip through 3 halls, pocket every moon-gem, and reach the green exit unseen. The exit stays locked until the last gem is pocketed.
- **Guards with vision cones:** night wardens patrol fixed routes (shown as faint dots, so you can learn them). Their cones are yellow while calm, orange while suspicious, red while hunting. A detection ring fills over a warden's head as it spots you — break line of sight before it fills.
- **Cover you can read:** wooden crates block sight and movement; bushes hide you completely (unless a warden is right on top of you). Walls, crates and bushes all block a cone.
- **Noise:** running is loud — wardens within earshot come to investigate the sound. Sneaking (C) is slow, silent, and halves how fast you are spotted. Footsteps pip from the warden's side of the screen.
- **Coins:** click anywhere within reach to toss a coin; the clink pulls the nearest warden over to look. 3 per level.
- **Cameras (level 3):** sweeping red cones that trip the alarm just as fast as a warden's eyes.
- **Recovery, not instant death:** get spotted and the hall hunts you — but break line of sight, hide in a bush, and the search fades. Get caught and the level restarts. Finish a level never spotted for a +500 Ghost bonus.
- **Feel:** synthesised WebAudio throughout — footsteps, alert stings, coin clinks, pickup chimes and a slow minor-key music bed. No audio or image files; everything is drawn and played in code.

## Controls

- **WASD / arrows** — move
- **Shift** — run (loud)
- **C / Ctrl** — sneak (slow, quiet, harder to spot)
- **Click** — toss a coin to lure a warden
- **P** pause · **M** mute · **R** retry level

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Or serve `game/` with any static file server — no build step, no network requests. `main.ts` (Node 22) hands the entry in: it copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the kit's `vendor/makefun-game.ts`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=dss38k9p&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
