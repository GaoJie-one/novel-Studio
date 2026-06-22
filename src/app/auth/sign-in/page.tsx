import { AuthPage } from "@/components/auth-page";

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  return <AuthPage mode="sign-in" redirectTo={redirectTo} />;
}
