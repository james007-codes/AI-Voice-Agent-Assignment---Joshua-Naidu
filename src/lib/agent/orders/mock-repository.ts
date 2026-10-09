import type { Order, OrderRepository } from "./types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const IST_OFFSET_MS = 5.5 * HOUR;

/** Returns a Date for HH:MM IST on the current IST calendar day. */
function todayAtIST(hours: number, minutes = 0, now = Date.now()): Date {
  const ist = new Date(now + IST_OFFSET_MS);
  const utcMs =
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), hours, minutes) -
    IST_OFFSET_MS;
  return new Date(utcMs);
}

/**
 * The brief describes orders relative to "now" ("delivered 14 days ago",
 * "ordered 3 hours ago"). Building the fixtures relative to the current time
 * keeps those facts true no matter when an evaluator opens the app, so the
 * policy engine sees the same picture the brief describes.
 */
export function buildSampleOrders(now = Date.now()): Order[] {
  return [
    {
      id: "ORD-101",
      customerName: "Priya Sharma",
      items: [{ name: "Vitamin C Serum (30ml)", quantity: 1 }],
      value: 699,
      status: "Out for Delivery",
      courier: { name: "BlueDart", trackingId: "BD-982103" },
      expectedDeliveryBy: todayAtIST(18, 0, now),
    },
    {
      id: "ORD-102",
      customerName: "Rahul Verma",
      items: [{ name: "Hydrating Sunscreen SPF 50", quantity: 1 }],
      value: 499,
      status: "Delivered",
      courier: { name: "Delhivery", trackingId: "DL-441029" },
      deliveredAt: new Date(now - 14 * DAY),
    },
    {
      id: "ORD-103",
      customerName: "Ananya Patel",
      items: [{ name: "Green Tea Face Wash + Toner", quantity: 1 }],
      value: 850,
      status: "Processing",
      placedAt: new Date(now - 3 * HOUR),
    },
  ];
}

export class MockOrderRepository implements OrderRepository {
  async findById(id: string): Promise<Order | null> {
    return buildSampleOrders().find((o) => o.id === id) ?? null;
  }

  async listSampleIds(): Promise<string[]> {
    return buildSampleOrders().map((o) => o.id);
  }
}

export const orderRepository: OrderRepository = new MockOrderRepository();
