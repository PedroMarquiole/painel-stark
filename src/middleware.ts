import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLICAS = ["/login", "/redefinir-senha", "/auth/callback"];

export async function middleware(req: NextRequest) {
  if (process.env.PAINEL_OFFLINE === "1" && process.env.NODE_ENV !== "production") return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        lista.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  // Renova a sessão a cada requisição (não remover: mantém o login vivo)
  const { data } = await supabase.auth.getUser();
  const publica = PUBLICAS.some((p) => req.nextUrl.pathname.startsWith(p));

  if (!data.user && !publica) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("voltar", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  // Quem já está logado e abre /login é tratado na própria página (conta ativa → painel;
  // conta desativada → aviso). Redirecionar daqui criaria um laço com o layout do painel.
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|logo-simbolo.svg|manifest.webmanifest|favicon.ico).*)"],
};
