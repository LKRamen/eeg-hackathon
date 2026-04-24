import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "stencil — Turn your audience into a brand",
  description:
    "Prompt-to-brand engine. From a handle and a product idea to a persona, brand assets, mockups, agency matches, and a printable brand guide.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${instrumentSerif.variable} ${inter.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
