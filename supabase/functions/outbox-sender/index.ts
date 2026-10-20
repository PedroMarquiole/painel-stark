// Envia a fila mensagens_saida: e-mail (Resend) e WhatsApp (provedor configurável).
// Chamada pelo banco (pg_net, a cada minuto e logo após cada inserção) com x-cron-secret.
// Idempotência e nova tentativa ficam no banco (reservar_mensagens / concluir_mensagem).
import { createClient } from "npm:@supabase/supabase-js@2";
import { emailHtml } from "../_shared/email.ts";
import { igual, json } from "../_shared/http.ts";
import { whatsappProvider } from "../_shared/whatsapp.ts";

const env = (k: string) => Deno.env.get(k);
const supabase = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const whatsapp = whatsappProvider(env);
// Aceita também os nomes de segredo do painel anterior (MAIL_FROM)
const FROM = env("EMAIL_FROM") ?? env("MAIL_FROM") ?? "Stark <onboarding@resend.dev>";
const REPLY_TO = env("EMAIL_REPLY_TO");

type Msg = {
  id: string; canal: "email" | "whatsapp" | "push"; destino_tipo: "cliente" | "equipe";
  destinatario: string; assunto: string | null; corpo: string;
};

async function enviarEmail(m: Msg) {
  const chave = env("RESEND_API_KEY");
  if (!chave) throw new Error("RESEND_API_KEY ausente");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json", "Idempotency-Key": m.id },
    body: JSON.stringify({
      from: FROM,
      to: [m.destinatario],
      subject: m.assunto ?? "Stark",
      text: m.corpo,
      html: emailHtml(m.corpo, { equipe: m.destino_tipo === "equipe" }),
      ...(REPLY_TO && m.destino_tipo === "cliente" ? { reply_to: REPLY_TO } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`resend ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return { provider: "resend", id: String(j.id ?? "") };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);
  const segredo = env("CRON_SECRET") ?? "";
  if (!igual(segredo, req.headers.get("x-cron-secret") ?? "")) return json({ erro: "nao_autorizado" }, 401);

  // Sem provedor de e-mail configurado, a fila espera (não gasta tentativas)
  if (!env("RESEND_API_KEY")) return json({ enviadas: 0, aguardando: "RESEND_API_KEY" }, 200);

  const { data, error } = await supabase.rpc("reservar_mensagens", { p_limite: 20 });
  if (error) return json({ erro: error.message }, 500);

  // Opt-out não chega aqui: reservar_mensagens só pega pendentes e erros.
  const resultado = { enviadas: 0, falhas: 0 };
  for (const m of (data ?? []) as Msg[]) {
    try {
      const r =
        m.canal === "email"
          ? await enviarEmail(m)
          : m.canal === "whatsapp"
            ? { provider: whatsapp.nome, id: (await whatsapp.enviarTexto(m.destinatario, m.corpo)).id }
            : (() => { throw new Error(`canal ${m.canal} não suportado`); })();
      await supabase.rpc("concluir_mensagem", { p_id: m.id, p_ok: true, p_provider: r.provider, p_provider_id: r.id });
      resultado.enviadas++;
    } catch (e) {
      await supabase.rpc("concluir_mensagem", { p_id: m.id, p_ok: false, p_erro: String(e) });
      resultado.falhas++;
    }
  }
  return json(resultado, 200);
});
