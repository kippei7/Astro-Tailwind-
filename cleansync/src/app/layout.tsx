import type { Metadata } from "next";
import { Fraunces, Noto_Sans_JP } from "next/font/google";
import { headers } from "next/headers";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const noto = Noto_Sans_JP({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const display = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CleanSync",
  description:
    "夫婦の掃除タスクをポイント化して可視化し、建設的な交渉を支援する。",
};

export default async function RootLayout({
  children,
}: LayoutProps<"/">) {
  const headerList = await headers();
  const currentPath = headerList.get("x-pathname") ?? "/";

  return (
    <html
      lang="ja"
      className={`${noto.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell currentPath={currentPath}>{children}</AppShell>
      </body>
    </html>
  );
}
