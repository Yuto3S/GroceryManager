// Backup and restore.
//
// The screen is deliberately dull: two buttons and a lot of numbers. The
// numbers are the feature. Import replaces the pantry outright, so the only
// thing standing between a user and losing an evening's scanning is that they
// read what is about to happen — and people read counts about their own data in
// a way they do not read "Are you sure?".

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  type BackupRejection,
  backupFilename,
  buildBackup,
  type ImportReport,
  type ParsedBackup,
  parseBackup,
  repairBackup,
} from "../lib/backup";
import { canExport, readBackupFile, writeBackupFile } from "../lib/backupFile";
import { isVisible } from "../lib/pantry";
import { usePantry } from "../state/PantryStore";
import { colors } from "../theme";

interface BackupScreenProps {
  onDone: () => void;
}

/** A validated backup waiting for the user to confirm replacing their pantry. */
interface Pending {
  parsed: ParsedBackup;
  filename: string;
}

export default function BackupScreen({ onDone }: BackupScreenProps) {
  const {
    entries,
    catalogue,
    locations,
    restoreBackup,
    makeSeedLocations,
    loaded,
  } = usePantry();

  const [exportable, setExportable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  // Availability is asynchronous on native, so it is read as a fallback rather
  // than assumed: `null` means "not known yet" and hides the control, which is
  // the safe direction — a button that does nothing is worse than a late one.
  useEffect(() => {
    let live = true;
    canExport().then((can) => {
      if (live) setExportable(can);
    });
    return () => {
      live = false;
    };
  }, []);

  const counts = useMemo(
    () => ({
      entries: Object.values(entries).filter(isVisible).length,
      catalogue: Object.keys(catalogue).length,
      locations: locations.length,
    }),
    [entries, catalogue, locations],
  );

  const handleExport = useCallback(async () => {
    setBusy(true);
    setProblem(null);
    try {
      const now = Date.now();
      const backup = buildBackup(
        {
          entries,
          catalogue,
          // The store hands out locations as a filtered list; a backup needs
          // the tombstones too, so they are rebuilt into a map here.
          locations: Object.fromEntries(locations.map((l) => [l.id, l])),
        },
        now,
      );
      const result = await writeBackupFile(
        JSON.stringify(backup),
        backupFilename(now),
      );
      if (result.kind === "failed") setProblem(result.message);
    } finally {
      setBusy(false);
    }
  }, [entries, catalogue, locations]);

  const handleChoose = useCallback(async () => {
    setBusy(true);
    setProblem(null);
    setReport(null);
    try {
      const file = await readBackupFile();
      if (file.kind === "cancelled") return;
      if (file.kind === "unreadable") {
        setProblem(`That file could not be read: ${file.message}`);
        return;
      }

      const parsed = parseBackup(file.text);
      if (!parsed.ok) {
        setProblem(explain(parsed.reason, file.name));
        return;
      }
      setPending({ parsed, filename: file.name });
    } finally {
      setBusy(false);
    }
  }, []);

  const handleConfirm = useCallback(() => {
    if (!pending) return;
    const { contents, report: made } = repairBackup(
      pending.parsed,
      makeSeedLocations(),
    );
    restoreBackup(contents);
    setPending(null);
    setReport(made);
  }, [pending, makeSeedLocations, restoreBackup]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.label}>What is stored now</Text>
      <View style={styles.card}>
        <Text style={styles.body} accessibilityLabel="Current pantry contents">
          {counts.entries} {plural(counts.entries, "item")} in the pantry,{" "}
          {counts.catalogue} {plural(counts.catalogue, "product")} in the
          catalogue, {counts.locations} {plural(counts.locations, "place")}.
        </Text>
      </View>

      <Text style={styles.label}>Back up</Text>
      <View style={styles.card}>
        <Text style={styles.body}>
          Saves everything above to a file you keep. Nothing is sent anywhere.
        </Text>
        {exportable === false ? (
          <Text style={styles.hint}>
            This device has no way to save or send a file, so there is nothing
            to offer here. Export from the phone app instead.
          </Text>
        ) : exportable === true ? (
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.button, busy && styles.buttonOff]}
            disabled={busy}
            onPress={handleExport}
          >
            <Text style={styles.buttonText}>Export a backup</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.label}>Restore</Text>
      <View style={styles.card}>
        <Text style={styles.body}>
          Replaces everything above with the contents of a backup file. It does
          not merge.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.outline, busy && styles.buttonOff]}
          disabled={busy}
          onPress={handleChoose}
        >
          <Text style={styles.outlineText}>Choose a backup file…</Text>
        </TouchableOpacity>
      </View>

      {problem ? (
        <View style={[styles.card, styles.problem]}>
          <Text style={styles.problemText} accessibilityLabel="Import problem">
            {problem}
          </Text>
          <Text style={styles.hint}>Your pantry has not been changed.</Text>
        </View>
      ) : null}

      {pending ? (
        <View style={[styles.card, styles.confirm]}>
          <Text style={styles.confirmTitle}>Replace your pantry?</Text>
          <Text style={styles.body} accessibilityLabel="Backup summary">
            {pending.filename} was made{" "}
            {formatWhen(pending.parsed.backup.exportedAt)}. It holds{" "}
            {Object.keys(pending.parsed.backup.entries).length}{" "}
            {plural(Object.keys(pending.parsed.backup.entries).length, "entry")}{" "}
            and {Object.keys(pending.parsed.backup.catalogue).length}{" "}
            {plural(
              Object.keys(pending.parsed.backup.catalogue).length,
              "product",
            )}
            .
          </Text>
          <Text style={styles.warning} accessibilityLabel="What will be lost">
            Restoring will delete the {counts.entries}{" "}
            {plural(counts.entries, "item")} and {counts.catalogue}{" "}
            {plural(counts.catalogue, "product")} on this device.
          </Text>
          {pending.parsed.droppedMalformed > 0 ? (
            <Text style={styles.hint}>
              {pending.parsed.droppedMalformed}{" "}
              {plural(pending.parsed.droppedMalformed, "record")} in this file
              could not be read and will be skipped.
            </Text>
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.destructive}
            onPress={handleConfirm}
          >
            <Text style={styles.buttonText}>Replace everything</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.link}
            onPress={() => setPending(null)}
          >
            <Text style={styles.linkText}>Keep what I have</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {report ? (
        <View style={[styles.card, styles.done]}>
          <Text style={styles.confirmTitle}>Restored</Text>
          <Text style={styles.body} accessibilityLabel="Restore summary">
            {report.entries} {plural(report.entries, "entry")},{" "}
            {report.catalogue} {plural(report.catalogue, "product")} and{" "}
            {report.locations} {plural(report.locations, "place")}.
          </Text>
          {repairs(report).map((line) => (
            <Text key={line} style={styles.repair}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      {!loaded ? <Text style={styles.hint}>Still loading…</Text> : null}

      <TouchableOpacity
        accessibilityRole="button"
        style={styles.link}
        onPress={onDone}
      >
        <Text style={styles.linkText}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/**
 * Every repair, as a line of prose. An empty list means a clean import, which
 * is why the caller renders nothing rather than "0 repairs".
 */
function repairs(report: ImportReport): string[] {
  const lines: string[] = [];
  if (report.droppedMalformed > 0) {
    lines.push(
      `${report.droppedMalformed} ${plural(report.droppedMalformed, "record")} could not be read and ${was(report.droppedMalformed)} skipped.`,
    );
  }
  if (report.droppedMissingProduct > 0) {
    lines.push(
      `${report.droppedMissingProduct} ${plural(report.droppedMissingProduct, "entry")} had no matching product and ${was(report.droppedMissingProduct)} dropped.`,
    );
  }
  if (report.droppedNoLocation > 0) {
    lines.push(
      `${report.droppedNoLocation} ${plural(report.droppedNoLocation, "entry")} had nowhere to go and ${was(report.droppedNoLocation)} dropped.`,
    );
  }
  if (report.reassignedLocation > 0) {
    lines.push(
      `${report.reassignedLocation} ${plural(report.reassignedLocation, "entry")} moved to another place, because the original was missing.`,
    );
  }
  if (report.clearedExpiry > 0) {
    lines.push(
      `${report.clearedExpiry} expiry ${plural(report.clearedExpiry, "date")} could not be read and ${was(report.clearedExpiry)} cleared.`,
    );
  }
  if (report.seededLocations) {
    lines.push("The backup had no places, so the default ones were created.");
  }
  return lines;
}

function explain(reason: BackupRejection, filename: string): string {
  switch (reason.kind) {
    case "not-json":
      return `${filename} is not a backup file — it could not be read as JSON. If it came from a transfer, it may have been cut short.`;
    case "not-a-backup":
      return `${filename} is a JSON file, but not a pantry backup.`;
    case "future-version":
      return `${filename} was made by a newer version of the app (format ${reason.version}; this version understands ${reason.supported}). Update the app, or use an older backup.`;
    default: {
      const _exhaustive: never = reason;
      return "That file could not be used.";
    }
  }
}

/**
 * How old the backup is, in the user's own local time. Age is the fact most
 * likely to change their mind, so it goes in front of them at the moment of
 * deciding rather than in a detail view.
 */
function formatWhen(exportedAt: number): string {
  const then = new Date(exportedAt);
  const date = then.toLocaleDateString();
  const days = calendarDaysBetween(then, new Date());
  if (days <= 0) return `today (${date})`;
  if (days === 1) return `yesterday (${date})`;
  return `${days} days ago (${date})`;
}

/** Whole calendar days apart, counted rather than divided out of a difference. */
function calendarDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function plural(n: number, word: string): string {
  if (n === 1) return word;
  return word === "entry" ? "entries" : `${word}s`;
}

const was = (n: number) => (n === 1 ? "was" : "were");

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 8, paddingBottom: 40 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.subtle,
    textTransform: "uppercase",
    marginTop: 14,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  hint: { color: colors.subtle, fontSize: 13, lineHeight: 19 },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  buttonOff: { opacity: 0.4 },
  buttonText: { color: colors.primaryText, fontWeight: "800" },
  outline: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  outlineText: { color: colors.primary, fontWeight: "800" },
  problem: { borderColor: colors.danger },
  problemText: { color: colors.danger, fontSize: 15, lineHeight: 21 },
  confirm: { borderColor: colors.danger, borderWidth: 2 },
  confirmTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  warning: { color: colors.danger, fontWeight: "700", lineHeight: 21 },
  destructive: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.danger,
  },
  done: { borderColor: colors.primary },
  repair: { color: colors.subtle, fontSize: 13, lineHeight: 19 },
  link: { paddingVertical: 12, alignItems: "center" },
  linkText: { color: colors.subtle, fontWeight: "600" },
});
