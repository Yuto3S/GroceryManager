import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import {
  feedbackForIncrement,
  feedbackForNewItem,
  feedbackForRejected,
  feedbackForUnresolved,
  hapticsAvailable,
} from "../feedback";

const notify = jest.mocked(Haptics.notificationAsync);
const select = jest.mocked(Haptics.selectionAsync);

beforeEach(() => {
  notify.mockReset();
  notify.mockResolvedValue(undefined);
  select.mockReset();
  select.mockResolvedValue(undefined);
});

describe("on a device", () => {
  it("distinguishes the three scan outcomes", () => {
    feedbackForNewItem();
    feedbackForIncrement();
    feedbackForUnresolved();

    // A new item and an unresolved one are both notifications, but not the
    // same one — the point is that they can be told apart without looking.
    expect(notify.mock.calls.map(([type]) => type)).toEqual([
      Haptics.NotificationFeedbackType.Success,
      Haptics.NotificationFeedbackType.Warning,
    ]);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("uses a distinct signal for something that was not a barcode", () => {
    feedbackForRejected();
    expect(notify).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
  });

  it("does not throw when the device declines to buzz", () => {
    notify.mockRejectedValue(new Error("no haptics"));
    expect(() => feedbackForNewItem()).not.toThrow();
  });

  it("returns without waiting", () => {
    // The scan path must not await feedback about a scan already recorded.
    expect(feedbackForNewItem()).toBeUndefined();
  });
});

describe("on a platform without haptics", () => {
  it("reports them unavailable", () => {
    jest.replaceProperty(Platform, "OS", "web");
    expect(hapticsAvailable()).toBe(false);
  });

  it("does not call into the native module at all", () => {
    // Guarded by platform rather than by catching an error whose cause nobody
    // would remember. Feedback is an enhancement; its absence is not a failure.
    jest.replaceProperty(Platform, "OS", "web");

    feedbackForNewItem();
    feedbackForIncrement();
    feedbackForUnresolved();
    feedbackForRejected();

    expect(notify).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it("still does not throw", () => {
    jest.replaceProperty(Platform, "OS", "web");
    expect(() => feedbackForNewItem()).not.toThrow();
  });
});
