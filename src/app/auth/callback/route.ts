import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";

// Link do e-mail (recuperação de senha / convite) → sessão → próxima página
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const proximo = req.nextUrl.searchParams.get("proximo") ?? "/";
  if (code) {
    const supabase = await supabaseServidor();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(proximo.startsWith("/") ? proximo : "/", req.url));
}
