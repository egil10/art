import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Canvas — guess the painter",
  description:
    "An endless multiple-choice quiz over a thousand of the world's most famous paintings.",
  applicationName: "Canvas",
  authors: [{ name: "Canvas" }],
  openGraph: {
    title: "Canvas — guess the painter",
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
      <body className="min-h-dvh antialiased font-sans">{children}</body>
    </html>
  );
}
