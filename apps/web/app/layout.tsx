import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stencil — Turn your idea into a brand",
  description:
    "Prompt-to-brand engine. Drop a creator handle and a product idea. Get a full brand identity in 90 seconds."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
