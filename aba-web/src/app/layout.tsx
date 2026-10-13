import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { BRAND_FULL } from "@/lib/brand";

export const metadata: Metadata = {
  title: BRAND_FULL,
  description: BRAND_FULL + " — Applied Behavior Analysis therapy management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased bg-gray-50 text-gray-900" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
