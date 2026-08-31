import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Fira_Code } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import { RootLayoutProps } from "@/types";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const firaCode = Fira_Code({
  variable: "--font-mono",
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
      className={`${plusJakartaSans.variable} ${firaCode.variable} h-full antialiased font-sans`}
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
