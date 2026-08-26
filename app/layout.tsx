import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';

import './globals.css';

export const metadata: Metadata = {
  title: 'mono-press (MonoPress) — Markdown to HTML & PDF',
  description: 'mono-press (MonoPress), a local-first Markdown publisher for clean HTML and monochrome PDF documents.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
