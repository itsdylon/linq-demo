"use server";

import { redirect } from "next/navigation";
import { setSessionCookie } from "@/lib/auth";
import { getDashboardEnv } from "@/lib/env";

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (password !== getDashboardEnv().DASHBOARD_PASSWORD) {
    redirect(`/login?error=invalid-password&next=${encodeURIComponent(next)}`);
  }

  await setSessionCookie();
  redirect(next || "/dashboard");
}
