import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kredit — one key, every model, paid in rupees",
  description:
    "Kredit is a simpler OpenRouter: one API key for OpenAI, Anthropic, Google and 500+ models, paid with prepaid credits you buy in rupees by UPI, card or net banking. No wallet, no subscription.",
  openGraph: {
    title: "Kredit — one key, every model, paid in rupees",
    description: "One API key for every AI model. Buy credits in rupees by UPI or card, spend them by the token, read the bill in the response headers.",
    url: "https://usekredit.space",
    siteName: "Kredit",
    type: "website",
  },
};

// Only what every page shares. The marketing pages add their header and footer
// in (site)/layout; the signed-in product adds its sidebar in (app)/layout.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
