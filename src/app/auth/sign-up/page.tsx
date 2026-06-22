import { AuthPage } from "@/components/auth-page";

export default async function SignUpPage({
  searchParams
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  return <AuthPage mode="sign-up" redirectTo={redirectTo} />;
}
