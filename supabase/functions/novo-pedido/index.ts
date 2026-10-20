// Recebe o formulário de pedido do site da Stark (endereço mantido do painel anterior).
// Pública de propósito (verify_jwt = false): quem valida e aplica os limites é registrar_lead,
// no banco, numa transação só. A chave de serviço nunca sai daqui.
import { createClient } from "npm:@supabase/supabase-js@2";
import { cors, json, sha256 } from "../_shared/http.ts";
import { erroDoBanco, normalizarPedido } from "../_shared/pedido.ts";

const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
if (ALLOWED.length === 0) console.warn("ALLOWED_ORIGINS vazio: aceitando qualquer origem");
const ORIGENS = ALLOWED.length ? ALLOWED : ["*"];
const SALT = Deno.env.get("IP_HASH_SALT") ?? "";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  const h = cors(req, ORIGENS);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405, h);

  const raw = await req.text();
  if (raw.length > 16_000) return json({ erro: "grande_demais", mensagem: "Mensagem grande demais." }, 413, h);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ erro: "json", mensagem: "Pedido inválido." }, 400, h);
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "";
  const r = normalizarPedido(body, {
    ipHash: ip ? (await sha256(SALT + ip)).slice(0, 32) : undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
    idempotencia: req.headers.get("idempotency-key") ?? undefined,
  });

  if (r.tipo === "isca") return json({ ok: true, numero: 0 }, 200, h);
  if (r.tipo === "erro") return json({ erro: r.erro, campo: r.campo, mensagem: r.mensagem }, r.status, h);

  const { data, error } = await supabase.rpc("registrar_lead", { p: r.payload });
  if (error) {
    const e = erroDoBanco(error.message);
    if (e.erro === "interno") console.error("registrar_lead", error.message);
    return json({ erro: e.erro, campo: e.campo, mensagem: e.mensagem }, e.status, h);
  }

  // Contrato do site: { ok, numero }. "protocolo" já formatado para exibir (#0042).
  return json({ ok: true, numero: data.numero, protocolo: `#${String(data.numero).padStart(4, "0")}` }, 200, h);
});
