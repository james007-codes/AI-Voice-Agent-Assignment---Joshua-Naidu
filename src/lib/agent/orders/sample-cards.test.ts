import { describe, expect, it } from "vitest";
import { buildSampleOrders } from "./mock-repository";
import { SAMPLE_ORDER_CARDS } from "./sample-cards";

describe("sample order cards", () => {
  it("match the order fixtures the tools use", () => {
    const orders = buildSampleOrders();
    expect(SAMPLE_ORDER_CARDS.map((c) => c.id)).toEqual(orders.map((o) => o.id));
    for (const card of SAMPLE_ORDER_CARDS) {
      const order = orders.find((o) => o.id === card.id)!;
      expect(card.customer).toBe(order.customerName);
      expect(card.value).toBe(order.value);
      expect(card.status).toBe(order.status);
      expect(card.product).toBe(order.items.map((i) => i.name).join(", "));
      if (order.courier) expect(card.note).toContain(order.courier.trackingId);
    }
  });
});
