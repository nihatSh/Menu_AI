import { Outfit, JetBrains_Mono } from "next/font/google";
import { THEME_BOOTSTRAP } from "@/lib/theme";
import "./globals.css";

// Display + UI face. Outfit has real weight range and a geometric character
// that reads as hospitality rather than dashboard.
const outfit = Outfit({
  subsets: ["latin", "latin-ext"], // latin-ext carries ə ş ğ ı for Azerbaijani
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

// Every price, calorie, gram and timer in the app is a number in a column.
// Tabular mono keeps those columns aligned as values change.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata = {
  title: "Scan & Eat — order at your table",
  description:
    "Scan the code on your table and let the AI waiter recommend what to order from this restaurant's real menu.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets the sticky bar sit under the home indicator
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1012" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${outfit.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the stored colour mode before first paint so the page never
            flashes light before switching to dark. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-paper"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
