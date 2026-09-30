import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use | Memecoin Journal",
  description: "The terms that apply when you use Memecoin Journal.",
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

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#fbfbfa] px-5 py-10 text-[#37352f] sm:px-8 sm:py-14">
      <article className="mx-auto max-w-4xl rounded-2xl border border-[#e9e9e7] bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-12">
        <nav aria-label="Legal navigation" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Link href="/" className="font-medium text-[#2383e2] hover:underline">Memecoin Journal</Link>
          <span aria-hidden="true" className="text-[#9b9a97]">/</span>
          <Link href="/privacy" className="text-[#787774] hover:text-[#2383e2] hover:underline">Privacy Notice</Link>
        </nav>

        <header className="mt-8 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2383e2]">Legal</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Terms of Use</h1>
          <p className="mt-4 text-base leading-7 text-[#5a5957]">
            These Terms govern your use of Memecoin Journal. Please read them before creating an account or using the service.
          </p>
          <p className="mt-4 text-xs text-[#787774]">Last updated: {LAST_UPDATED}</p>
        </header>

        <aside className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4" aria-label="Risk notice">
          <h2 className="text-sm font-semibold text-amber-900">Important risk notice</h2>
          <p className="mt-1 text-sm leading-6 text-amber-800">
            Memecoin Journal is a journaling and analytics tool. It is not a broker, exchange, wallet, custodian, or investment adviser. Crypto assets, especially memecoins, can lose all of their value.
          </p>
        </aside>

        <div className="mt-10">
          <Section id="agreement" title="1. Agreement and operator">
            <p>These Terms are an agreement between you and Philippe.A, operating from Belgium (“we”, “us”, or “Memecoin Journal”). By accessing or using the service, you agree to these Terms and the <Link className="font-medium text-[#2383e2] hover:underline" href="/privacy">Privacy Notice</Link>.</p>
            <p>If you do not agree, do not use the service. You must be legally able to enter into this agreement and meet the minimum age required to use online services where you live.</p>
          </Section>

          <Section id="service" title="2. What the service does">
            <p>Memecoin Journal lets you record trades, review performance, manage journal rules and goals, and optionally request AI-generated trading-journal feedback. The service does not place trades, hold assets, connect to your wallet for signing, or control your funds.</p>
            <p>Market information, token lookups, wallet-balance results, charts, and calculations may be delayed, incomplete, or inaccurate. You are responsible for independently verifying information before acting on it.</p>
          </Section>

          <Section id="no-advice" title="3. No financial, legal, tax, or investment advice">
            <p>Nothing in the service, including AI output, token information, charts, analytics, alerts, or journal calculations, is financial, investment, legal, tax, or other professional advice. It is provided for informational and personal record-keeping purposes only.</p>
            <p>We do not recommend any asset, strategy, transaction, or trading decision, and do not promise profitability or any particular outcome. You make every trading decision at your own risk and should obtain independent professional advice where appropriate.</p>
          </Section>

          <Section id="account" title="4. Your account and responsibilities">
            <ul className="list-disc space-y-1 pl-5 marker:text-[#2383e2]">
              <li>Provide accurate account information and keep your credentials and device secure.</li>
              <li>Use only an account you are authorized to use and promptly report suspected unauthorized access.</li>
              <li>Keep your own exports of records you may need; do not rely on the service as your sole recordkeeping system.</li>
              <li>Enter only information you own or have permission to use.</li>
              <li>Never enter seed phrases, recovery phrases, private keys, passwords, or other credentials.</li>
            </ul>
          </Section>

          <Section id="acceptable-use" title="5. Acceptable use">
            <p>You may not use the service to:</p>
            <ul className="list-disc space-y-1 pl-5 marker:text-[#2383e2]">
              <li>Break the law, infringe another person&apos;s rights, or upload harmful or unlawful content.</li>
              <li>Attempt to gain unauthorized access, disrupt the service, scrape it at scale, bypass rate limits, or probe security controls.</li>
              <li>Use automated systems that create an unreasonable load on the service.</li>
              <li>Misrepresent the service as financial advice, an exchange, a wallet, or an affiliated product.</li>
            </ul>
            <p>We may suspend or end access when reasonably necessary to protect users, the service, or our legal obligations.</p>
          </Section>

          <Section id="your-content" title="6. Your content and journal data">
            <p>You retain ownership of the trade records, notes, screenshots, and other content you submit. You grant us a limited, non-exclusive right to process that content only as needed to operate, secure, and improve the features you request.</p>
            <p>You are responsible for your content&apos;s accuracy, legality, and any rights needed to submit it. We do not claim ownership of your trades or use them to train public AI models.</p>
          </Section>

          <Section id="ai" title="7. Optional AI features and third-party services">
            <p>AI features are optional and require your own compatible API key. When you request a review, selected reduced trade information and any question you submit are sent to the provider you choose. The provider&apos;s terms, pricing, availability, and privacy practices apply to that request.</p>
            <p>AI output can be incorrect, incomplete, or unsuitable for your situation. Do not rely on it as professional advice or as a basis for trading without independent review. You are responsible for all charges, limits, and permissions associated with your own API key.</p>
          </Section>

          <Section id="availability" title="8. Availability, changes, and backups">
            <p>The service is provided on an “as available” basis. We may update, limit, suspend, or discontinue features, including third-party integrations, when reasonably necessary. We will try to avoid unnecessary disruption, but do not guarantee uninterrupted, error-free, or permanent availability.</p>
            <p>You should regularly export your journal data. We are not responsible for losses caused by outages, third-party services, network failures, or your failure to keep a backup.</p>
          </Section>

          <Section id="liability" title="9. Disclaimers and limitation of liability">
            <p>To the maximum extent permitted by applicable law, the service and all content are provided without warranties of any kind, whether express, implied, or statutory. This includes warranties of accuracy, fitness for a particular purpose, non-infringement, availability, and merchantability.</p>
            <p>To the maximum extent permitted by applicable law, Philippe.A will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for trading losses, lost profits, lost data, or loss of goodwill arising from your use of the service. Nothing in these Terms excludes liability that cannot legally be excluded or limited.</p>
          </Section>

          <Section id="termination" title="10. Ending your use and deleting your account">
            <p>You may stop using the service at any time. Before deleting your account, export any journal records you want to keep. The account menu provides a permanent account-deletion flow that removes your Firebase sign-in and cloud journal data after recent re-authentication.</p>
            <p>We may end or restrict access where necessary for security, misuse, legal compliance, or to protect the service. Sections that by their nature should survive termination, including disclaimers, liability limits, and dispute provisions, will survive.</p>
          </Section>

          <Section id="law" title="11. Belgian law and disputes">
            <p>These Terms are governed by the laws of Belgium, excluding conflict-of-law rules, unless mandatory law in your country of residence gives you stronger protection. Any dispute will be submitted to the competent courts of Belgium, subject to any mandatory consumer-protection rules that give you a different right.</p>
          </Section>

          <Section id="changes-contact" title="12. Changes and contact">
            <p>We may update these Terms to reflect changes to the service, security, or law. The current version will be posted here with a revised “Last updated” date. Continuing to use the service after an update means you accept the updated Terms, except where applicable law requires another form of notice or consent.</p>
            <p>Questions about these Terms can be sent to <a className="font-medium text-[#2383e2] hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
          </Section>
        </div>

        <footer className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#e9e9e7] pt-6 text-xs text-[#787774]">
          <span>© {new Date().getFullYear()} Philippe.A · Memecoin Journal</span>
          <Link href="/privacy" className="font-medium text-[#2383e2] hover:underline">Read the Privacy Notice</Link>
        </footer>
      </article>
    </main>
  );
}
