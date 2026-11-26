import type { Metadata } from "next";
import { BRAND, LEGAL } from "@/lib/brand";
import { Bullets, LegalPage, Section } from "@/components/legal-page";

export const metadata: Metadata = { title: `Privacy Policy · ${BRAND.name}` };

export default function PrivacyPage() {
  const mail = (
    <a href={`mailto:${LEGAL.contactEmail}`} className="underline underline-offset-4">
      {LEGAL.contactEmail}
    </a>
  );
  return (
    <LegalPage title="Privacy Policy">
      <div className="callout c-sky">
        <h2>The short version</h2>
        <ul className="flex list-outside list-disc flex-col gap-2 pl-6 text-[19px]">
          <li>We keep what you give us so your routine works. That includes things about your skin, which is sensitive.</li>
          <li>We don&rsquo;t sell your information, and there are no ads or tracking.</li>
          <li>An AI service reads your details to build and check your routine.</li>
          <li>You can download or permanently delete everything yourself, any time, from <b>Me</b>.</li>
        </ul>
      </div>

      <Section title="Who we are">
        <p>
          {BRAND.name} is run by {LEGAL.operator}. Questions about your information? Write to {mail}.
        </p>
      </Section>

      <Section title="What we keep">
        <Bullets
          items={[
            <>
              <b>Your account:</b> your email, your name, your time zone, and (if you sign in with Google) your Google profile
              picture. If you use a password, we keep only a scrambled version of it that nobody can read back.
            </>,
            <>
              <b>Your skin details:</b> your concerns, the description of your skin in your own words, and your answers about
              your experience and preferences. This is health-related, so we treat it with extra care.
            </>,
            <>
              <b>Your shelf and routine:</b> the products you own (including prescribed ones and what you wrote about how
              to use them), your routine, the changes you approved, and your answers to suggestions.
            </>,
            <>
              <b>Your progress:</b> which steps were due each day and which you ticked off.
            </>,
            <>
              <b>Your skin check-ins:</b> what you write about how your skin feels, and any safety flag it raised.
            </>,
            <>
              <b>Label photos:</b> when you photograph an ingredient label, we read the ingredient text from it. The photo
              itself is not saved; only the text is.
            </>,
            <>
              <b>Technical basics:</b> a cookie that keeps you signed in, and the usual records our hosting keeps of requests.
            </>,
          ]}
        />
      </Section>

      <Section title="Why we use it">
        <p>
          To run the app: to build and check your routine, show your shelf and progress, and warn you when something in your
          check-ins needs a doctor. We also use counts of recent actions to keep the service fair (there is a daily limit
          per account). We don&rsquo;t use your information for advertising or to profile you.
        </p>
      </Section>

      <Section title="AI and other services that see your information">
        <Bullets
          items={[
            <>
              <b>Anthropic (the AI).</b> To build and check your routine, we send its API your concerns, your skin
              description, your products and their ingredients, your routine, your check-in text, and the label photos you
              choose to add. To look up a product&rsquo;s ingredients we also send the product&rsquo;s brand and name to
              its web search. Anthropic&rsquo;s terms for API customers say this data is not used to train its models by
              default. See{" "}
              <a href="https://www.anthropic.com/legal/privacy" className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">
                Anthropic&rsquo;s privacy policy
              </a>
              .
            </>,
            <>
              <b>Google,</b> only if you choose &ldquo;Continue with Google&rdquo;. We receive your name, email address,
              profile picture and whether Google has confirmed the address.
            </>,
            <>
              <b>Open Beauty Facts,</b> a public product database. We send it product brands and names to look up ingredients.
              No personal information goes with them.
            </>,
            <>
              <b>Our hosting and database providers,</b> who store the app and its data for us and are not allowed to use it
              for anything else.
            </>,
          ]}
        />
        <p>We don&rsquo;t sell your information or share it with advertisers.</p>
      </Section>

      <Section title="The shared ingredient library">
        <p>
          Your own label photo is used for your routine only. When at least three different people&rsquo;s photos of the same
          product agree on what&rsquo;s in it, that ingredient list is added to the shared library, so everyone gets a more
          accurate list. The shared list contains only ingredients. It says nothing about who took the photos, and nobody can
          see who contributed.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          For as long as you have an account. When you delete your account, your account, skin details, shelf, routines,
          progress, check-ins and label-photo records are deleted right away. Our database provider may keep backup copies
          for a short while afterwards (usually a few weeks) before they are erased. A shared ingredient list that was already
          agreed stays, because it describes a product, not you.
        </p>
      </Section>

      <Section title="Your choices">
        <Bullets
          items={[
            <>
              <b>Download your data:</b> <b>Me</b>, then <b>My data and account</b>. You get a file with everything we hold,
              except your password.
            </>,
            <>
              <b>Delete everything:</b> the same place. It is permanent.
            </>,
            <>
              <b>Change your details:</b> redo your intake from <b>Me</b>, or change your shelf and routine in the app.
            </>,
            <>
              <b>Anything else,</b> including correcting information or asking a question: write to {mail}. Depending on where
              you live (for example the EU, UK, Canada or California) you may have further rights, including to object to how
              we use your information or to complain to your privacy regulator. We&rsquo;ll respect them.
            </>,
          ]}
        />
      </Section>

      <Section title="Keeping it safe">
        <p>
          Connections are encrypted, passwords are stored scrambled, and access to the data is limited. No service is perfectly
          secure, so please use a password you don&rsquo;t use anywhere else. If you think your account has been misused, write
          to {mail}.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          One cookie keeps you signed in, and the app can&rsquo;t work without it. We use no analytics and no advertising or
          tracking cookies.
        </p>
      </Section>

      <Section title="Who it&rsquo;s for">
        <p>
          {BRAND.name} is for people aged 18 and over. We don&rsquo;t knowingly collect information from anyone younger. If you
          think a child has an account, write to {mail} and we&rsquo;ll remove it.
        </p>
      </Section>

      <Section title="This is not medical care">
        <p>
          {BRAND.name} is a planning tool, not a healthcare provider. Please see the{" "}
          <a href="/terms" className="underline underline-offset-4">Terms of Use</a> for what it can and can&rsquo;t do.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          If we change this policy in a way that matters, we&rsquo;ll tell you before it takes effect, for example by email or a notice in the app. The date at
          the top always shows when it was last updated.
        </p>
      </Section>
    </LegalPage>
  );
}
