# Turnbound Forge

A Turnbound build planner with a 7×7 grid and polyomino tiles. Plan your builds, unlock cells, and share layouts.

## Getting Started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) and open the planner at `/planner`.

## Planned Features

- Grid planner (7×7)
- Polyomino tiles with rotation
- Unlock-anywhere
- Trinket slots
- Weapon cap validation
- Shareable URLs

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Zustand

## Status

Scaffolding in progress.

## Adding or editing items

Items are authored in `data/items.csv` and compiled into `data/items.json`, which remains the runtime data source used by the app.

- **Edit items**: add or update rows in `data/items.csv`.
- **Regenerate JSON**:

```bash
npm run gen:items
```

This command validates the CSV and rewrites `data/items.json`. Commit **both** `data/items.csv` and `data/items.json` when changing item data.

### CSV field formats

- **tags**: `;`-separated list of tags.
  - Example: `melee;bleed;adjacent`
- **shapeCells**: semicolon-separated `x y` coordinate pairs describing occupied cells relative to the item’s anchor.
  - Example: `0 0;1 0;0 1` → cells at \[(0,0), (1,0), (0,1)\].
- **pivot**: a single `x y` coordinate used as the rotation pivot for the shape.
  - Example: `0 0`

Other important fields:

- **rotatable**: `"true"` or `"false"`; whether the tile can rotate.
- **isUnique**: `"true"` or `"false"`; optional, defaults to `false`.
- **isHalfTrinket**: `"true"` or `"false"`; optional, defaults to `false` and is only meaningful for `category=trinket`.
- **weaponCapBonus**: optional integer; if present, it becomes `modifiers.weaponCapBonus` on the item.

You can check that `data/items.json` is up to date with:

```bash
npm run check:data
```

This command exits with a non-zero status if the generated JSON differs from the committed file, which is useful for CI.
