"use server";

import { redirect } from "next/navigation";
import { createAuthenticatedServerClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createAuthenticatedServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
