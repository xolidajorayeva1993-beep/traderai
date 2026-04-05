import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/shared/Providers';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'FATH AI — Professional AI Savdo Signallari',
    template: '%s | FATH AI',
  },
  description:
    'Forex va Kripto bozori uchun FATH AI asosidagi professional savdo signallari. SNR, SMC, Gann strategiyalari bilan aniq signal.',
  keywords: [
    'forex signallari', 'kripto signallari', 'AI savdo', 'texnik tahlil',
    'SNR zonalari', 'SMC', 'Gann', 'FATH AI savdo', 'trading signals uzbekistan',
  ],
  authors: [{ name: 'FATH AI' }],
  creator: 'FATH AI',
  manifest: '/manifest.json',
  metadataBase: new URL('https://traderai.app'),
  openGraph: {
    type: 'website',
    locale: 'uz_UZ',
    url: 'https://traderai.app',
    title: 'FATH AI — Professional AI Savdo Signallari',
    description: 'Forex va Kripto uchun AI-asosidagi professional savdo signallari.',
    siteName: 'FATH AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FATH AI — Professional AI Savdo Signallari',
    description: 'Forex va Kripto uchun AI-asosidagi professional savdo signallari.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0F172A',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
