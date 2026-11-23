import { googleEnabled } from "@/auth";
import { SignupForm } from "./signup-form";

// Rendered per request so the Google button reflects the server's live settings,
// not whatever they were when the app was built.
export const dynamic = "force-dynamic";

export default function SignupPage() {
  return <SignupForm googleEnabled={googleEnabled} />;
}
