/**
 * Brand configuration.
 *
 * Everything brand-specific (persona, policy numbers, copy) lives here as data.
 * The prompt builder, policy engine and UI read from this object, so adding a
 * second brand is a new config entry rather than a code change.
 */

export interface BrandPolicies {
  shipping: {
    // The brief says "free above ₹499" and "₹50 below ₹499", leaving exactly
    // ₹499 undefined. We treat ₹499 as free (ORD-102 is exactly ₹499 and the
    // usual D2C convention is "₹499 and above"). Documented in the README.
    freeShippingThreshold: number; // INR, orders >= this ship free
    flatFee: number; // INR fee for orders below the threshold
    standardDeliveryDays: [min: number, max: number];
  };
  returns: {
    windowDays: number; // days after delivery
    requiresUnopened: boolean;
  };
  damagedOrDefective: {
    reportWindowHours: number; // hours after delivery
    requiresPhotos: boolean;
    remedy: "replacement";
  };
  cancellation: {
    allowedStatuses: OrderStatus[];
  };
  cod: {
    maxOrderValue: number; // INR
    paymentModes: string[];
  };
}

export type OrderStatus =
  | "Processing"
  | "Shipped"
  | "Out for Delivery"
  | "Delivered"
  | "Cancelled";

export interface BrandConfig {
  id: string;
  name: string;
  tagline: string;
  overview: string;
  agent: {
    name: string;
    role: string;
    personality: string;
    /** Prebuilt Gemini voice. Overridable via GEMINI_VOICE. */
    voice: string;
  };
  policies: BrandPolicies;
}

export const AURA_SKINCARE: BrandConfig = {
  id: "aura",
  name: "Aura Skincare",
  tagline: "Simple, effective, organic.",
  overview:
    "Aura Skincare is a premium organic Indian skincare brand focused on simple, effective skincare products made with thoughtfully selected ingredients.",
  agent: {
    name: "Aria",
    role: "customer support specialist",
    personality: "friendly, warm, professional and concise",
    voice: "Aoede",
  },
  policies: {
    shipping: {
      freeShippingThreshold: 499,
      flatFee: 50,
      standardDeliveryDays: [3, 5],
    },
    returns: {
      windowDays: 7,
      requiresUnopened: true,
    },
    damagedOrDefective: {
      reportWindowHours: 48,
      requiresPhotos: true,
      remedy: "replacement",
    },
    cancellation: {
      allowedStatuses: ["Processing"],
    },
    cod: {
      maxOrderValue: 2500,
      paymentModes: ["cash", "UPI"],
    },
  },
};

const BRANDS: Record<string, BrandConfig> = {
  [AURA_SKINCARE.id]: AURA_SKINCARE,
};

export function getBrand(id: string = AURA_SKINCARE.id): BrandConfig {
  return BRANDS[id] ?? AURA_SKINCARE;
}
