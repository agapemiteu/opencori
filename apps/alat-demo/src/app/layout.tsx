import type { Metadata } from "next";
import "./global.css";
import { CorriProvider } from "../components/CorriProvider";

export const metadata: Metadata = {
  title: "Wema ALAT Corri Demo",
  description: "ALAT demonstration with Corri SDK integrated",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CorriProvider>{children}</CorriProvider>
      </body>
    </html>
  );
}
