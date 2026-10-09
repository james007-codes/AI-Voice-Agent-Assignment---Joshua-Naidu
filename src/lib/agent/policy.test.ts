import { describe, expect, it } from "vitest";
import { AURA_SKINCARE } from "./brand";
import { buildSampleOrders } from "./orders/mock-repository";
import { evaluateCancellation, evaluateReturn, isCodEligible, shippingFee } from "./policy";

const P = AURA_SKINCARE.policies;
const NOW = Date.UTC(2026, 9, 9, 6, 0); // 11:30 IST
const [ord101, ord102, ord103] = buildSampleOrders(NOW);

describe("returns", () => {
  it("declines the brief's example: 20 days, opened, no order id", () => {
    const d = evaluateReturn(P, { issueType: "change_of_mind", productOpened: true, daysSinceDelivery: 20 }, null, NOW);
    expect(d.verdict).toBe("NOT_ELIGIBLE");
  });

  it("declines ORD-102 (delivered 14 days ago) even if unopened", () => {
    const d = evaluateReturn(P, { issueType: "change_of_mind", productOpened: false }, ord102, NOW);
    expect(d.verdict).toBe("NOT_ELIGIBLE");
    expect(d.reason).toMatch(/7 days/);
  });

  it("asks whether the product is opened when inside the window", () => {
    const d = evaluateReturn(P, { issueType: "change_of_mind", daysSinceDelivery: 3 }, null, NOW);
    expect(d.verdict).toBe("NEEDS_MORE_INFO");
    expect(d.missing).toContain("product_opened");
  });

  it("accepts an unopened return inside 7 days", () => {
    const d = evaluateReturn(P, { issueType: "change_of_mind", productOpened: false, daysSinceDelivery: 5 }, null, NOW);
    expect(d.verdict).toBe("RETURN_ELIGIBLE");
  });

  it("declines an opened return inside 7 days", () => {
    const d = evaluateReturn(P, { issueType: "change_of_mind", productOpened: true, daysSinceDelivery: 2 }, null, NOW);
    expect(d.verdict).toBe("NOT_ELIGIBLE");
  });

  it("offers replacement for damage reported within 48h", () => {
    const d = evaluateReturn(P, { issueType: "damaged", daysSinceDelivery: 1 }, null, NOW);
    expect(d.verdict).toBe("REPLACEMENT_ELIGIBLE");
    expect(d.nextSteps).toMatch(/photos/);
  });

  it("declines damage reported after 48h but allows escalation", () => {
    const d = evaluateReturn(P, { issueType: "damaged" }, ord102, NOW);
    expect(d.verdict).toBe("NOT_ELIGIBLE");
    expect(d.mayOfferEscalation).toBe(true);
  });

  it("treats undelivered orders as not returnable yet", () => {
    expect(evaluateReturn(P, { issueType: "change_of_mind" }, ord101, NOW).verdict).toBe("NOT_YET_DELIVERED");
    expect(evaluateReturn(P, { issueType: "change_of_mind" }, ord103, NOW).nextSteps).toMatch(/cancelled/);
  });

  it("needs a timeframe when there is no order", () => {
    expect(evaluateReturn(P, { issueType: "change_of_mind" }, null, NOW).verdict).toBe("NEEDS_MORE_INFO");
  });
});

describe("cancellation", () => {
  it("allows Processing", () => expect(evaluateCancellation(P, ord103).allowed).toBe(true));
  it("blocks Out for Delivery and suggests refusing at doorstep", () => {
    const d = evaluateCancellation(P, ord101);
    expect(d.allowed).toBe(false);
    expect(d.alternative).toMatch(/doorstep/);
  });
  it("blocks Delivered and points to returns", () => {
    expect(evaluateCancellation(P, ord102).alternative).toMatch(/return/i);
  });
});

describe("shipping and COD", () => {
  it("charges ₹50 below ₹499 and nothing from ₹499", () => {
    expect(shippingFee(P, 498)).toBe(50);
    expect(shippingFee(P, 499)).toBe(0);
    expect(shippingFee(P, 699)).toBe(0);
  });
  it("allows COD up to ₹2,500", () => {
    expect(isCodEligible(P, 2500)).toBe(true);
    expect(isCodEligible(P, 2501)).toBe(false);
  });
});
