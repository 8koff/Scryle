import type { Metadata } from "next";
import Link from "next/link";
import { BRAND, MAX_SWAPS_PER_PICTURE } from "@retrofit/core";
import { ContactEmail, LegalPage, operatorName, type LegalSection } from "@/components/legal/legal-page";
import { REVIEW_HOURS } from "@/lib/reports";

export const metadata: Metadata = { title: `Terms · ${BRAND.name}` };

const sections: LegalSection[] = [
  {
    id: "service",
    title: "What this service is",
    body: (
      <p>
        {BRAND.name} lets you take a photo of a room, a car, yourself or something else, pick parts to swap, and see an
        AI-made picture of your photo with those parts changed (a &ldquo;picture&rdquo;). {BRAND.name} is run by {operatorName}{" "}
        (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By using it you agree to these terms.
      </p>
    ),
  },
  {
    id: "who",
    title: "Who can use it",
    body: (
      <ul>
        <li>You must be 18 or older.</li>
        <li>The service is made for people in the United States. Prices are in US dollars.</li>
        <li>
          One account per person. You sign in with Apple or with a code we send to your email, so keep those accounts safe.
        </li>
      </ul>
    ),
  },
  {
    id: "photos",
    title: "Your photos: what you may upload",
    body: (
      <>
        <p>Only use photos you have the right to use. In particular:</p>
        <ul>
          <li>Clothing try-on only works with a live photo of yourself, taken in the app. Do not use it on anyone else.</li>
          <li>The other categories are for things, not people. They refuse photos with a person in them.</li>
          <li>If other people can be seen in a photo, you need their permission.</li>
          <li>No photos of anyone under 18, no nudity, and no swimwear or underwear swaps.</li>
          <li>Nothing illegal, hateful, or meant to deceive or harass someone.</li>
        </ul>
        <p>
          We never change a person&rsquo;s face or body shape on purpose. A safety filter may block a picture. We may remove
          content or close accounts that break these rules.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    title: "How your photo is processed",
    body: (
      <>
        <p>
          To find what you can swap and make your picture, your photo is sent to AI partners that work for us. In the
          iPhone app we ask you before your first scan, and nothing is sent until you tap <strong>Allow</strong>. If you
          say no, you can&rsquo;t scan photos.
        </p>
        <p>
          Who our AI partners are, what they receive, how long they keep your photo and what you can delete are in the{" "}
          <Link href="/privacy#ai" className="font-semibold text-accent-ink underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    id: "renders",
    title: "What our pictures are, and are not",
    body: (
      <>
        <p>
          Every picture we make is made by AI to give you an idea of how something could look. It is not a photo of the real
          product and may get colour, size, fit or detail wrong.
        </p>
        <p>
          Always check the seller&rsquo;s details before you buy. For car parts, check with a professional that a part fits
          your car and is legal where you drive.
        </p>
      </>
    ),
  },
  {
    id: "plans",
    title: "Plans, swaps and auto-renewal",
    body: (
      <ul>
        <li>
          Making pictures needs a plan. There is no free picture and no free trial. There are three plans,{" "}
          <strong>Starter</strong>, <strong>Plus</strong> and <strong>Pro</strong>, each paid monthly or yearly. The plans
          screen shows each plan&rsquo;s price and how many swaps it gives before you buy.
        </li>
        <li>
          Each new picture uses one swap, and one picture can change up to {MAX_SWAPS_PER_PICTURE} items at once.
        </li>
        <li>
          <strong>Your swaps reset every month</strong>, counted from the day your plan started. Swaps you don&rsquo;t use
          in a month don&rsquo;t carry over to the next one. A yearly plan also gives its swaps month by month, not all at
          once.
        </li>
        <li>
          <strong>Plans renew automatically</strong> at the end of each month or year, at the price you agreed to, until you
          cancel. If the price of your plan goes up, you&rsquo;ll be told before you pay the new price.
        </li>
        <li>
          If you move to a bigger plan, it starts at once and this month&rsquo;s swaps go up to the new amount. A smaller
          plan starts at your next renewal.
        </li>
        <li>
          In the iPhone app you pay with your Apple ID through Apple. On the website, payments are handled by Stripe. We use
          RevenueCat to keep track of subscriptions, so one plan works in both places. We never see or store your card
          number.
        </li>
        <li>If a picture fails or the safety filter blocks it, you get that swap back automatically.</li>
        <li>
          Free pictures and packs from before plans started can&rsquo;t be used anymore.
        </li>
      </ul>
    ),
  },
  {
    id: "cancel",
    title: "Cancelling, and no refunds",
    body: (
      <ul>
        <li>
          <strong>You can cancel at any time.</strong> If you subscribed in the iPhone app, cancel in your iPhone&rsquo;s
          Settings › your name › Subscriptions (the app&rsquo;s Account screen links there). If you subscribed on the
          website, cancel from your account on the website.
        </li>
        <li>
          Cancel at least 24 hours before your plan renews to avoid the next payment. After you cancel, your plan and its
          swaps keep working until the end of the month or year you paid for, then stop.
        </li>
        <li>
          <strong>All payments are final.</strong> We don&rsquo;t give refunds for the rest of a month or year, or for swaps
          you didn&rsquo;t use, except where the law requires it. Refunds for plans bought in the iPhone app are decided by
          Apple under Apple&rsquo;s own rules.
        </li>
        <li>
          If a payment is refunded, reversed or disputed (by Apple or by Stripe), the plan it paid for ends and that
          month&rsquo;s unused swaps are removed.
        </li>
        <li>
          Deleting the app or closing your {BRAND.name} account doesn&rsquo;t cancel an Apple subscription. Cancel it in
          Settings first.
        </li>
      </ul>
    ),
  },
  {
    id: "shopping",
    title: "Shopping links",
    body: (
      <>
        <p>
          We show products from other stores and link to them. The store sells the product, not us: its prices, stock,
          shipping and returns are its own and can change. Items marked as samples are examples and aren&rsquo;t for sale.
        </p>
        <p>
          Most products come from a live search of online stores. We show the price the store listed when we found it,
          and we don&rsquo;t check every listing. A picture shows how the product might look in your photo; the real
          product can look different.
        </p>
        <p>We may earn a commission when you buy through our links. It doesn&rsquo;t change your price.</p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Share links",
    body: (
      <p>
        When you make a share link, anyone who has the link can see that before and after picture. You can delete a link at
        any time from its page.
      </p>
    ),
  },
  {
    id: "reports",
    title: "Reporting a picture",
    body: (
      <>
        <p>
          Every share page has a <strong>Report this picture</strong> link. Anyone can use it, with or without an account.
        </p>
        <ul>
          <li>We check every report within {REVIEW_HOURS} hours.</li>
          <li>If a report says a picture is sexual or shows someone under 18, we hide it at once, before we check it.</li>
          <li>We remove pictures that break these terms, and we may close the account that made them.</li>
        </ul>
      </>
    ),
  },
  {
    id: "ownership",
    title: "Who owns what",
    body: (
      <>
        <p>
          Your photos stay yours. You let us store and process them, and the pictures made from them, so we can run the
          service for you (for example, to show them in My pictures and on share links you make).
        </p>
        <p>
          You may use your pictures for your own purposes, including posting them. If you post one, don&rsquo;t hide that it
          was made by AI. If you send a share link to the gallery, you let us show it on our home page until you take it
          out. The app, its design and its code belong to us.
        </p>
      </>
    ),
  },
  {
    id: "rules",
    title: "Things you may not do",
    body: (
      <ul>
        <li>Try to get around limits, for example by sharing one plan between people or making extra accounts.</li>
        <li>Copy, scrape or resell the service, or try to break or overload it.</li>
        <li>Use it to make pictures that mislead people about a real person.</li>
      </ul>
    ),
  },
  {
    id: "liability",
    title: "Our responsibility",
    body: (
      <>
        <p>
          We work hard to keep the service running, but we provide it &ldquo;as is&rdquo;, without promises that it will
          always work or that pictures will be accurate.
        </p>
        <p>
          As far as the law allows, we are not responsible for indirect losses, and our total responsibility to you is
          limited to what you paid us in the 12 months before the problem.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes and ending",
    body: (
      <p>
        We may change these terms. If a change matters, we will tell you on the site, in the app or by email before it
        applies. You can stop using the service at any time and close your account from the account menu. Swaps you
        haven&rsquo;t used are lost when you do, and an Apple subscription keeps running until you cancel it (see
        &ldquo;Cancelling&rdquo; above).
      </p>
    ),
  },
  {
    id: "law",
    title: "Law",
    body: (
      <p>
        These terms are governed by the laws of the United States and of the state where {operatorName} is based. If you
        live in a state whose laws give you rights that a contract can&rsquo;t take away, you keep those rights.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions or account problems: write to <ContactEmail />. How we handle your data is in the{" "}
        <Link href="/privacy" className="font-semibold text-accent-ink underline-offset-4 hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      intro={<p>The rules for using {BRAND.name}, in plain words.</p>}
      sections={sections}
    />
  );
}
