import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sparko | Growth & Branding Assistant for X",
  description: "Sparko helps founders, builders, and teams turn daily context into X posts and relationship-building actions."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
