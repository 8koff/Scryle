import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@retrofit/core";
import { ContactEmail, LegalPage, operatorName, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: `Privacy · ${BRAND.name}` };

/** Days we take to answer a request to see or delete your data. */
const ANSWER_DAYS = 30;
/** Anthropic deletes what we send within this many days (its commercial API terms, checked 2026-10-11). */
const ANTHROPIC_DELETE_DAYS = 30;

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
          <strong>Your photos and pictures</strong>: the photos you take or upload, the pictures made from them, and what you
          chose to swap.
        </li>
        <li>
          <strong>Your plan</strong>: which plan you have, when it started, renews or ends, how many swaps you used this
          month, and the purchase reference from Apple (iPhone app) or Stripe (website). Apple or Stripe handles your card;
          we never see the card number.
        </li>
        <li>
          <strong>Your AI choice in the iPhone app</strong>: that you tapped Allow before your first scan, when, and which
          version of the notice you saw. On the website, you allow each scan and we don&rsquo;t save that choice to your account.
        </li>
        <li>
          <strong>Invites</strong>: your invite code, and who invited you.
        </li>
        <li>
          <strong>Reports</strong>: what you write when you report a picture, and your email if you give it.
        </li>
        <li>
          <strong>Waitlist</strong>: if you join the waitlist, your email address, and where you found the link if the
          link says so.
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
        <li>To read your photo, make your pictures and keep them in My pictures.</li>
        <li>To run your plan: take payments, renew it, and give you your swaps each month.</li>
        <li>To keep the service safe: limits, the safety filter, checking reports, and stopping misuse.</li>
        <li>We don&rsquo;t use your photos to train AI.</li>
        <li>To answer you when you write to us.</li>
        <li>If you joined the waitlist: to email you when your early access is ready. Nothing else.</li>
      </ul>
    ),
  },
  {
    id: "ai",
    title: "Your photos and AI",
    body: (
      <>
        <p>
          {BRAND.name} works by sending your photo to two AI companies. In the iPhone app we ask you before your first scan,
          and nothing is sent until you tap <strong>Allow</strong>. On the website, you check a box to allow each scan;
          Clothing also asks you to confirm you&rsquo;re 18 or older. If you say no, you can still use your account, but
          you can&rsquo;t scan photos.
        </p>
        <ul>
          <li>
            <strong>What is sent</strong>: the photo you take or pick, and for a swap, the product pictures and the parts you
            chose. Not your name or your email.
          </li>
          <li>
            <strong>Anthropic</strong> (Claude) reads your photo to find the parts you can swap. Under its terms for
            businesses, it deletes what we send within {ANTHROPIC_DELETE_DAYS} days (longer only if its safety systems flag
            it or the law requires it), and it doesn&rsquo;t train its models on it.
          </li>
          <li>
            <strong>Higgsfield</strong> stores your photo while it&rsquo;s read, and makes the picture when you swap. It
            keeps its copies, and the finished picture, at unlisted web links for a limited time under its own terms. Anyone
            who has the exact link could open them. We can&rsquo;t delete those copies.
          </li>
          <li>
            <strong>Why</strong>: only to read your photo and make the pictures you ask for. Neither company may use your
            photo for anything else for us, and we never use your photos to train AI.
          </li>
          <li>
            <strong>Changing your mind</strong>: write to <ContactEmail /> and we&rsquo;ll turn it off, or close your account.
            If we add another AI company or use your photo in a new way, we&rsquo;ll ask you again first.
          </li>
        </ul>
      </>
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
            <strong>Higgsfield</strong> and <strong>Anthropic</strong>: the AI companies described{" "}
            <a href="#ai" className="font-semibold text-accent-ink underline-offset-4 hover:underline">
              above
            </a>
            .
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
            <strong>RevenueCat</strong>: keeps track of subscriptions for the iPhone app and the website, so one plan works
            in both. It receives your account number (not your name), your plan and its purchase history, and on the website
            your email for the receipt.
          </li>
          <li>
            <strong>Stripe</strong>: payments on the website.
          </li>
          <li>
            <strong>Apple</strong>: payments in the iPhone app. Apple tells us (through RevenueCat) which plan you bought,
            when it renews, and if it was cancelled or refunded. It doesn&rsquo;t tell us your Apple ID or card.
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
        <li>Your photos and pictures stay in your account until you close it.</li>
        <li>Share links stay up until you delete them, or until we remove them after a report.</li>
        <li>
          If you scan without making a picture, we don&rsquo;t keep the photo ourselves. Only the AI companies&rsquo; copies
          described in &ldquo;Your photos and AI&rdquo; exist.
        </li>
        <li>
          If you close your account, we delete your photos, pictures, share links, plan history, your AI choice and invite
          details. Apple, Stripe and RevenueCat keep their own payment records, as tax law requires. Closing your account
          doesn&rsquo;t cancel an Apple subscription: cancel it in your iPhone&rsquo;s Settings.
        </li>
        <li>Reports are kept as a record of what we checked and removed.</li>
        <li>
          Waitlist emails are kept until you ask us to take yours off. Write to <ContactEmail /> for that.
        </li>
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
        Connections are encrypted. Your saved pictures are in private storage and are only shown to you through links that
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
      intro={
        <p>
          What we collect, why, and what you can do about it. Short version: we send your photos to two AI companies to make
          your pictures (only after you allow it), keep them for you, and never sell them.
        </p>
      }
      sections={sections}
    />
  );
}
