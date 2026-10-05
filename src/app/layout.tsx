import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#090c0d",
};

export const metadata: Metadata = {
  title: "Workout Buddy",
  description:
    "Organizza le tue schede e segui i tuoi progressi in allenamento.",
  applicationName: "Workout Buddy",
  appleWebApp: {
    capable: true,
    title: "Workout Buddy",
    statusBarStyle: "black-translucent",
  },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
  other: { "apple-mobile-web-app-capable": "yes" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
