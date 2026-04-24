import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Halo — Turn your audience into a brand",
  description:
    "Prompt-to-brand engine. From a handle and a product idea to a persona, brand assets, mockups, agency matches, and a printable brand guide."
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
