// Getting a backup out of the app and back into it.
//
// The only impure part of this feature, and the one place that knows about a
// platform. There is no shared mechanism for "hand the user a file" across iOS
// and web, so there is no abstraction here that pretends otherwise — one
// `Platform.OS` fork, with both paths in view of each other.
//
// Everything above this module deals in strings, which is what lets the whole
// of `backup.ts` be tested with no native mocks at all.

import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

/** What `readBackupFile` came back with. */
export type ReadResult =
  | { kind: "read"; text: string; name: string }
  | { kind: "cancelled" }
  | { kind: "unreadable"; message: string };

/** What `writeBackupFile` came back with. */
export type WriteResult =
  | { kind: "delivered" }
  | { kind: "cancelled" }
  | { kind: "failed"; message: string };

const MIME_TYPE = "application/json";

/**
 * Whether export can be offered at all.
 *
 * Web always can — a Blob download needs nothing. Native depends on the share
 * sheet being available, and where it is not, the control is hidden rather than
 * shown doing nothing. Same principle as the web scanning gate.
 */
export async function canExport(): Promise<boolean> {
  if (Platform.OS === "web") return typeof document !== "undefined";
  try {
    return await Sharing.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Hand the backup to the user so it comes to rest outside the app.
 *
 * On native this means writing a real file first, because the share sheet needs
 * a URI. It goes in the cache directory rather than the document directory: the
 * OS may reclaim it, which is right, since the copy that matters is the one the
 * user saved from the share sheet. A backup accumulating inside app storage
 * would be a backup that dies with the app.
 */
export async function writeBackupFile(
  json: string,
  filename: string,
): Promise<WriteResult> {
  try {
    if (Platform.OS === "web") {
      downloadInBrowser(json, filename);
      return { kind: "delivered" };
    }

    const file = new File(Paths.cache, filename);
    file.create({ overwrite: true });
    file.write(json);

    await Sharing.shareAsync(file.uri, {
      mimeType: MIME_TYPE,
      UTI: "public.json",
      dialogTitle: "Save your pantry backup",
    });
    return { kind: "delivered" };
  } catch (e) {
    return { kind: "failed", message: describe(e) };
  }
}

/**
 * The web download.
 *
 * The object URL is revoked on the next tick rather than immediately: revoking
 * synchronously after `click()` races the browser's own read of the blob in
 * some engines, and the leak from not revoking at all is a real one.
 */
function downloadInBrowser(json: string, filename: string): void {
  const blob = new Blob([json], { type: MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Ask the user for a backup file and read its text.
 *
 * `expo-document-picker` is the one API here that behaves the same on both
 * platforms — on web it is an `<input type="file">`, on native the system
 * picker — which is why it is used rather than `File.pickFileAsync`, whose web
 * build is a stub that warns and resolves to nothing.
 *
 * The MIME filter is a convenience, not a guarantee: a file picked despite it
 * still reaches `parseBackup`, which is where the actual checking happens.
 */
export async function readBackupFile(): Promise<ReadResult> {
  try {
    const picked = await DocumentPicker.getDocumentAsync({
      type: [MIME_TYPE, "text/plain", "*/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (picked.canceled) return { kind: "cancelled" };

    const asset = picked.assets[0];
    if (!asset) return { kind: "cancelled" };

    const text = await readAsset(asset);
    return { kind: "read", text, name: asset.name };
  } catch (e) {
    return { kind: "unreadable", message: describe(e) };
  }
}

async function readAsset(
  asset: DocumentPicker.DocumentPickerAsset,
): Promise<string> {
  // On web the picker hands back the browser's own File object, which reads
  // directly. Its `uri` may be a data: URL, so this is also the cheaper path.
  if (asset.file) return await asset.file.text();
  if (Platform.OS === "web") return await (await fetch(asset.uri)).text();
  return await new File(asset.uri).text();
}

/** Never surface a raw thrown value; it may not be an Error. */
function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
