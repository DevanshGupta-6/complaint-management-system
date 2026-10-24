import { Suspense } from "react";
import type { Metadata } from "next";
import { resolvePublicFormCompany } from "@/lib/ingest/api-key";
import { ComplaintForm } from "@/components/submit/ComplaintForm";

export const metadata: Metadata = {
  title: "Submit a complaint",
  robots: { index: false, follow: false }, // the URL contains the key, so keep it out of search
  referrer: "no-referrer",                 // don't leak the URL to sites the customer visits next
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-sm sm:p-8">{children}</div>
  );
}

function InvalidLink() {
  return (
    <Card>
      <h1 className="text-xl font-semibold">This link isn&rsquo;t valid</h1>
      <p className="mt-2 text-sm text-gray-600">
        The complaint link may have expired or been copied incorrectly. Please ask the company for
        a new one.
      </p>
    </Card>
  );
}

async function FormLoader({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const company = await resolvePublicFormCompany(key);
  if (!company) return <InvalidLink />;
  return (
    <Card>
      <ComplaintForm apiKey={key} companyName={company.companyName} />
    </Card>
  );
}

export default function SubmitPage({ params }: { params: Promise<{ key: string }> }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Suspense fallback={<Card><div className="h-72 animate-pulse rounded-xl bg-gray-100" /></Card>}>
        <FormLoader params={params} />
      </Suspense>
    </main>
  );
}