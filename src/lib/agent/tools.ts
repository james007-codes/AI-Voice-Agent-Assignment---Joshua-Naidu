/**
 * Tool registry.
 *
 * Each tool has ONE zod schema that is both
 *   1. converted to JSON Schema for the model's function declaration, and
 *   2. used to validate the model's arguments on the server before execution.
 * So the contract the model sees and the contract we enforce cannot drift.
 *
 * Handlers return small, voice-friendly JSON: a machine `status`, plus
 * pre-formatted human strings ("today by 6 PM", "14 days ago") so the model
 * never has to do date maths or invent wording for facts.
 */

import { z } from "zod";
import { getBrand, type BrandConfig } from "./brand";
import { toModelJsonSchema } from "./json-schema";
import { orderRepository } from "./orders/mock-repository";
import { normalizeOrderId } from "./orders/order-id";
import type { Order } from "./orders/types";
import { evaluateCancellation, evaluateReturn, shippingFee } from "./policy";

export interface ToolContext {
  brand: BrandConfig;
  callId: string;
  now: number;
}

interface ToolDefinition<S extends z.ZodType> {
  name: string;
  description: string;
  args: S;
  handler: (args: z.infer<S>, ctx: ToolContext) => Promise<Record<string, unknown>>;
}

function defineTool<S extends z.ZodType>(def: ToolDefinition<S>) {
  return def;
}

// ---------------------------------------------------------------------------
// Formatting helpers (IST, spoken style)

const istTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const istDate = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "long",
});
const istDayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

function spokenWhen(date: Date, now: number): string {
  const sameDay = istDayKey.format(date) === istDayKey.format(new Date(now));
  const time = istTime.format(date).replace(":00", "").toUpperCase();
  return sameDay ? `today by ${time}` : `${istDate.format(date)}, ${time}`;
}

