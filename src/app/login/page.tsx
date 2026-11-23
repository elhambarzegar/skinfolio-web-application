import { googleEnabled } from "@/auth";
import { authErrorMessage } from "@/lib/authErrors";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <LoginForm googleEnabled={googleEnabled} initialError={authErrorMessage(error)} />;
}
