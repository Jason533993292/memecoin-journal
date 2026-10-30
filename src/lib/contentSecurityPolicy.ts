const DEPLOYED_SUPABASE_ORIGINS = [
  "https://tndqtaouizztihzggwnh.supabase.co",
  "https://klyrrvdoxgriclmbpqoi.supabase.co",
];

function supabaseConnectOrigins(configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  const origins = new Set(DEPLOYED_SUPABASE_ORIGINS);
  try {
    const configured = new URL(configuredUrl || "");
    if (configured.protocol === "https:" && /^[a-z0-9-]+\.supabase\.co$/.test(configured.hostname)) {
      origins.add(configured.origin);
    }
  } catch {
    // A missing or malformed optional URL must not broaden the policy.
  }
  return [...origins].join(" ");
}

export function buildContentSecurityPolicy(
  nonce: string,
  options: { development?: boolean; supabaseUrl?: string } = {}
) {
  const scripts = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(options.development ?? process.env.NODE_ENV === "development" ? ["'unsafe-eval'"] : []),
    "https://www.google.com",
    "https://apis.google.com",
    "https://www.recaptcha.net",
    "https://www.gstatic.com",
  ].join(" ");

  return `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src ${scripts}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; frame-src 'self' https://www.google.com https://apis.google.com https://www.recaptcha.net https://memecoin-journal.firebaseapp.com; connect-src 'self' ${supabaseConnectOrigins(options.supabaseUrl)} https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebaseinstallations.googleapis.com https://api.dexscreener.com https://www.google.com https://apis.google.com https://www.recaptcha.net https://recaptchaenterprise.googleapis.com https://content-firebaseappcheck.googleapis.com`;
}