function spokenAgo(date: Date, now: number): string {
  // Round, don't floor: fixtures and `now` are read a few ms apart, and
  // "14 days ago" must not come out as "13 days ago".
  const hours = Math.round((now - date.getTime()) / 3_600_000);
  if (hours < 1) return "less than an hour ago";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function describeOrder(order: Order, ctx: ToolContext) {
  const { brand, now } = ctx;
  return {
    order_id: order.id,
    customer_first_name: order.customerName.split(" ")[0],
    products: order.items.map((i) => (i.quantity > 1 ? `${i.quantity} x ${i.name}` : i.name)),
    order_value_inr: order.value,
    shipping_fee_inr: shippingFee(brand.policies, order.value),
    status: order.status,
    placed: order.placedAt ? spokenAgo(order.placedAt, now) : undefined,
    courier: order.courier?.name,
    tracking_id: order.courier?.trackingId,
    expected_delivery: order.expectedDeliveryBy ? spokenWhen(order.expectedDeliveryBy, now) : undefined,
    delivered: order.deliveredAt ? spokenAgo(order.deliveredAt, now) : undefined,
    can_cancel: evaluateCancellation(brand.policies, order).allowed,
  };
}

type Lookup = { ok: true; order: Order } | { ok: false; result: Record<string, unknown> };

async function lookup(rawId: string): Promise<Lookup> {
  const parsed = normalizeOrderId(rawId);
  if (!parsed.ok) {
    return {
      ok: false,
      result: {
        status: "INVALID_ORDER_ID",
        heard: rawId,
        guidance: "Ask the customer to repeat the order ID. Sample IDs look like ORD-101.",
      },
    };
  }
  const order = await orderRepository.findById(parsed.orderId);
  if (!order) {
    return {
      ok: false,
      result: {
        status: "ORDER_NOT_FOUND",
        searched_for: parsed.orderId,
        guidance:
          "Say you couldn't locate an order with that number and ask the customer to repeat or verify it. Do not guess details.",
      },
    };
  }
  return { ok: true, order };
}

// ---------------------------------------------------------------------------
// Tools

const orderIdArg = z
  .string()
  .describe("Order ID exactly as the customer said it, e.g. 'ORD-101', 'order one oh one' or '101'.");

export const TOOLS = [
  defineTool({
    name: "get_order_details",
    description:
      "Look up an order's live status, products, value, courier and delivery timing. Call this whenever the customer asks about a specific order. Never state order facts without calling it.",
    args: z.object({ order_id: orderIdArg }),
    async handler({ order_id }, ctx) {
      const found = await lookup(order_id);
      if (!found.ok) return found.result;
      return { status: "FOUND", order: describeOrder(found.order, ctx) };
    },
  }),

  defineTool({
    name: "check_return_eligibility",
    description:
      "Decide whether a return, refund or replacement is allowed under policy. Call before telling the customer anything about a return or replacement. The verdict is final; relay it, never override it.",
    args: z.object({
      issue_type: z
        .enum(["change_of_mind", "damaged", "defective"])
        .describe("change_of_mind = doesn't want it / didn't suit; damaged = arrived broken or leaking; defective = product faulty."),
      order_id: orderIdArg.optional().describe("Order ID if the customer has one."),
      product_opened: z.boolean().optional().describe("Whether the product has been opened or used. Omit if unknown."),
      days_since_delivery: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Only when there is no order ID: how many days ago the customer says it was delivered."),
    }),
    async handler(args, ctx) {
      let order: Order | null = null;
      if (args.order_id) {
        const found = await lookup(args.order_id);
        if (!found.ok) return found.result;
        order = found.order;
      }
      const decision = evaluateReturn(
        ctx.brand.policies,
        {
          issueType: args.issue_type,
          productOpened: args.product_opened,
          daysSinceDelivery: args.days_since_delivery,
        },
        order,
        ctx.now,
      );
      return { status: decision.verdict, order_id: order?.id, ...decision };
    },
  }),

  defineTool({
    name: "cancel_order",
    description:
      "Cancel an order. Only call AFTER the customer has explicitly confirmed they want to cancel. Policy is enforced server-side; if not allowed, explain the reason and alternative.",
    args: z.object({
      order_id: orderIdArg,
      customer_confirmed: z.boolean().describe("True only if the customer clearly said yes to cancelling."),
    }),
    async handler({ order_id, customer_confirmed }, ctx) {
      const found = await lookup(order_id);
      if (!found.ok) return found.result;
      const decision = evaluateCancellation(ctx.brand.policies, found.order);
      if (!decision.allowed) return { status: "CANCELLATION_NOT_ALLOWED", order_id: found.order.id, ...decision };
      if (!customer_confirmed) {
        return {
          status: "NEEDS_CONFIRMATION",
          order_id: found.order.id,
          guidance: "Confirm with the customer that they want to cancel before calling again.",
        };
      }
      // Demo: the shared sample DB is not mutated, so every evaluator sees
      // ORD-103 as cancellable. Production would write to the OMS here.
      return {
        status: "CANCELLED",
        order_id: found.order.id,
        cancellation_reference: `CXL-${found.order.id.slice(4)}-${ctx.callId.slice(0, 4).toUpperCase()}`,
      };
    },
  }),

  defineTool({
    name: "escalate_to_human",
    description:
      "Create a ticket for the human support team. Use when the customer asks for a human, is upset after policy has been explained, reports something needing review, or asks about something you don't have information on.",
    args: z.object({
      reason: z.string().describe("Short reason for escalation."),
      order_id: orderIdArg.optional(),
    }),
    async handler({ reason, order_id }, ctx) {
      const normalized = order_id ? normalizeOrderId(order_id) : null;
      return {
        status: "TICKET_CREATED",
        ticket_id: `AURA-${ctx.callId.slice(0, 6).toUpperCase()}`,
        order_id: normalized?.ok ? normalized.orderId : undefined,
        reason,
        next_step: "The support team will follow up with the customer. Do not promise a specific timeframe or outcome.",
      };
    },
  }),

  defineTool({
    name: "end_call",
    description:
      "End the call. Call only after the customer indicates they're done and you have said a short goodbye.",
    args: z.object({ reason: z.string().optional() }),
    async handler() {
      return { status: "ENDING" };
    },
  }),
];

export type ToolName = (typeof TOOLS)[number]["name"];

/** Provider-neutral declarations (name, description, JSON Schema). */
export function toolDeclarations() {
  return TOOLS.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: toModelJsonSchema(t.args) }));
}

export type ToolExecution =
  | { ok: true; name: string; result: Record<string, unknown>; durationMs: number }
  | { ok: false; name: string; error: string; result: Record<string, unknown>; durationMs: number };

/**
 * Validate and execute a tool call. Never throws: failures become a result the
 * model can talk about ("I'm having trouble looking that up") instead of a
 * dead call.
 */
export async function executeTool(
  name: string,
  rawArgs: unknown,
  opts: { brandId?: string; callId: string; now?: number },
): Promise<ToolExecution> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) {
    return { ok: false, name, error: "UNKNOWN_TOOL", result: { status: "ERROR", error: `Unknown tool ${name}` }, durationMs: elapsed() };
  }
  const parsed = tool.args.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      name,
      error: "INVALID_ARGS",
      result: { status: "ERROR", error: "Invalid arguments", issues: z.prettifyError(parsed.error) },
      durationMs: elapsed(),
    };
  }
  const ctx: ToolContext = { brand: getBrand(opts.brandId), callId: opts.callId, now: opts.now ?? Date.now() };
  try {
    // The union of handlers can't be called with a union of args; parse above guarantees the match.
    const result = await (tool.handler as (a: unknown, c: ToolContext) => Promise<Record<string, unknown>>)(parsed.data, ctx);
    return { ok: true, name, result, durationMs: elapsed() };
  } catch (err) {
    console.error(JSON.stringify({ event: "tool_error", tool: name, callId: opts.callId, error: String(err) }));
    return {
      ok: false,
      name,
      error: "HANDLER_FAILED",
      result: { status: "ERROR", guidance: "Apologise briefly and offer to raise a ticket with the support team." },
      durationMs: elapsed(),
    };
  }
}
