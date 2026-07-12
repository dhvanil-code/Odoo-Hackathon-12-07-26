import { describe, it, expect } from "vitest";
import { assertTransition } from "@/modules/assets/lifecycle";
describe("asset lifecycle", () => {
  it("permits issue and accepted return", () => {
    expect(() => assertTransition("AVAILABLE", "ALLOCATED")).not.toThrow();
    expect(() => assertTransition("ALLOCATED", "AVAILABLE")).not.toThrow();
  });
  it("blocks disposed allocation", () =>
    expect(() => assertTransition("DISPOSED", "ALLOCATED")).toThrow(
      /cannot transition/,
    ));
  it("requires authorization to restore retired assets", () =>
    expect(() => assertTransition("RETIRED", "AVAILABLE")).toThrow(/requires/));
});
