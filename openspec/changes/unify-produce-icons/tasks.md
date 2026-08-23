## 1. Choose the family

- [ ] 1.1 Survey candidate icon families against **our 103 keys**, not against a
      general impression of coverage. For each candidate record: how many of the
      103 it covers by name, its licence, its format, its per-icon weight, and
      whether every icon shares a palette and stroke treatment. Verify by
      matching against the key list in `src/data/produce.ts`, not by eye
- [ ] 1.2 Rasterise a sample of ~12 from each shortlisted family — deliberately
      including the hard cases: three leafy herbs, two root vegetables, one
      citrus — and build a contact sheet per family. Verify each reads at 34pt
      by viewing the sheet at tile size, not at full size
- [ ] 1.3 **Decision point, bring to the user:** name the chosen family, its
      coverage of the 103, and the exact items it does not cover. If no family
      clears the bar, say so rather than assembling a mixture — that is a
      finding, and the fallback (draw / substitute / cut) is the user's call
- [ ] 1.4 Record the decision and its rationale in `design.md`, replacing the
      open question, and verify `openspec validate unify-produce-icons --strict`
      still passes

## 2. Fill the gap

- [ ] 2.1 List every item the chosen family does not cover, and agree a
      resolution per item — drawn in the family's style, an honest substitute,
      or removed from the produce list. Verify no item is left unresolved before
      any asset work starts
- [ ] 2.2 Produce artwork for each gap item in the chosen style, and verify each
      against the family's own icons on a shared contact sheet — a gap-fill that
      is recognisably a gap-fill has not met the bar
- [ ] 2.3 For any item removed from the produce list, record why in
      `src/data/produce.ts`'s header and verify the data tests still pass with
      the reduced count

## 3. Process the assets

- [ ] 3.1 Normalise every icon to one canvas size with consistent optical
      padding, so a tall narrow item and a short wide item carry the same
      visual weight; verify on a contact sheet of all 103 rather than per file
- [ ] 3.2 Confirm every asset has a transparent background, and verify by
      rendering the sheet over a non-white colour — a white-boxed icon is
      invisible against a white page and obvious against anything else
- [ ] 3.3 Rasterise at the size settled in design (128px unless the survey
      changed the format) and verify no source is smaller than the 102 physical
      pixels a 34pt tile needs on a 3× screen
- [ ] 3.4 Replace `assets/produce/` wholesale and verify every filename matches
      a key in `src/data/produce.ts` exactly

## 4. Wire it up

- [ ] 4.1 Regenerate `src/data/produceIcons.ts` covering all 103 with **literal**
      `require` strings, and verify `pnpm run typecheck` passes
- [ ] 4.2 Record per-asset provenance — source, licence, date obtained —
      alongside the map, and verify a spot-checked icon can be traced from the
      repository alone
- [ ] 4.3 Verify with a test that every produce key has an entry in
      `PRODUCE_ICONS`, failing with the offending key named
- [ ] 4.4 Verify with a test that every entry in `PRODUCE_ICONS` matches a live
      produce key, so a removed item cannot leave its artwork in the bundle

## 5. Retire the fallback

- [ ] 5.1 Only once tasks 4.3 and 4.4 pass: remove the `emoji` field from
      `ProduceItem` and from every row, and verify `pnpm run typecheck` passes
- [ ] 5.2 Remove the fallback branch from `src/components/ProduceIcon.tsx` so
      the component has one path, and verify no test still asserts an item
      renders emoji
- [ ] 5.3 Update the produce-picker tests that referenced the stopgap — the
      "falls back to emoji" case is no longer meaningful — and verify the suite
      passes with no test silently deleted rather than replaced

## 6. Check the result

- [ ] 6.1 Build a contact sheet of all 103 final icons and verify by eye that
      the set reads as one: shared palette, consistent outline treatment, no
      icon noticeably heavier or lighter than its neighbours
- [ ] 6.2 Verify the ten herbs are distinguishable from each other at tile size
      — the specific failure this change exists to fix
- [ ] 6.3 Measure `assets/produce` and record the figure in `proposal.md`; a
      material overrun on the ~1.1 MB projection is a finding to raise, not a
      number to quietly update
- [ ] 6.4 Run the picker and verify against the real grid on a device or
      simulator, since tile size and screen density are what this is judged at
- [ ] 6.5 Run `pnpm test` and `pnpm run check` and verify both pass clean

## 7. Documentation

- [ ] 7.1 Update `AGENTS.md` with where produce artwork lives, the completeness
      contract, and the literal-`require` constraint
- [ ] 7.2 Add the icon set to `SECURITY.md`'s vendored-data notes: licence,
      provenance, and that it is never fetched at runtime, install time or CI
- [ ] 7.3 Verify `openspec validate unify-produce-icons --strict` passes before
      archiving
