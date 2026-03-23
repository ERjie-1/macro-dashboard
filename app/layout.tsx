import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import TabNav from "@/components/TabNav";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Macro-Economic Dashboard",
  description: "Macro-economic conditions monitoring dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} antialiased font-sans`}
        style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}
      >
        <TabNav />
        {children}
      </body>
    </html>
  );
}
