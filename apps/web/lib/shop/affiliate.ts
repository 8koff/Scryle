/**
 * Every outbound shop link goes through here, so it carries our referral tag.
 * - Amazon links get our Associates tag (AMAZON_ASSOCIATE_TAG).
 * - Other stores go through Skimlinks (SKIMLINKS_PUBLISHER_ID), which turns almost any store
 *   link into a paid one. Check the link format against your Skimlinks account before launch.
 * Without either setting, links go to the store unchanged.
 */
export type AffiliateConfig = { amazonTag?: string; skimlinksId?: string };

export function affiliateConfigFromEnv(env: Record<string, string | undefined> = process.env): AffiliateConfig {
  const amazonTag = env.AMAZON_ASSOCIATE_TAG?.trim();
  const skimlinksId = env.SKIMLINKS_PUBLISHER_ID?.trim();
  return {
    ...(amazonTag && /^[\w-]{1,64}$/.test(amazonTag) ? { amazonTag } : {}),
    ...(skimlinksId && /^\d{1,20}X?\d*$/i.test(skimlinksId) ? { skimlinksId } : {}),
  };
}

const AMAZON = /(^|\.)amazon\.com$/i;

/** The link to send a shopper to, or null if the store link isn't a safe https link. */
export function affiliateUrl(buyUrl: string, config: AffiliateConfig): string | null {
  let url: URL;
  try {
    url = new URL(buyUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;

  if (AMAZON.test(url.hostname)) {
    if (config.amazonTag) url.searchParams.set("tag", config.amazonTag);
    return url.toString();
  }
  if (config.skimlinksId) {
    return `https://go.skimresources.com/?id=${encodeURIComponent(config.skimlinksId)}&xs=1&url=${encodeURIComponent(url.toString())}`;
  }
  return url.toString();
}
