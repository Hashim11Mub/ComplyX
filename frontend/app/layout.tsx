import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ComplyX · ضامن | KSA Regulatory Compliance",
  description: "AI compliance analysis for Saudi fintech products against SAMA, SDAIA, AAOIFI Shariah and CMA regulations."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
