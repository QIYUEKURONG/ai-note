import { describe, expect, it } from "vitest";
import { defaultPinForIndex, layoutToPin, pinToLayout } from "./pins";

describe("pins", () => {
  it("cycles default edges", () => {
    expect(defaultPinForIndex(0).edge).toBe("right");
    expect(defaultPinForIndex(1).edge).toBe("left");
    expect(defaultPinForIndex(2).edge).toBe("top");
  });

  it("keeps relative coordinates when converting from layout", () => {
    const pin = defaultPinForIndex(0);
    const layout = pinToLayout(pin, 720, 900);
    const roundTrip = layoutToPin(layout.left, layout.top, 720, 900, pin.scale, pin.zIndex);
    expect(roundTrip.edge).toBe("right");
    expect(roundTrip.t).toBeGreaterThan(0.1);
    expect(roundTrip.t).toBeLessThan(0.9);
  });
});
