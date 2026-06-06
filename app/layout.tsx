import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/app/convex-client-provider";
import AuthGate from "@/app/auth-gate";
import Sbar from "@/components/background/sidebar/sidebar";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Deepslate Dungeons",
  description: "D&D RPG game creation platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${cormorant.variable} ${dmSans.variable}`}>
        <body className="min-h-screen bg-bg-base text-text-primary antialiased">
          <ConvexClientProvider>
            <AuthGate>
              <div className="flex min-h-screen">
                <Sbar />
                <main className="flex-1 overflow-x-hidden">
                  {children}
                </main>
              </div>
            </AuthGate>
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
