import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Studio Hub · Quản lý studio",
  description: "Không gian quản lý riêng tư cho studio đa dịch vụ.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
