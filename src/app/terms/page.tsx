import type { Metadata } from "next";
import { BRAND, LEGAL } from "@/lib/brand";
import { Bullets, LegalPage, Section } from "@/components/legal-page";

export const metadata: Metadata = { title: `Terms of Use · ${BRAND.name}` };

export default function TermsPage() {
  const mail = (
    <a href={`mailto:${LEGAL.contactEmail}`} className="underline underline-offset-4">
      {LEGAL.contactEmail}
    </a>
  );
  return (
    <LegalPage title="Terms of Use">
      <div className="callout c-sky">
        <h2>The short version</h2>
        <ul className="flex list-outside list-disc flex-col gap-2 pl-6 text-[19px]">
          <li>{BRAND.name} is an independent planning tool. It is not medical care.</li>
          <li>It can be wrong. You decide what to use, and a doctor is the right person for any skin condition.</li>
          <li>It has no link to any brand or store and doesn&rsquo;t promote any.</li>
          <li>Be 18 or older, be honest, and don&rsquo;t misuse it.</li>
        </ul>
      </div>

      <Section title="Using these terms">
        <p>
          By creating an account or using {BRAND.name} you agree to these terms and to our{" "}
          <a href="/privacy" className="underline underline-offset-4">Privacy Policy</a>. If you don&rsquo;t agree, please
          don&rsquo;t use it. {BRAND.name} is run by {LEGAL.operator}.
        </p>
      </Section>

      <Section title="What Sagedew is, and isn&rsquo;t">
        <p>
          {BRAND.name} helps you make sense of the skincare products you own and work out which ones you actually need. It
          builds a routine from your products and goals, explains its reasons, and checks changes before you make them.
        </p>
        <p>
          It is <b>not</b> a doctor, a dermatologist or a medical device. It does not diagnose conditions, prescribe
          treatments, or replace professional advice. If something worries you, such as pain, bleeding, a spot that is
          changing, a rash that spreads, or a reaction to a product, stop using the product and see a qualified health
          professional. In an emergency, call your local emergency number.
        </p>
        <p>
          If you have a product prescribed by a health professional, follow their directions first. If they differ from
          anything in {BRAND.name}, theirs win.
        </p>
      </Section>

      <Section title="Independent, with nothing to sell">
        <p>
          {BRAND.name} is not owned by, paid by or connected to any skincare brand or store. We don&rsquo;t promote brands or
          products. Any shopping links are plain searches, not recommendations, and we earn nothing from them. If you buy
          something, that is between you and the store.
        </p>
      </Section>

      <Section title="The AI can be wrong">
        <p>
          Routines, checks and explanations are produced by an AI from the information you give and the ingredient lists we
          have. Ingredient lists can be out of date, incomplete or different between countries. The AI can make mistakes or
          miss things. Treat everything as a well-reasoned suggestion, not a guarantee, and do a patch test before using a new
          product, as the app reminds you.
        </p>
        <p>You are responsible for deciding what to put on your skin.</p>
      </Section>

      <Section title="Your account">
        <Bullets
          items={[
            "You must be at least 18.",
            "Give true information, and keep your password to yourself. You are responsible for what happens under your account.",
            "One person, one account.",
            "You can delete your account at any time from Me, and it is permanent.",
          ]}
        />
      </Section>

      <Section title="What you must not do">
        <Bullets
          items={[
            "Use the app to harm anyone, or for anything unlawful.",
            "Try to break, overload or get around the app, including its daily fair-use limits, or use bots or scripts.",
            "Upload anything that isn't an ingredient label photo, or anyone else's private information.",
            "Pretend to be someone else, or deliberately submit wrong ingredient lists to the shared library.",
          ]}
        />
      </Section>

      <Section title="Fair use">
        <p>
          Each account has daily limits on the things that use our AI (routine builds, routine checks, label photos, new
          products and check-ins). They are generous for normal use. If you reach one, it frees up again within 24 hours.
        </p>
      </Section>

      <Section title="Label photos and the shared library">
        <p>
          When you add a label photo, you give us permission to read the ingredient text from it and keep that text. Your photo
          is used for your own routine. If at least three different people&rsquo;s photos of a product agree, the ingredient
          list is added to the shared library for everyone. It contains only ingredients, and nothing that identifies you.
          Deleting your account removes your photo records, but an ingredient list already added to the shared library stays.
        </p>
      </Section>

      <Section title="Our work and yours">
        <p>
          {BRAND.name}&rsquo;s name, design and software belong to us. Your information stays yours. You allow us to use it
          only to run the service for you, as the Privacy Policy explains.
        </p>
      </Section>

      <Section title="If something goes wrong">
        <p>
          We work to keep {BRAND.name} available and accurate, but we can&rsquo;t promise it will always be, so it is provided
          &ldquo;as is&rdquo;. To the extent the law allows, we aren&rsquo;t responsible for losses from using or not being
          able to use the app, or from relying on its suggestions, and nothing here limits any rights you have by law that
          can&rsquo;t be limited. We may change, pause or stop the service, and we may close an account that breaks these
          terms.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          If we change these terms in a way that matters, we&rsquo;ll tell you before it takes effect, for example by email or
          a notice in the app. Using {BRAND.name} after that means you accept the new terms. The date at the top shows when
          they were last updated.
        </p>
      </Section>

      <Section title="Contact">
        <p>Questions about these terms? Write to {mail}.</p>
      </Section>
    </LegalPage>
  );
}
