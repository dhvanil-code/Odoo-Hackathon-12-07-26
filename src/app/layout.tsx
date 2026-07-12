import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "AssetFlow", template: "%s · AssetFlow" },
  description: "Enterprise asset and resource management",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
