export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-[#37352f]">
      <h1 className="text-3xl font-bold">Privacy</h1>
      <p className="mt-4 text-sm leading-6">MemeCoin Journal stores your account, trades, notes, and screenshots in Firebase under your user ID. Your journal data is not shared with other users.</p>
      <h2 className="mt-8 text-xl font-semibold">AI coach</h2>
      <p className="mt-2 text-sm leading-6">AI provider API keys are stored locally in your browser and sent only to the provider you select when you request an analysis. They are not stored in our Firestore database.</p>
      <h2 className="mt-8 text-xl font-semibold">Your choices</h2>
      <p className="mt-2 text-sm leading-6">You can export your journal data and request deletion of your account and associated data. Do not enter secrets into trade notes or screenshots.</p>
    </main>
  );
}
