import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SyncProvider } from "./components/SyncProvider";
import { ProgressProvider } from "./hooks/useProgress";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Summer Game Map",
  description: "An interactive map and code tracker for the AADL Summer Game.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ProgressProvider>
          <SyncProvider>
            {children}
          </SyncProvider>
        </ProgressProvider>
      </body>
    </html>
  );
}
