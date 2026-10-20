import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";
import { caminhoInterno } from "@/lib/redirect";

// Link do e-mail (recuperação de senha) → sessão → próxima página (só caminhos internos)
export async function GET(req: NextRequest) {
  const origem = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const proximo = caminhoInterno(req.nextUrl.searchParams.get("proximo"), origem);
  if (!code) return NextResponse.redirect(new URL("/login", origem));
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?link=expirado", origem));
  return NextResponse.redirect(new URL(proximo, origem));
}
