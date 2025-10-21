import type { Metadata } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import "./globals.css";
import NoSSR from "./components/NoSSR";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Catfished",
  description: "The dating profile party game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${bebasNeue.variable} ${inter.variable} font-inter antialiased`}
        suppressHydrationWarning={true}
      >
        <NoSSR>
          {children}
        </NoSSR>
      </body>
    </html>
  );
}
