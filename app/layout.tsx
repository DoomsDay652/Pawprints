import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  manifest: '/manifest.webmanifest',
  applicationName: 'PawPrints',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'PawPrints' },
  title: 'PawPrints — Community missing-pet search',
  description: 'Coordinate trusted sightings, follow a directional trail, and bring missing pets home.',
  openGraph: {
    title: 'PawPrints',
    description: 'Community sightings. A clearer trail home.',
    images: [{ url: '/og.jpg', width: 1732, height: 909, alt: 'PawPrints community missing-pet search map' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PawPrints',
    description: 'Community sightings. A clearer trail home.',
    images: ['/og.jpg'],
  },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fffefa' },
    { media: '(prefers-color-scheme: dark)', color: '#10231f' },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
