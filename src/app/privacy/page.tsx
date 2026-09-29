import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-[#37352f]">
      <Link href="/" className="text-sm text-[#2383e2] hover:underline">Back to MemeCoin Journal</Link>
      <h1 className="mt-5 text-3xl font-bold">Privacy</h1>
      <p className="mt-4 text-sm leading-6">
        MemeCoin Journal is a private trading journal. This notice explains what the app processes and where it is stored.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Account and journal data</h2>
      <p className="mt-2 text-sm leading-6">
        Firebase Authentication manages sign-in. Trades, trade notes, screenshots, rules, and goals are stored in Cloud Firestore under your Firebase user ID. Security rules restrict those records to that signed-in account. Wallet addresses, wallet labels, paper-trading settings, AI provider selection, your AI API key, and the optional share-card handle are stored in that account&apos;s browser profile rather than Firestore.
      </p>

      <h2 className="mt-8 text-xl font-semibold">AI coach and API keys</h2>
      <p className="mt-2 text-sm leading-6">
        Your provider key is saved in your browser&apos;s local storage. When you request an AI review, it is sent over HTTPS to this app&apos;s server and forwarded to the provider you selected. The app does not intentionally save the key in Firestore, analytics, or application logs. The server uses short-lived request processing and does not use a site-owned provider key.
      </p>
      <p className="mt-2 text-sm leading-6">
        The server receives up to 100 recent trade records to calculate a summary. It forwards at most 15 reduced trade records and your optional question to the selected provider. The forwarded records include symbols, outcomes, profit/loss, tags, and setup names; token addresses, wallet addresses, trade notes, and screenshots are excluded. Review your AI provider&apos;s terms before using this feature.
      </p>
      <p className="mt-2 text-sm leading-6">
        Browser local storage is not an encrypted password vault. Anyone with access to your unlocked browser profile may be able to read saved settings or keys. Remove your key in the AI Coach settings and revoke it with its provider if you think it was exposed.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Service providers and security</h2>
      <p className="mt-2 text-sm leading-6">
        The app uses Firebase for sign-in and cloud storage, Vercel to host the application and server endpoints, public market-data services for token/price lookups, and the AI provider you choose when you request a review. A small server-side counter is used to limit abuse of AI requests. Never add seed phrases, private keys, or other wallet secrets to this journal.
      </p>
      <p className="mt-2 text-sm leading-6">
        If you check a wallet&apos;s balance, its public address is sent to public Solana RPC services to retrieve the balance. The address and returned balance are not saved to Firestore by that lookup. The server-side abuse counter stores a hashed account identifier and request counts/windows, not your API key or trade contents.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Export, deletion, and contact</h2>
      <p className="mt-2 text-sm leading-6">
        You can export trades from the journal and use the account menu to request permanent deletion of your Firebase account and its Firestore records. Deletion requires a recent sign-in. Browser-only settings and keys are removed from the device where deletion is completed; clear them separately from any other browser or device. If deletion reports an error, the request did not confirm completion.
      </p>
      <p className="mt-2 text-sm leading-6">
        This is a product privacy summary, not legal advice. The site operator should add a monitored privacy contact and review this notice for the laws and regions that apply before inviting the public.
      </p>
    </main>
  );
}
