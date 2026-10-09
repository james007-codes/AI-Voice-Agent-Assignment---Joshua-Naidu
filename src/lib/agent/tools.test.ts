import { describe, expect, it } from "vitest";
import { executeTool, toolDeclarations } from "./tools";

const call = (name: string, args: unknown) => executeTool(name, args, { callId: "test-call-id" });

describe("tools", () => {
  it("looks up ORD-101 from a spoken id", async () => {
    const r = await call("get_order_details", { order_id: "order one oh one" });
    expect(r.result.status).toBe("FOUND");
    expect((r.result.order as { courier: string }).courier).toBe("BlueDart");
  });

  it("returns ORDER_NOT_FOUND for unknown ids instead of throwing", async () => {
    const r = await call("get_order_details", { order_id: "ORD-404" });
    expect(r.result.status).toBe("ORDER_NOT_FOUND");
  });

  it("rejects invalid args with a structured error", async () => {
    const r = await call("get_order_details", {});
    expect(r.ok).toBe(false);
    expect(r.result.status).toBe("ERROR");
  });

  it("requires confirmation before cancelling", async () => {
    expect((await call("cancel_order", { order_id: "ORD-103", customer_confirmed: false })).result.status).toBe("NEEDS_CONFIRMATION");
    expect((await call("cancel_order", { order_id: "ORD-103", customer_confirmed: true })).result.status).toBe("CANCELLED");
    expect((await call("cancel_order", { order_id: "ORD-101", customer_confirmed: true })).result.status).toBe("CANCELLATION_NOT_ALLOWED");
  });

  it("produces JSON-schema declarations without $schema", () => {
    for (const d of toolDeclarations()) {
      expect(d.parametersJsonSchema).not.toHaveProperty("$schema");
      expect(d.parametersJsonSchema).toHaveProperty("type", "object");
    }
  });
});

describe("relative times", () => {
  it("reports ORD-102 as delivered 14 days ago and ORD-103 as placed 3 hours ago", async () => {
    const d102 = (await call("get_order_details", { order_id: "ORD-102" })).result.order as Record<string, unknown>;
    const d103 = (await call("get_order_details", { order_id: "ORD-103" })).result.order as Record<string, unknown>;
    expect(d102.delivered).toBe("14 days ago");
    expect(d103.placed).toBe("3 hours ago");
  });
});
