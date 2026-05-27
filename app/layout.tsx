import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/app/convex-client-provider";
import AuthGate from "@/app/auth-gate";
import Sbar from "@/components/background/sidebar/sidebar";

const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["300", "600"], style: ["normal", "italic"] });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500"] });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Deepslate Dungeons",
  description: "D&D RPG game creation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="flex background">
          <ConvexClientProvider>
            <AuthGate>
              <div className="page">
                <Sbar />
                {children}
              </div>
            </AuthGate>
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
