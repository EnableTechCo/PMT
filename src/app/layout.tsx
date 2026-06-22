import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import Providers from "@/app/providers";
import { AuthProvider } from "@/contexts/AuthContext";
import { TeamProvider } from "@/contexts/TeamContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ticket Management",
  description: "Simple and elegant ticket management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body
        className={`${inter.className} antialiased text-[var(--text-primary)]`}
      >
        <Providers>
          <ThemeProvider>
            <AuthProvider>
              <RealtimeProvider>
                <TeamProvider>{children}</TeamProvider>
              </RealtimeProvider>
            </AuthProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
