import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@retrofit/core";
import { ContactEmail, LegalPage, operatorName, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: `Privacy · ${BRAND.name}` };

/** Days we take to answer a request to see or delete your data. */
const ANSWER_DAYS = 30;

const sections: LegalSection[] = [
  {
    id: "collect",
    title: "What we collect",
    body: (
      <ul>
        <li>
          <strong>Your email address</strong>, to sign you in and to write to you about your account.
        </li>
        <li>
          <strong>Your photos and swaps</strong>: the photos you take or upload, the swaps made from them, and what you
          chose to swap.
        </li>
        <li>
          <strong>Purchases</strong>: which pack you bought, the price and Stripe&rsquo;s payment reference. Stripe handles
          your card; we never see the card number.
        </li>
        <li>
          <strong>Invites</strong>: your invite code, and who invited you, so we can give both of you the free swaps.
        </li>
        <li>
          <strong>Reports</strong>: what you write when you report a picture, and your email if you give it.
        </li>
        <li>
          <strong>Technical data</strong>: to stop abuse we count requests per visitor. We store the IP address only as a
          scrambled code and delete those counts after a day. Our host keeps normal server logs.
        </li>
        <li>
          <strong>In your browser</strong>: your sign-in session and the photo you are working on (for one day). We use no
          advertising or tracking cookies.
        </li>
      </ul>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>To read your photo, make your swaps and keep them in My swaps.</li>
        <li>To take payments and give you the swaps you bought.</li>
        <li>To keep the service safe: limits, the safety filter, checking reports, and stopping misuse.</li>
        <li>We don&rsquo;t use your photos to train AI.</li>
        <li>To answer you when you write to us.</li>
      </ul>
    ),
  },
  {
    id: "share",
    title: "Who we share it with",
    body: (
      <>
        <p>We don&rsquo;t sell your data, and we don&rsquo;t share it for advertising. These companies help us run the service:</p>
        <ul>
          <li>
            <strong>Supabase</strong>: accounts, our database and file storage.
          </li>
          <li>
            <strong>Higgsfield</strong>: makes the swaps. It receives your photo and the product pictures. It keeps its
            copies, and the finished swap, at unlisted web links for a limited time under its own terms. Anyone who has
            the exact link could open them. We can&rsquo;t delete those copies.
          </li>
          <li>
            <strong>Anthropic</strong> (Claude): reads your photo to find the parts you can swap. Under its terms for
            businesses, Anthropic doesn&rsquo;t train its models on what we send.
          </li>
          <li>
            <strong>Google</strong>: when you open the camera, your browser downloads a small object-finding model from
            Google&rsquo;s servers, so Google sees your IP address. The camera picture stays on your device for that step.
          </li>
          <li>
            <strong>SerpApi</strong>: finds store products for the part you pick. It receives the search words: the kind
            of part (for a car, its make, model and year) and any words you type. It never receives your photo, your email
            or your IP address. The product pictures come from Google Shopping.
          </li>
          <li>
            <strong>Stripe</strong>: payments.
          </li>
          <li>
            <strong>Vercel</strong>: hosts the website.
          </li>
        </ul>
        <p>
          When you make a share link, anyone with the link can see that before and after picture. If you send a link to the
          gallery and we approve it, its pictures are shown on our home page until you take it out.
        </p>
        <p>
          Shop links take you to the store&rsquo;s own site, where its privacy policy applies. The link may tell the store
          that you came from us, so we can earn a commission. We may also share data if the law requires it.
        </p>
      </>
    ),
  },
  {
    id: "keep",
    title: "How long we keep it",
    body: (
      <ul>
        <li>Your photos and swaps stay in your account for as long as you have it, so you keep what you paid for.</li>
        <li>Share links stay up until you delete them, or until we remove them after a report.</li>
        <li>If you scan without making a swap, we don&rsquo;t keep the photo ourselves. Only the partner copies above exist.</li>
        <li>
          If you close your account, we delete your photos, swaps, share links, purchase history and invite details.
          Stripe keeps its own payment records, as tax law requires.
        </li>
        <li>Reports are kept as a record of what we checked and removed.</li>
      </ul>
    ),
  },
  {
    id: "choices",
    title: "Your choices",
    body: (
      <>
        <p>
          You can delete any share link from its page. You can close your account at any time: open the account menu and
          tap <strong>Delete account</strong>. That deletes everything in it. Write to <ContactEmail /> to get a copy of your
          data or to correct it. We answer within {ANSWER_DAYS} days. Some US states give you
          extra rights; we honour them for everyone.
        </p>
      </>
    ),
  },
  {
    id: "safety",
    title: "Keeping it safe",
    body: (
      <p>
        Connections are encrypted. Your saved swaps are in private storage and are only shown to you through links that
        stop working after an hour. Share links, and the Higgsfield copies described above, are at unlisted public links.
        Only our servers can read the database.
      </p>
    ),
  },
  {
    id: "age",
    title: "Age",
    body: <p>{BRAND.name} is only for people 18 and older. We don&rsquo;t knowingly collect data from anyone younger.</p>,
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: (
      <p>
        If we change this policy in a way that matters, we will tell you on the site or by email first. {BRAND.name} is run
        by {operatorName}. Questions: <ContactEmail />. See also the{" "}
        <Link href="/terms" className="font-semibold text-accent-ink underline-offset-4 hover:underline">
          Terms
        </Link>
        .
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro={<p>What we collect, why, and what you can do about it. Short version: we use your photos to make your swaps, keep them for you, and never sell them.</p>}
      sections={sections}
    />
  );
}
