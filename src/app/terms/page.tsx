import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-[#37352f]">
      <Link href="/" className="text-sm text-[#2383e2] hover:underline">Back to MemeCoin Journal</Link>
      <h1 className="mt-5 text-3xl font-bold">Terms of use</h1>
      <p className="mt-4 text-sm leading-6">
        By using MemeCoin Journal, you agree to use it as a record-keeping and analytics tool and to protect your account credentials and data.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Not financial advice</h2>
      <p className="mt-2 text-sm leading-6">
        The app, charts, calculations, token information, and AI-generated content are for informational and journaling purposes only. They are not investment, legal, tax, or financial advice and do not guarantee accuracy or trading results. Crypto assets, especially memecoins, can be extremely volatile and may lose all value. You are responsible for evaluating information and making your own decisions.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Your data and third-party services</h2>
      <p className="mt-2 text-sm leading-6">
        You are responsible for the accuracy and lawfulness of data you enter or import. Do not submit seed phrases, private wallet keys, or information you do not have permission to share. If you request an AI review, selected trade details and your question are processed by the AI provider you choose. Third-party services have their own terms, availability, and privacy practices.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Availability and account removal</h2>
      <p className="mt-2 text-sm leading-6">
        The service is provided as available and may change or be interrupted. Keep your own export of records you need. You may use the account menu to request account and cloud-data deletion; review the Privacy page for what that removes.
      </p>
      <p className="mt-8 text-xs leading-5 text-[#787774]">
        These plain-language terms are a starting point and should be reviewed by the site operator for applicable law before a public launch.
      </p>
    </main>
  );
}
