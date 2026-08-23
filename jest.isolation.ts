// What each test is guaranteed to start from.
//
// Separate from `jest.setup.ts` because that file runs in `setupFiles`, before
// the test framework exists — `beforeEach` is not defined there. Hooks have to
// live in `setupFilesAfterEnv`, which runs once the framework is installed.
//
// Everything reset here is state that outlives a single test: the in-memory
// AsyncStorage, and the id counter behind the `expo-crypto` mock. A test that
// inherits either one passes or fails for reasons belonging to whatever ran
// before it. `pnpm run test:isolation` shuffles the order specifically to catch
// that, so any coupling shows up as a failure rather than as a mystery later.
//
// Doing it globally rather than per file is the point: a new test file gets
// isolation by existing, not by its author remembering.

import { beforeEach } from "@jest/globals";

beforeEach(async () => {
  // The shipped AsyncStorage mock is a CommonJS export, so it arrives as the
  // module itself under Babel's interop rather than nested under `.default`.
  // Both shapes are accepted: which one shows up depends on interop settings
  // that are not this file's business, and getting it wrong fails every test
  // in the run at once.
  const mod = require("@react-native-async-storage/async-storage") as {
    default?: { clear: () => Promise<void> };
    clear?: () => Promise<void>;
  };
  const storage = mod.default ?? mod;
  await storage.clear?.();

  (require("expo-crypto") as { __resetIds?: () => void }).__resetIds?.();
});
