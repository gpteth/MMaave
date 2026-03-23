import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Web3Provider from "@/components/providers/Web3Provider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { ReferrerGate } from "@/components/providers/ReferrerGate";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b0e18",
};

export const metadata: Metadata = {
  title: "Rockplan - DeFi Investment Platform",
  description: "Decentralized investment platform on BSC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <Web3Provider>
            <LanguageProvider>
              <ReferrerGate>
                <div className="flex min-h-screen min-h-dvh">
                  <div className="hidden md:block">
                    <Sidebar />
                  </div>
                  <div className="flex-1 md:ml-64">
                    <Header />
                    <main className="pt-16 md:pt-20 pb-24 md:pb-10 px-3 md:px-8">
                      <div className="w-full mx-auto max-w-7xl">
                        {children}
                      </div>
                    </main>
                  </div>
                  <MobileNav />
                </div>
              </ReferrerGate>
            </LanguageProvider>
          </Web3Provider>
        </QueryProvider>
      </body>
    </html>
  );
}
