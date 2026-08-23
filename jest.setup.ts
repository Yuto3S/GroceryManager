// Test environment stand-ins for the three native modules the app touches.
//
// None of them can run under Jest: AsyncStorage and expo-crypto need a device,
// and `CameraView` cannot mount at all. Mocking them here rather than in each
// test file keeps the mocks consistent and the tests about behaviour.

import { jest } from "@jest/globals";

// The shipped mock is an in-memory implementation, so a store test actually
// exercises the read-write round trip rather than asserting on call arguments.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Deterministic ids. Real UUIDs would make every assertion about "which entry"
// impossible to write, and uniqueness is all the code actually depends on.
jest.mock("expo-crypto", () => {
  let counter = 0;
  return {
    randomUUID: () => {
      counter += 1;
      return `uuid-${counter}`;
    },
  };
});

// A camera that renders nothing and hands the test a way to say "a barcode was
// seen". The real one needs a device; what the app depends on is the callback.
jest.mock("expo-camera", () => {
  const { View } = require("react-native");
  const React = require("react");

  return {
    CameraView: ({
      onBarcodeScanned,
      ...props
    }: {
      onBarcodeScanned?: (result: { data: string; type: string }) => void;
      [key: string]: unknown;
    }) =>
      React.createElement(View, {
        ...props,
        testID: "camera",
        // A test says "a barcode was seen" with
        //   fireEvent(getByTestId("camera"), "touchEnd", {
        //     nativeEvent: { data: "..." },
        //   })
        // and the decoded value rides along on the event.
        onTouchEnd: (event: { nativeEvent?: { data?: string } }) =>
          onBarcodeScanned?.({
            data: event?.nativeEvent?.data ?? "3017620422003",
            type: "ean13",
          }),
      }),
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
  };
});

// Haptics never fire under Jest; what the tests care about is *whether* they
// were asked to, and that a platform without them is not an error path.
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

// Keeping the screen awake is a native side effect with nothing to assert.
jest.mock("expo-keep-awake", () => ({
  useKeepAwake: () => {},
  activateKeepAwakeAsync: async () => {},
  deactivateKeepAwake: async () => {},
}));

// Safe-area insets need a provider, which the app supplies at the root but a
// test rendering one screen does not. The library ships a mock with fixed
// insets for exactly this — real numbers, so a component that lays out from
// them still gets sensible values rather than zeros.
// The shipped mock is a *default* export, so it arrives nested under `.default`
// through Babel's ESM interop — spreading the module itself gives a module
// object with no hooks on it, and `useSafeAreaInsets` is then not a function.
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
