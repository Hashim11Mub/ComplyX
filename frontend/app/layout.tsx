import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ComplyX - SAMA Compliance Intelligence",
  description: "AI-assisted SAMA regulatory compliance checks for Saudi fintech products."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
