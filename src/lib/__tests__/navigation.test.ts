import { describe, expect, it, jest } from "@jest/globals";
import { goBackOr } from "../navigation";

function router(canGoBack: boolean) {
  return {
    canGoBack: () => canGoBack,
    back: jest.fn(),
    replace: jest.fn(),
  };
}

describe("goBackOr", () => {
  it("goes back when there is history", () => {
    const r = router(true);
    goBackOr(r, "/add");
    expect(r.back).toHaveBeenCalledTimes(1);
    expect(r.replace).not.toHaveBeenCalled();
  });

  it("replaces with the fallback when there is nothing to go back to", () => {
    const r = router(false);
    goBackOr(r, "/add");
    expect(r.back).not.toHaveBeenCalled();
    expect(r.replace).toHaveBeenCalledWith("/add");
  });

  it("never leaves the control doing nothing", () => {
    for (const canGoBack of [true, false]) {
      const r = router(canGoBack);
      goBackOr(r, "/");
      const moved = r.back.mock.calls.length + r.replace.mock.calls.length;
      expect(moved).toBe(1);
    }
  });
});
