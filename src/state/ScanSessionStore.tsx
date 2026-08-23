// The live scan session: the part that talks to storage and the clock.
//
// All the rules live in `scanSession.ts`, which is pure. What is here is the
// clock, the id generator, and writing to the device on every mutation — the
// session is a small array, so writing it per scan costs almost nothing and a
// crash does not wait for a flush interval. Bootstrapping is the highest-risk
// moment in this app's life; losing forty scans to a crash would be a
// particularly bad way to fail.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Product } from "../types";
import {
  newSession,
  parseSession,
  type ScanOutcome,
  type ScanSession,
  type ScanSessionItem,
  type SessionAction,
  scan,
  sessionReducer,
} from "./scanSession";

const SESSION_KEY = "@pantry/scanSession/v1";

type ItemPatch = Partial<
  Pick<ScanSessionItem, "count" | "name" | "locationId" | "unit" | "step">
>;

interface ScanSessionContextValue {
  loaded: boolean;
  /** The session being scanned into, if one is running. */
  session: ScanSession | null;
  /**
   * A session found on the device that the user has not yet chosen to resume or
   * discard. Kept separate from `session` so a stale one is never silently
   * revived — the user would otherwise confirm forty items believing they had
   * just scanned them.
   */
  pending: ScanSession | null;
  /**
   * Whatever scanning is unfinished, however it got that way: a session found
   * on the device at startup, or one the user paused this session and walked
   * away from.
   *
   * `pending` alone was not enough. Leaving rapid mode keeps the session live
   * in memory rather than turning it into a pending one, so the offer to resume
   * appeared only after a reload — the one moment the user had not asked for
   * it. This is what the add hub should read.
   */
  unfinished: ScanSession | null;

  startSession: (locationId: string) => void;
  resumePending: () => void;
  discardPending: () => void;
  endSession: () => void;

  /** Synchronous by design: the scan path must never wait on anything. */
  recordScan: (barcode: string) => ScanOutcome;
  resolveItem: (barcode: string, product: Product) => void;
  setSessionLocation: (locationId: string) => void;
  decrementItem: (barcode: string) => void;
  dropItem: (barcode: string) => void;
  patchItem: (barcode: string, patch: ItemPatch) => void;
}

const ScanSessionContext = createContext<ScanSessionContextValue | null>(null);

export function ScanSessionProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<ScanSession | null>(null);
  const [pending, setPending] = useState<ScanSession | null>(null);

  // The scan path reads the session from a ref rather than from state, so it can
  // compute the outcome and the next session in one synchronous pass. Going
  // through a reducer would mean the caller could not know whether a scan was a
  // new item, an increment or a camera repeat — and that is exactly what the
  // haptic has to say.
  const sessionRef = useRef<ScanSession | null>(null);

  const commit = useCallback((next: ScanSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const apply = useCallback(
    (action: SessionAction) => {
      commit(sessionReducer(sessionRef.current, action));
    },
    [commit],
  );

  // Load any unfinished session once on startup.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        const parsed = raw === null ? null : parseSession(safeParse(raw));
        // Held as pending, not active: the user decides whether it is still
        // theirs. An empty one is not worth asking about.
        if (parsed && parsed.items.length > 0) setPending(parsed);
      } catch (e) {
        console.warn("Failed to load the scan session", e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Persist on every change, once the first load has happened — writing before
  // then would overwrite the device's session with an empty one.
  //
  // A session with nothing in it is stored as nothing at all. There is no work
  // to protect from a crash, and it keeps "the session is cleared on
  // confirmation" literally true rather than true-enough: starting a fresh
  // session after confirming would otherwise leave an empty one behind.
  useEffect(() => {
    if (!loaded) return;
    const write =
      session === null || session.items.length === 0
        ? AsyncStorage.removeItem(SESSION_KEY)
        : AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    write.catch((e) => console.warn("Failed to save the scan session", e));
  }, [session, loaded]);

  // A live session with nothing scanned into it is not unfinished work; it is
  // an empty one nobody would miss.
  const unfinished =
    pending ?? (session && session.items.length > 0 ? session : null);

  const startSession = useCallback(
    (locationId: string) => {
      setPending(null);
      commit(newSession(randomUUID(), locationId, Date.now()));
    },
    [commit],
  );

  const resumePending = useCallback(() => {
    if (pending) commit(pending);
    setPending(null);
  }, [pending, commit]);

  const discardPending = useCallback(() => {
    setPending(null);
    commit(null);
  }, [commit]);

  const endSession = useCallback(() => {
    commit(null);
  }, [commit]);

  const recordScan = useCallback(
    (barcode: string): ScanOutcome => {
      const current = sessionRef.current;
      if (current === null) return "no-session";

      const { session: next, outcome } = scan(current, barcode, Date.now());
      // An ignored camera repeat returns the same object, so there is nothing
      // to write and nothing to re-render.
      if (next !== current) commit(next);
      return outcome;
    },
    [commit],
  );

  const resolveItem = useCallback(
    (barcode: string, product: Product) => {
      apply({ type: "RESOLVE", barcode, product });
    },
    [apply],
  );

  const setSessionLocation = useCallback(
    (locationId: string) => {
      apply({ type: "SET_SESSION_LOCATION", locationId });
    },
    [apply],
  );

  const decrementItem = useCallback(
    (barcode: string) => {
      apply({ type: "DECREMENT_ITEM", barcode });
    },
    [apply],
  );

  const dropItem = useCallback(
    (barcode: string) => {
      apply({ type: "DROP_ITEM", barcode });
    },
    [apply],
  );

  const patchItem = useCallback(
    (barcode: string, patch: ItemPatch) => {
      apply({ type: "PATCH_ITEM", barcode, patch });
    },
    [apply],
  );

  const value: ScanSessionContextValue = {
    loaded,
    session,
    pending,
    unfinished,
    startSession,
    resumePending,
    discardPending,
    endSession,
    recordScan,
    resolveItem,
    setSessionLocation,
    decrementItem,
    dropItem,
    patchItem,
  };

  return (
    <ScanSessionContext.Provider value={value}>
      {children}
    </ScanSessionContext.Provider>
  );
}

/** A corrupt session file is not a reason to refuse to start. */
function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function useScanSession(): ScanSessionContextValue {
  const ctx = useContext(ScanSessionContext);
  if (!ctx) {
    throw new Error(
      "useScanSession must be used inside a <ScanSessionProvider>",
    );
  }
  return ctx;
}
