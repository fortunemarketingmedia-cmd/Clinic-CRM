import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/app/providers';

export const metadata: Metadata = {
  title: 'Revive Clinic CRM',
  description: 'Clinic CRM for leads, appointments, patient care, communication, and operations.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
