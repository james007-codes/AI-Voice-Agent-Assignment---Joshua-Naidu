import { describe, expect, it } from "vitest";
import { normalizeOrderId } from "./order-id";

describe("normalizeOrderId", () => {
  it.each([
    ["ORD-101", "ORD-101"],
    ["ord 101", "ORD-101"],
    ["ORD101", "ORD-101"],
    ["order 101", "ORD-101"],
    ["101", "ORD-101"],
    ["one oh one", "ORD-101"],
    ["O R D one zero two", "ORD-102"],
    ["ORD one zero three", "ORD-103"],
    ["ek shunya teen", "ORD-103"],
    ["ORD-999", "ORD-999"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeOrderId(input)).toEqual({ ok: true, orderId: expected });
  });

  it("rejects empty and digit-less input", () => {
    expect(normalizeOrderId("")).toEqual({ ok: false, reason: "EMPTY" });
    expect(normalizeOrderId("my order")).toEqual({ ok: false, reason: "NO_DIGITS" });
  });
});
