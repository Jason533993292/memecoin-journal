import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Notice | Memecoin Journal",
  description: "How Memecoin Journal collects, uses, stores, and protects personal data.",
};

const LAST_UPDATED = "30 September 2026";
const CONTACT_EMAIL = "orders@rewind-stores.com";

function Section({ id, title, children }: Readonly<{ id: string; title: string; children: React.ReactNode }>) {
  return (
    <section aria-labelledby={id} className="scroll-mt-8 border-t border-[#e9e9e7] py-8 first:border-t-0 first:pt-0">
      <h2 id={id} className="text-xl font-bold tracking-tight text-[#37352f]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-[#5a5957]">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#fbfbfa] px-5 py-10 text-[#37352f] sm:px-8 sm:py-14">
      <article className="mx-auto max-w-4xl rounded-2xl border border-[#e9e9e7] bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-12">
        <nav aria-label="Legal navigation" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Link href="/" className="font-medium text-[#2383e2] hover:underline">Memecoin Journal</Link>
          <span aria-hidden="true" className="text-[#9b9a97]">/</span>
          <Link href="/terms" className="text-[#787774] hover:text-[#2383e2] hover:underline">Terms of Use</Link>
        </nav>

        <header className="mt-8 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2383e2]">Legal</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Privacy Notice</h1>
          <p className="mt-4 text-base leading-7 text-[#5a5957]">
            This notice explains how Memecoin Journal handles personal data when you use the app. It is written for a private trading journal, not an advertising platform.
          </p>
          <p className="mt-4 text-xs text-[#787774]">Last updated: {LAST_UPDATED}</p>
        </header>

        <aside className="mt-8 rounded-xl border border-blue-100 bg-blue-50/70 p-4" aria-label="Privacy summary">
          <h2 className="text-sm font-semibold text-[#173f73]">In short</h2>
          <ul className="mt-2 grid gap-2 text-sm leading-6 text-[#28598f] sm:grid-cols-2">
            <li>Your journal is stored under your signed-in Firebase account.</li>
            <li>We do not sell personal data or run advertising in the app.</li>
            <li>AI reviews are optional and use the provider and key you choose.</li>
            <li>You can export your trades and permanently delete your account.</li>
          </ul>
        </aside>

        <div className="mt-10">
          <Section id="controller" title="1. Who is responsible for your data">
            <p>
              Philippe.A, operating from Belgium, is the data controller for Memecoin Journal. For privacy questions, access requests, or concerns, contact us at{" "}
              <a className="font-medium text-[#2383e2] hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
            <p>This notice applies to the app at memecoin-journal.vercel.app and its public Privacy and Terms pages. It does not control websites or services operated by third parties.</p>
          </Section>

          <Section id="data" title="2. Information we process">
            <dl className="overflow-hidden rounded-xl border border-[#e9e9e7] text-sm">
              <div className="grid gap-1 border-b border-[#e9e9e7] bg-[#fbfbfa] px-4 py-3 sm:grid-cols-[11rem_1fr] sm:gap-5">
                <dt className="font-semibold text-[#37352f]">Account data</dt><dd>Email address, Firebase user ID, sign-in provider, and the authentication information Firebase needs to run your account.</dd>
              </div>
              <div className="grid gap-1 border-b border-[#e9e9e7] px-4 py-3 sm:grid-cols-[11rem_1fr] sm:gap-5">
                <dt className="font-semibold text-[#37352f]">Journal data</dt><dd>Trades, outcomes, P&amp;L, strategy and psychology tags, notes, screenshots, rules, goals, and dates you choose to save.</dd>
              </div>
              <div className="grid gap-1 border-b border-[#e9e9e7] bg-[#fbfbfa] px-4 py-3 sm:grid-cols-[11rem_1fr] sm:gap-5">
                <dt className="font-semibold text-[#37352f]">Browser-only settings</dt><dd>Paper-capital settings, tracked wallet details, AI provider choice, AI key, and similar preferences stored in your browser profile.</dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr] sm:gap-5">
                <dt className="font-semibold text-[#37352f]">Technical data</dt><dd>Limited request, security, and rate-limit information needed to operate and protect the service.</dd>
              </div>
            </dl>
            <p>Do not enter seed phrases, private keys, recovery phrases, passwords, or other wallet secrets anywhere in the app.</p>
          </Section>

          <Section id="purpose" title="3. Why we use this information">
            <ul className="list-disc space-y-1 pl-5 marker:text-[#2383e2]">
              <li>To create and secure your account, display your journal, and calculate analytics you request.</li>
              <li>To store and synchronize saved trade records, rules, and goals.</li>
              <li>To provide optional token, price, and public wallet-balance lookups.</li>
              <li>To provide an optional AI review only after you choose a provider and make a request.</li>
              <li>To prevent abuse, troubleshoot reliability, and comply with applicable law.</li>
            </ul>
            <p>Where the GDPR applies, we process account and journal data to provide the service you request; process security data for our legitimate interest in protecting the service; and process optional AI requests when you choose to use that feature.</p>
          </Section>

          <Section id="storage" title="4. Where your data is stored">
            <p>Firebase Authentication manages sign-in. Cloud Firestore stores journal data under your Firebase user ID. The app&apos;s Firestore security rules are designed to restrict those records to the matching signed-in account.</p>
            <p>Some preferences are intentionally browser-only. These include your AI key and provider choice, paper-capital settings, and locally tracked wallet details. Browser storage is not an encrypted password manager: anyone with access to an unlocked browser profile may be able to read it.</p>
          </Section>

          <Section id="ai" title="5. AI coach and your API key">
            <p>The AI Coach is optional. Your key is stored in local browser storage, not Firestore. When you request an AI review, the app sends the key over HTTPS to its server and forwards it only to the provider you selected: DeepSeek, Google Gemini, or OpenAI. The service does not use a shared site-owned AI key.</p>
            <p>For an AI review, the app can process up to 100 recent trades to create a summary and forwards at most 15 reduced recent trade records plus any question you write. The forwarded sample can include token symbols, outcomes, P&amp;L, tags, and setup names. It excludes token addresses, wallet addresses, trade notes, and screenshots. We do not intentionally save API keys, full AI request bodies, or provider responses in Firestore or application logs.</p>
            <p>Each selected AI provider has its own privacy terms and retention practices. Review them before using the feature, and remove and revoke a key promptly if you believe it was exposed.</p>
          </Section>

          <Section id="sharing" title="6. Service providers and disclosures">
            <p>We use Google Firebase for authentication and Firestore, Vercel for hosting and server endpoints, public Solana RPC and market-data services when you request a lookup, and the AI provider you select when you ask for a review.</p>
            <p>These providers may process data in countries outside Belgium or the European Economic Area. Their handling of data is governed by their own terms, privacy notices, and applicable transfer safeguards. We may also disclose data where required to comply with law, enforce rights, or protect users and the service.</p>
            <p>We do not sell personal data, use it for behavioural advertising, or knowingly allow third parties to use it for their own marketing.</p>
          </Section>

          <Section id="retention" title="7. Retention and deletion">
            <p>Your account and journal data remain in Firebase while your account is active. You can export trades from the Trade Journal and use the account menu to permanently delete your Firebase account and its Firestore data. Deletion requires recent re-authentication to protect you from unauthorized requests.</p>
            <p>The deletion flow also clears this app&apos;s account-scoped local settings from the browser where you complete it. It cannot clear data from other browsers or devices, so remove AI keys and local settings there as well. Short service-security records may remain only as long as needed for security, legal, or operational purposes.</p>
          </Section>

          <Section id="rights" title="8. Your privacy rights and complaints">
            <p>Depending on applicable law, you may have rights to access, correct, delete, restrict, object to, or receive a portable copy of your personal data. You can correct journal records in the app, export trades from the Trade Journal, and delete your account from the account menu.</p>
            <p>For other requests, email <a className="font-medium text-[#2383e2] hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the email associated with your account, describing the request. We may ask for enough information to verify your identity. Where the GDPR applies, we aim to respond within one month unless a lawful extension is needed.</p>
            <p>If you are in Belgium or the EEA and believe your data-protection rights have not been respected, you may lodge a complaint with the <a className="font-medium text-[#2383e2] hover:underline" href="https://www.dataprotectionauthority.be/" rel="noreferrer">Belgian Data Protection Authority</a> or your local supervisory authority.</p>
          </Section>

          <Section id="security" title="9. Security, children, and changes">
            <p>We use reasonable technical measures intended to protect the service, including Firebase account controls, Firestore access rules, authenticated server endpoints, and rate limits. No online service can guarantee absolute security, so keep your sign-in credentials and devices secure.</p>
            <p>Memecoin Journal is not intended for children. Do not use the service if you are below the minimum age required to consent to online services where you live.</p>
            <p>We may update this notice as the service or legal requirements change. We will post the updated version here and revise the “Last updated” date. Material changes will be communicated through the service where reasonably practical.</p>
          </Section>
        </div>

        <footer className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#e9e9e7] pt-6 text-xs text-[#787774]">
          <span>© {new Date().getFullYear()} Philippe.A · Memecoin Journal</span>
          <Link href="/terms" className="font-medium text-[#2383e2] hover:underline">Read the Terms of Use</Link>
        </footer>
      </article>
    </main>
  );
}
