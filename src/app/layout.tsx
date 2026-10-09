import type { Metadata, Viewport } from "next";
import { Anton, Instrument_Sans, JetBrains_Mono, Xanh_Mono } from "next/font/google";
import "./globals.css";

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"] });
const xanh = Xanh_Mono({ variable: "--font-xanh", weight: "400", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aria · Aura Skincare Voice Support",
  description:
    "Talk to Aria, Aura Skincare's AI voice support agent. Live order lookups, policy-aware answers and a structured summary after every call.",
};

export const viewport: Viewport = {
  themeColor: "#e9bd16",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${anton.variable} ${instrument.variable} ${xanh.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
