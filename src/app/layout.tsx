import type { Metadata } from "next";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider";
import Header from "@/components/Header";
import AuthProvider from "@/context/AuthProvider";

export const metadata: Metadata = {
  title: "Online Code Test",
  description: "Developed a Leetcode like coding platform using Nextjs",
  icons: "/favicon.ico"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <AuthProvider>
          <Header />
            {children}
          <Toaster position="bottom-right" richColors />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
