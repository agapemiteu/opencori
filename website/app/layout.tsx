import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Corri — Physical Context Infrastructure",
  description: "Privacy-first branch awareness and secure delivery infrastructure for mobile apps.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
