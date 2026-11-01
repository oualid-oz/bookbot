import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy policy · Bookbot',
  description: 'What Bookbot and the Bookbot Chrome extension collect, and how it is used.',
};

// Set NEXT_PUBLIC_SUPPORT_EMAIL to show a contact address
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
const UPDATED = 'November 1, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16 leading-relaxed [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_li]:text-muted-foreground">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy policy</h1>
        <p>Last updated {UPDATED}</p>
      </div>

      <p>
        This policy explains what Bookbot (the website and app) and the Bookbot Chrome extension collect, why, and what
        you can do about it. We don&apos;t sell your data, show ads, or use tracking or analytics cookies.
      </p>

      <Section title="Your account">
        <ul className="flex flex-col gap-1">
          <li>Your name and email address, and a securely hashed password if you sign up with one. We never see or store your password itself.</li>
          <li>If you sign in with Google: your name, email and profile picture from your Google account.</li>
          <li>A sign-in cookie that keeps you logged in. It is necessary for the app to work and isn&apos;t used for tracking.</li>
        </ul>
      </Section>

      <Section title="What you create">
        <p>
          Projects, book listings, puzzles, cover designs, images you upload, exported PDFs, and the keywords, niches and
          books you research or save. They are stored so you can use them, and are visible only to you.
        </p>
      </Section>

      <Section title="The Chrome extension">
        <p>The extension only runs on Amazon store pages. When you view search results or a book&apos;s page there, it reads public product details shown on the page:</p>
        <ul className="flex flex-col gap-1">
          <li>the book&apos;s ASIN, Best Sellers Rank and category, price, and number of reviews;</li>
          <li>its title, only when you click to save the book to Bookbot.</li>
        </ul>
        <p>
          These details are sent to Bookbot, with the access token you created, to calculate sales estimates and to save
          books you choose. The extension does not read or send the addresses of pages you visit, your browsing history,
          your Amazon account, orders, or anything you type. Your access token is stored in your browser&apos;s
          extension storage, and you can revoke it at any time from Settings → Extension.
        </p>
      </Section>

      <Section title="Payments">
        <p>
          Subscriptions are handled by Stripe. Your card details go directly to Stripe and never reach our servers; we
          keep only your subscription status and plan. Stripe&apos;s use of your data is covered by{' '}
          <a href="https://stripe.com/privacy" className="underline" target="_blank" rel="noreferrer">Stripe&apos;s privacy policy</a>.
        </p>
      </Section>

      <Section title="Emails">
        <p>
          We send only the emails you need: verifying your address, and resetting or changing your password. We
          don&apos;t send marketing email.
        </p>
      </Section>

      <Section title="Who can see your data">
        <p>
          Only you. Our service providers (hosting, file storage, email delivery and Stripe) process data only to run
          Bookbot. We disclose data only when the law requires it.
        </p>
      </Section>

      <Section title="Deleting your data">
        <p>
          You can delete your account at any time from <Link href="/settings/account" className="underline">Settings → Account</Link>.
          This permanently deletes your account and everything in it, including uploaded images and exported files.
          Uninstalling the extension removes the token stored in your browser.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          If this policy changes, we will update the date above.
          {SUPPORT_EMAIL && (
            <>
              {' '}Questions or requests: <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>.
            </>
          )}
        </p>
      </Section>
    </main>
  );
}
