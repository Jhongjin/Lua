"use server";

import { redirect } from "next/navigation";
import { createAuthenticatedServerClient } from "@/lib/supabase/server";

function safeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return "/review";
  }

  return value;
}

function redirectToLogin(nextPath: string, error: string): never {
  redirect(`/login?next=${encodeURIComponent(nextPath)}&error=${error}`);
}

export async function signInWithPassword(formData: FormData) {
  const nextPath = safeNextPath(formData.get("next"));
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    redirectToLogin(nextPath, "missing");
  }

  const supabase = await createAuthenticatedServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirectToLogin(nextPath, "auth");
  }

  redirect(nextPath);
}
