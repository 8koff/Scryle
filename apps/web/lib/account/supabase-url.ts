/** The project address. Accepts the API form people often copy ("…supabase.co/rest/v1/") too. */
export function supabaseProjectUrl(raw: string | undefined): string | undefined {
  const url = raw?.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
  return url || undefined;
}
