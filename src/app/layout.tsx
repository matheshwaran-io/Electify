import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { MotionProvider } from "@/components/motion-provider";
import { AppToaster } from "@/components/app-toaster";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  axes: ["opsz"],
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Electify", template: "%s · Electify" },
  description: "Elective registration for SRMIST: live seat counts, locked-in choices and an instant receipt.",
  applicationName: "Electify",
  appleWebApp: { title: "Electify" },
  openGraph: { siteName: "Electify", type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFCFC" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0D0C" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(inter.variable, geistMono.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-canvas font-sans text-fg antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <MotionProvider>
            <div className="flex min-h-screen flex-col">{children}</div>
            <AppToaster />
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
