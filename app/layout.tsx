import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grow & Brand on X",
  description: "Internal X content generation, review, scheduling, and interaction console."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
