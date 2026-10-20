// Provedor de WhatsApp atrás de uma interface: trocar = mudar WHATSAPP_PROVIDER.

export interface WhatsAppProvider {
  readonly nome: string;
  enviarTexto(para: string, texto: string): Promise<{ id: string }>;
}

class Nenhum implements WhatsAppProvider {
  readonly nome = "none";
  enviarTexto(): Promise<{ id: string }> {
    return Promise.reject(new Error("whatsapp_desligado: nenhum provedor configurado"));
  }
}

/** WhatsApp Cloud API (Meta). Fora da janela de 24h, a Meta exige template aprovado. */
class CloudApi implements WhatsAppProvider {
  readonly nome = "cloud_api";
  constructor(private token: string, private phoneId: string) {}
  async enviarTexto(para: string, texto: string) {
    const r = await fetch(`https://graph.facebook.com/v21.0/${this.phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: para.replace(/^\+/, ""), type: "text", text: { body: texto } }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`cloud_api ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
    return { id: j?.messages?.[0]?.id ?? "" };
  }
}

export function whatsappProvider(env: (k: string) => string | undefined): WhatsAppProvider {
  switch (env("WHATSAPP_PROVIDER") ?? "none") {
    case "cloud_api":
      return new CloudApi(env("WHATSAPP_TOKEN") ?? "", env("WHATSAPP_PHONE_NUMBER_ID") ?? "");
    // "zapi" e "evolution" entram quando houver contrato
    default:
      return new Nenhum();
  }
}
