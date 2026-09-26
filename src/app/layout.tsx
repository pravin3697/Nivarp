import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#07080B",
};

export const metadata: Metadata = {
  title: "Nivarp — Rule-Based System",
  description: "Disciplined execution and setup vault for the Indian Stock Market.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Nivarp — Rule-Based System",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark bg-[#050608]">
      <body className={`${inter.className} bg-[#050608] text-zinc-100 antialiased min-h-screen flex flex-col`}>
        {children}
      </body>
    </html>
  );
}