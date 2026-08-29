import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import { RootLayoutProps } from "@/types";

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

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionProviderWrapper>
          <ToastProvider>
            <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
              {children}
            </Suspense>
          </ToastProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
