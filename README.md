# Grocery Scanner 🛒

A small React Native (Expo) app: **scan a product barcode → look it up on
[Open Food Facts](https://world.openfoodfacts.org) → add it to your grocery
list** and check items off as you buy them.

Built as a starting point — the code is clean and commented so you can keep
building it with Claude Code.

## What it does today

- **Scan tab** — opens the camera, reads EAN/UPC barcodes (and GS1 Digital
  Link QR codes), and shows the product name, brand, image, and Nutri-Score.
  You can add it to your list or mark it as already bought.
- **List tab** — add items by hand, tap the checkbox to mark them bought, and
  see a separate "Bought" section. Swipe-free: use the ✕ to remove.
- **Offline-friendly** — your list and every product you've scanned before are
  saved on the device, so the app works offline. The *only* thing that needs
  internet is looking up a brand-new product you've never scanned.

## Running it (the fast way, on your own phone)

You don't need Xcode or Android Studio to try it.

1. Install **Node.js 22.13+** if you don't have it. React Native 0.86 would
   accept `^20.19.4` too, but the pinned `pnpm@11.22.0` requires `>=22.13`, so
   22.13 is the real floor for this project. CI runs exactly that version.
2. In this folder, install dependencies with **pnpm** — this project pins
   `pnpm@11.22.0` and the lockfile is authoritative:
   ```bash
   pnpm install --frozen-lockfile
   ```
3. Start the dev server:
   ```bash
   pnpm exec expo start
   ```
4. On your phone, install **Expo Go** (App Store / Play Store), open it, and
   scan the QR code shown in your terminal. The app loads live on your phone —
   fittingly, by scanning a QR code. 😄

> Tip: if any package version looks mismatched, run `npx expo install --check`
> to see what Expo expects, then `npx expo install --fix` to apply it.

## Project layout

```
App.tsx                    Two-tab shell (Scan / List) + state provider
app.json                   Expo config + camera permission text
tsconfig.json              Extends expo/tsconfig.base, strict mode on
src/
  api/openFoodFacts.ts     The product-lookup API call
  state/GroceryStore.tsx   App state + AsyncStorage persistence + product cache
  screens/ScanScreen.tsx   Camera + barcode scanning + result card
  screens/ListScreen.tsx   The grocery list UI
  types.ts                 Shared domain types (Product, GroceryItem, …)
  theme.ts                 Colours / Nutri-Score palette
```

The project is **TypeScript throughout**, in `strict` mode. Three checks run in
CI and you can run all of them at once with `pnpm run check`:

| Command | What it catches |
|---|---|
| `pnpm run typecheck` | Type errors (`tsc --noEmit`) |
| `pnpm run lint` | Style, formatting, import order (Biome) |
| `pnpm run check:no-js` | A `.js` file sneaking back in |

Biome and `tsc` do genuinely different jobs — Biome has no type information, so
it will happily accept a type error. You need both.

## Where the product data comes from

Open Food Facts is a free, open, community-run database with strong coverage
of German groceries (Rewe, Edeka, Aldi, Lidl, etc.). No API key needed.
Endpoint used:

```
GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json
```

If a barcode isn't found, the app tells you and you can still add the item by
hand. If you want to contribute missing products, Open Food Facts lets anyone
add them via their app.

## Building on it with Claude Code

Changes here run through **OpenSpec**, a spec-driven workflow: you describe the
idea, Claude writes a proposal (`proposal.md`, `design.md`, `tasks.md` and a
spec delta) under `openspec/`, and only then implements it. The point is to
agree on *what* gets built before any code appears.

```bash
npm install -g @fission-ai/openspec@1.10.0 --ignore-scripts   # one-time, global
```

Then, in Claude Code: `/opsx:propose "quantities per item"` → `/opsx:apply` →
`/opsx:archive`. Use `/opsx:explore` first if the idea is still fuzzy. The
skills and slash commands are generated into `.claude/` and are committed, so
they work as soon as you clone — only the CLI itself needs installing.

## Ideas for next versions (good tasks for Claude Code)

- Quantities per item ("2 × milk") and a running total.
- Categories / aisles so the list groups the way a store is laid out.
- Editing an item's name, and re-ordering.
- A history view of everything bought, with dates.
- Sync across devices (would need a small backend — e.g. Supabase).
- Show more nutrition detail (ingredients, allergens, additives) from the API.
