import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Spectral } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const body = Spectral({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Deadhand",
  description: "Some words should wait for the world.",
};

export const viewport: Viewport = {
  themeColor: "#0A0807",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="chamber-grain">{children}</body>
    </html>
  );
}
