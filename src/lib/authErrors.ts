/** Plain-language message for an ?error= code that Auth.js sends back to the login page. */
export function authErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "AccessDenied") {
    return "Google couldn't confirm that email address, so we couldn't sign you in. Try another Google account, or use your email.";
  }
  return "Google sign-in didn't work this time. Please try again, or use your email instead.";
}
