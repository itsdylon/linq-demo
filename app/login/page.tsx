import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSession } from "@/lib/auth";
import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return (
    <main className="page-shell flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--foreground-soft)]">
            Thread
          </p>
          <CardTitle className="serif text-4xl font-medium">
            Sign in to the operator dashboard.
          </CardTitle>
          <CardDescription>
            Use the shared password configured in your deployment environment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={loginAction} className="space-y-4">
            <input
              type="hidden"
              name="next"
              value={params.next ?? "/dashboard"}
            />
            <label
              className="space-y-2 text-sm font-medium text-[var(--foreground)]"
              htmlFor="login-password"
            >
              <span>Password</span>
              <Input
                autoFocus
                id="login-password"
                name="password"
                required
                type="password"
              />
            </label>
            {params.error ? (
              <p className="rounded-2xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
                That password did not match the configured dashboard password.
              </p>
            ) : null}
            <Button className="w-full" type="submit">
              Enter dashboard
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
