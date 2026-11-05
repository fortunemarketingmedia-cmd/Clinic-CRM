import { PublicConsentForm } from '@/modules/consent/public-consent-form';

export default async function PublicConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <main className="min-h-screen bg-[#fffaf3] px-4 py-8"><PublicConsentForm token={token} /></main>;
}
