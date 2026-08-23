// Telling the user a scan registered, without them having to read anything.
//
// The point is latency, not attention: a haptic fires instantly, while the
// visual acknowledgement animates in over a couple hundred milliseconds. It
// confirms the scan landed before the UI catches up, and distinguishes the
// three outcomes that matter while the camera is still live.
//
// Audio was considered and rejected — it needs a bundled asset, the iPhone
// silent switch kills it so it fails invisibly, and it is actively unwanted in
// a shop.
//
// Every call is guarded by platform rather than wrapped in a try/catch. Haptics
// are an enhancement; their absence is not a failure, and swallowing an error
// whose cause nobody will remember is a worse way to say so.

import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/** Whether this platform has haptics at all. Web does not. */
export function hapticsAvailable(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

/**
 * Fire and forget.
 *
 * Never awaited: the scan path must not wait on anything, least of all on
 * feedback about a scan that has already been recorded.
 */
function fire(run: () => Promise<void>): void {
  if (!hapticsAvailable()) return;
  run().catch(() => {
    // A device that declines to buzz is not an error worth surfacing.
  });
}

/** A new item joined the queue. */
export function feedbackForNewItem(): void {
  fire(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
}

/** A rescan increased an existing item's count. Lighter than a new item. */
export function feedbackForIncrement(): void {
  fire(() => Haptics.selectionAsync());
}

/** A barcode that could not be resolved. Still queued, but needs attention. */
export function feedbackForUnresolved(): void {
  fire(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  );
}

/** Something the scanner read that was not a product barcode at all. */
export function feedbackForRejected(): void {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
