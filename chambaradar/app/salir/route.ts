import { NextResponse } from "next/server";
import { supabaseConfigurado, supabaseSesion } from "@/lib/supabase/servidor";
import { urlSitio } from "@/lib/sitio";

export async function POST() {
  if (supabaseConfigurado()) await (await supabaseSesion()).auth.signOut();
  return NextResponse.redirect(`${urlSitio()}/`, 303);
}
