import type { Metadata, Viewport } from "next";
import { Syne } from "next/font/google";
import "./globals.css";

// Artsy, modern display face — used only for the "artguessr" wordmark.
const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "artguessr — guess the painter",
  description:
    "An endless multiple-choice quiz over a thousand of the world's most famous paintings.",
  applicationName: "artguessr",
  authors: [{ name: "artguessr" }],
  openGraph: {
    title: "artguessr — guess the painter",
    description:
      "Endless quiz over a thousand of the world's most famous paintings.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#fafaf7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`min-h-dvh antialiased font-sans ${display.variable}`}>
        {children}
      </body>
    </html>
  );
}
