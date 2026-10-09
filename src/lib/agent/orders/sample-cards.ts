import type { OrderStatus } from "../brand";

/**
 * Static display copy for the "Test Orders" helper. Kept static (rather than
 * computed from the live fixtures) so pages can prerender; sample-cards.test.ts
 * guarantees it never drifts from what the tools actually return.
 */
export interface SampleOrderCard {
  id: string;
  customer: string;
  product: string;
  value: number;
  status: OrderStatus;
  note: string;
  trySaying: string[];
}

export const SAMPLE_ORDER_CARDS: SampleOrderCard[] = [
  {
    id: "ORD-101",
    customer: "Priya Sharma",
    product: "Vitamin C Serum (30ml)",
    value: 699,
    status: "Out for Delivery",
    note: "BlueDart BD-982103 · Expected by 6 PM today",
    trySaying: ["Where is my order ORD-101?", "Can I cancel ORD-101?"],
  },
  {
    id: "ORD-102",
    customer: "Rahul Verma",
    product: "Hydrating Sunscreen SPF 50",
    value: 499,
    status: "Delivered",
    note: "Delhivery DL-441029 · Delivered 14 days ago",
    trySaying: ["I want to return ORD-102", "My sunscreen from ORD-102 arrived damaged"],
  },
  {
    id: "ORD-103",
    customer: "Ananya Patel",
    product: "Green Tea Face Wash + Toner",
    value: 850,
    status: "Processing",
    note: "Ordered 3 hours ago · Eligible for cancellation",
    trySaying: ["Please cancel ORD-103", "Mera order ORD-103 kab aayega?"],
  },
];

export const EDGE_CASE_PROMPTS = [
  { label: "Policy", text: "I bought it 20 days ago and opened it. Can I return it?" },
  { label: "Unknown ID", text: "Track my order ORD-999" },
  { label: "Out of scope", text: "Can you book me a flight to Goa?" },
  { label: "No ID", text: "Where's my order?" },
  { label: "Payments", text: "Is COD available for a ₹3,000 order?" },
];
