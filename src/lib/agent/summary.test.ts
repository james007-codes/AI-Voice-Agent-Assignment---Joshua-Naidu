import { describe, expect, it } from "vitest";
import { fallbackSummary } from "./summary";

const base = { callId: "c1", startedAt: 0, endedAt: 60_000 };

describe("fallbackSummary", () => {
  it("handles a call where the customer never spoke", () => {
    const s = fallbackSummary({ ...base, transcript: [{ role: "agent", text: "Hi", at: 1 }], toolLog: [] });
    expect(s.customer_intent).toBe("NO_INTERACTION");
    expect(s.resolution_status).toBe("UNRESOLVED");
  });

  it("derives a policy-declined cancellation from the tool log", () => {
    const s = fallbackSummary({
      ...base,
      transcript: [{ role: "customer", text: "cancel ORD-101", at: 1 }],
      toolLog: [
        {
          name: "cancel_order",
          args: { order_id: "ORD-101" },
          result: { status: "CANCELLATION_NOT_ALLOWED", order_id: "ORD-101", reason: "Already out for delivery." },
          at: 2,
        },
      ],
    });
    expect(s).toMatchObject({ customer_intent: "CANCELLATION_REQUEST", resolution_status: "POLICY_DECLINED", order_id: "ORD-101" });
    expect(s.call_summary).toContain("declined");
  });

  it("summarises an order lookup in plain words", () => {
    const s = fallbackSummary({
      ...base,
      transcript: [{ role: "customer", text: "where is ORD-101", at: 1 }],
      toolLog: [
        {
          name: "get_order_details",
          args: { order_id: "ORD-101" },
          result: { status: "FOUND", order: { order_id: "ORD-101", status: "Out for Delivery", expected_delivery: "today by 6 PM" } },
          at: 2,
        },
      ],
    });
    expect(s.call_summary).toBe("Customer asked about ORD-101, which is Out for Delivery, expected today by 6 PM.");
    expect(s.resolution_status).toBe("RESOLVED");
  });
});
