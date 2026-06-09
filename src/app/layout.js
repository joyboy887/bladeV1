import "./globals.css";
import { Bebas_Neue, Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";

const display = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata = {
  title: "The Blade Hair Studio — Sharp cuts. No riff raff.",
  description: "Book a barber at The Blade Hair Studio. Sharp cuts. No riff raff.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
