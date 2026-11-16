import DonateCard from "./DonateCard";

export default function SupportView({ standalone = false }: { standalone?: boolean }) {
  const title = "Help keep the journal running";
  return (
    <section className="journal-page support-page py-8" aria-labelledby="support-page-title">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0b63b6]">Optional support</p>
        {standalone ? (
          <h1 id="support-page-title" className="mt-2 text-3xl font-bold tracking-tight text-[#37352f] sm:text-4xl">{title}</h1>
        ) : (
          <h2 id="support-page-title" className="mt-2 text-3xl font-bold tracking-tight text-[#37352f] sm:text-4xl">{title}</h2>
        )}
        <p className="mt-4 text-base leading-7 text-[#5a5957]">
          If Memecoin Journal has been useful to you, you can help cover its hosting and continued development with an optional SOL donation.
        </p>
      </header>

      <div className="mt-8 max-w-5xl">
        <DonateCard />
      </div>
    </section>
  );
}
