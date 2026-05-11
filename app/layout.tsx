import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LangProvider } from "@/components/LangProvider";
import { ProfileProvider } from "@/components/ProfileProvider";
import ProfileGate from "@/components/ProfileGate";
import Nav from "@/components/Nav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Keep Fit",
  description: "A pure, no-login, no-ads training tracker.",
  applicationName: "Keep Fit",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.svg", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Keep Fit",
    startupImage: ["/icon.svg"],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0ea5e9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <LangProvider>
          <ProfileProvider>
            <Nav />
            <main className="max-w-5xl mx-auto px-4 py-6">
              <ProfileGate>{children}</ProfileGate>
            </main>
          </ProfileProvider>
        </LangProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
