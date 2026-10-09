/**
 * Deterministic policy engine.
 *
 * Guardrails live here, not only in the prompt. The model is never asked to do
 * date arithmetic or interpret policy edge cases on its own: tools call these
 * functions and hand the model a verdict plus the reason in plain words. The
 * prompt then only has to say "relay the verdict, never override it", which a
 * voice model follows far more reliably than "apply this 5-clause policy".
 */

import type { BrandPolicies } from "./brand";
import type { Order } from "./orders/types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type IssueType = "change_of_mind" | "damaged" | "defective";

export interface ReturnQuery {
  issueType: IssueType;
  /** undefined = customer hasn't said yet */
  productOpened?: boolean;
  /** Used when the customer has no order ID but states a timeframe. */
  daysSinceDelivery?: number;
}

export type ReturnVerdict =
  | "RETURN_ELIGIBLE"
  | "REPLACEMENT_ELIGIBLE"
  | "NOT_ELIGIBLE"
  | "NEEDS_MORE_INFO"
  | "NOT_YET_DELIVERED";

export interface ReturnDecision {
  verdict: ReturnVerdict;
  /** Plain-language reason, safe to paraphrase to the customer. */
  reason: string;
  nextSteps?: string;
  /** What the model must ask for when verdict is NEEDS_MORE_INFO. */
  missing?: ("product_opened" | "days_since_delivery")[];
  /** A human can review, but nothing may be promised. */
  mayOfferEscalation: boolean;
}

export function evaluateReturn(
  policies: BrandPolicies,
  query: ReturnQuery,
  order: Order | null,
  now = Date.now(),
): ReturnDecision {
  if (order && order.status !== "Delivered") {
    const alt =
      order.status === "Processing"
        ? "The order is still processing, so it can be cancelled instead."
        : order.status === "Cancelled"
          ? "The order is already cancelled."
          : "Since it is on its way, the customer may refuse delivery at the doorstep.";
    return {
      verdict: "NOT_YET_DELIVERED",
      reason: `Order ${order.id} has not been delivered yet (status: ${order.status}). Returns apply only after delivery.`,
      nextSteps: alt,
      mayOfferEscalation: false,
    };
  }

  const hoursSinceDelivery =
    order?.deliveredAt != null
      ? (now - order.deliveredAt.getTime()) / HOUR
      : query.daysSinceDelivery != null
        ? query.daysSinceDelivery * 24
        : undefined;

  if (hoursSinceDelivery === undefined) {
    return {
      verdict: "NEEDS_MORE_INFO",
      reason: "We need the order ID or roughly when the order was delivered.",
      missing: ["days_since_delivery"],
      mayOfferEscalation: false,
    };
  }

  const days = Math.floor(hoursSinceDelivery / 24);
  const { returns, damagedOrDefective } = policies;

  if (query.issueType === "damaged" || query.issueType === "defective") {
    if (hoursSinceDelivery <= damagedOrDefective.reportWindowHours) {
      return {
        verdict: "REPLACEMENT_ELIGIBLE",
        reason: `Reported within ${damagedOrDefective.reportWindowHours} hours of delivery, so a replacement can be arranged.`,
        nextSteps: damagedOrDefective.requiresPhotos
          ? "Customer must share clear photos of the product and packaging; the replacement is processed after photo review."
          : "Replacement will be processed.",
        mayOfferEscalation: false,
      };
    }
    return {
      verdict: "NOT_ELIGIBLE",
      reason: `Damaged or defective items must be reported within ${damagedOrDefective.reportWindowHours} hours of delivery; this was delivered about ${days} day(s) ago.`,
      nextSteps:
        "Do not promise a replacement or refund. You may offer to raise a ticket for a specialist to review, making clear it is not guaranteed.",
      mayOfferEscalation: true,
    };
  }

  // change_of_mind
  if (hoursSinceDelivery > returns.windowDays * 24) {
    return {
      verdict: "NOT_ELIGIBLE",
      reason: `Returns are accepted within ${returns.windowDays} days of delivery; this was delivered about ${days} day(s) ago.`,
      mayOfferEscalation: false,
    };
  }
  if (returns.requiresUnopened && query.productOpened === undefined) {
    return {
      verdict: "NEEDS_MORE_INFO",
      reason: "Within the return window, but returns require the product to be unopened.",
      missing: ["product_opened"],
      mayOfferEscalation: false,
    };
  }
  if (returns.requiresUnopened && query.productOpened) {
    return {
      verdict: "NOT_ELIGIBLE",
      reason: "Returns are only accepted for unopened, unused products in original packaging.",
      mayOfferEscalation: false,
    };
  }
  return {
    verdict: "RETURN_ELIGIBLE",
    reason: `Within ${returns.windowDays} days of delivery and unopened.`,
    nextSteps: "Product must be unused and in its original packaging. A return pickup can be scheduled.",
    mayOfferEscalation: false,
  };
}

export interface CancellationDecision {
  allowed: boolean;
  reason: string;
  alternative?: string;
}

export function evaluateCancellation(policies: BrandPolicies, order: Order): CancellationDecision {
  if (order.status === "Cancelled") {
    return { allowed: false, reason: "This order is already cancelled." };
  }
  if (policies.cancellation.allowedStatuses.includes(order.status)) {
    return { allowed: true, reason: `Order is in ${order.status} status, which can be cancelled.` };
  }
  if (order.status === "Delivered") {
    return {
      allowed: false,
      reason: "The order has already been delivered, so it cannot be cancelled.",
      alternative: "The return policy applies instead.",
    };
  }
  return {
    allowed: false,
    reason: `Orders can only be cancelled while Processing; this one is ${order.status}.`,
    alternative: "The customer may refuse the delivery at the doorstep.",
  };
}

export function shippingFee(policies: BrandPolicies, orderValue: number): number {
  return orderValue >= policies.shipping.freeShippingThreshold ? 0 : policies.shipping.flatFee;
}

export function isCodEligible(policies: BrandPolicies, orderValue: number): boolean {
  return orderValue <= policies.cod.maxOrderValue;
}

export function daysBetween(from: Date, to = Date.now()): number {
  return Math.floor((to - from.getTime()) / DAY);
}
