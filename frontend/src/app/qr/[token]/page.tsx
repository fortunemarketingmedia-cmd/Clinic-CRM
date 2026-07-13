import { QrRegistrationForm } from '@/modules/qr/qr-registration-form';

export default async function QrRegistrationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <QrRegistrationForm token={token} />
    </main>
  );
}
