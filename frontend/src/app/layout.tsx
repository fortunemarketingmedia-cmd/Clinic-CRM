import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/app/providers';
import { AppFrame } from '@/components/layout/app-frame';

export const metadata: Metadata = {
  title: 'Revive Clinic CRM',
  description: 'Clinic CRM for leads, appointments, patient care, communication, and operations.',
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
