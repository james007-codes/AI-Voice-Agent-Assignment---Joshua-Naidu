import type { OrderStatus } from "../brand";

export interface Order {
  id: string;
  customerName: string;
  items: { name: string; quantity: number }[];
  /** Total value in INR. */
  value: number;
  status: OrderStatus;
  /** Only known where the brief states it. */
  placedAt?: Date;
  courier?: { name: string; trackingId: string };
  /** Set while in transit. */
  expectedDeliveryBy?: Date;
  /** Set once delivered. */
  deliveredAt?: Date;
}

/**
 * Storage boundary for orders. The in-memory implementation backs the demo;
 * production would implement this against the OMS / Shopify / a database
 * without touching the tool handlers.
 */
export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  listSampleIds(): Promise<string[]>;
}
