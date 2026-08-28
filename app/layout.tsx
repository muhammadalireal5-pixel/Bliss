import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SayMe Outreach",
  description: "AI-powered personalized email outreach platform",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

import SessionProviderWrapper from "@/components/SessionProviderWrapper";

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <SessionProviderWrapper>
          <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
            {children}
          </Suspense>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
