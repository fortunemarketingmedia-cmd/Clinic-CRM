import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/app/providers';
import { AppFrame } from '@/components/layout/app-frame';

export const metadata: Metadata = {
  title: 'Revive Clinic CRM',
  description: 'Clinic CRM for leads, appointments, patient care, communication, and operations.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fffaf3',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers><AppFrame>{children}</AppFrame></Providers>
      </body>
    </html>
  );
}
