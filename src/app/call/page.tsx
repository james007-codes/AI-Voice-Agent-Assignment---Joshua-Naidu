import type { Metadata, Viewport } from "next";
import { CallExperience } from "@/components/call/call-experience";

export const metadata: Metadata = {
  title: "Call Aria · Aura Skincare",
  description: "Live voice call with Aria, Aura Skincare's AI support specialist.",
};

export const viewport: Viewport = { themeColor: "#141414" };

export default function CallPage() {
  return <CallExperience />;
}
