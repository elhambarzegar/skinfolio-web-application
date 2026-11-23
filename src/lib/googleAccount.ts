import { prisma } from "@/lib/prisma";

export type GoogleProfile = {
  email?: string | null;
  email_verified?: boolean | null;
  name?: string | null;
  picture?: string | null;
};

export type LinkResult =
  | { ok: true; userId: string; passwordRevoked: boolean }
  | { ok: false; reason: "unverified_email" };

/**
 * Finds or creates the account for someone who signed in with Google.
 *
 * Accounts are matched by email, and only when Google says it has verified
 * that address, because matching on an address nobody checked would let
 * anyone sign in as anyone.
 *
 * One consequence worth knowing: an email-and-password signup never proves
 * the person owns the address. So the first time Google verifies an address
 * that already has a password, that password is cleared. Otherwise someone
 * could register your address first, set their own password, and still be
 * let in to the account you later open with Google.
 */
export async function linkGoogleAccount(profile: GoogleProfile): Promise<LinkResult> {
  const email = profile.email?.trim().toLowerCase();
  if (!email || profile.email_verified !== true) {
    return { ok: false, reason: "unverified_email" };
  }

  const name = profile.name?.trim() || null;
  const image = profile.picture || null;

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    try {
      const created = await prisma.user.create({
        data: { email, name, image, emailVerified: new Date() },
      });
      return { ok: true, userId: created.id, passwordRevoked: false };
    } catch (err) {
      // Two first sign-ins can race; if the other one won, carry on with theirs.
      user = await prisma.user.findUnique({ where: { email } });
      if (!user) throw err;
    }
  }

  const passwordRevoked = user.passwordHash !== null && user.emailVerified === null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: user.name ?? name,
      image: user.image ?? image,
      emailVerified: user.emailVerified ?? new Date(),
      ...(passwordRevoked ? { passwordHash: null } : {}),
    },
  });

  return { ok: true, userId: user.id, passwordRevoked };
}
