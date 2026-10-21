"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, Select } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { usePainel } from "@/components/painel/contexto";
import { chamar } from "@/lib/chamar";
import { CANAIS_PROSPECT, type CanalProspect } from "@/lib/rotulos";
import type { Prospect } from "@/lib/dados/tipos";
import { hojeSp } from "@/lib/prospeccao";
import { criarProspect, type DadosProspect } from "./acoes";

const VAZIO: DadosProspect = { empresa: "", pessoa: "", cargo: "", email: "", whatsapp: "", linkedin: "", instagram: "", site: "", cidade: "", segmento: "", porque: "", canal: "linkedin", origem: "" };

/** Cadastro rápido de uma empresa para abordar. Entra em "A abordar" com contato para hoje. */
export function NovoProspect({ aberto, setAberto, onCriado }: { aberto: boolean; setAberto: (o: boolean) => void; onCriado: (p: Prospect) => void }) {
  const { perfil, equipe } = usePainel();
  const [d, setD] = React.useState<DadosProspect>(VAZIO);
  const [resp, setResp] = React.useState(perfil.id);
  const ocupado = React.useRef(false);
  const [enviando, setEnviando] = React.useState(false);
  React.useEffect(() => { if (aberto) { setD(VAZIO); setResp(perfil.id); } }, [aberto, perfil.id]);
  const campo = (k: keyof DadosProspect) => ({
    value: String(d[k] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((x) => ({ ...x, [k]: e.target.value })),
  });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado.current) return;
    if (!d.empresa.trim()) return void toast.error("Informe a empresa.");
    ocupado.current = true;
    setEnviando(true);
    try {
      const dados = { ...d, origem: d.origem?.trim() || "Cadastro manual", responsavel_id: resp || null };
      const r = await chamar(criarProspect(dados));
      if (!r.ok) return void toast.error(r.erro);
      const t = (v?: string) => v?.trim() || null;
      onCriado({
        id: r.dados?.id ?? crypto.randomUUID(), empresa: d.empresa.trim(), pessoa: t(d.pessoa), cargo: t(d.cargo), email: t(d.email)?.toLowerCase() ?? null,
        whatsapp: t(d.whatsapp), linkedin: t(d.linkedin), instagram: t(d.instagram), site: t(d.site), cidade: t(d.cidade), segmento: t(d.segmento),
        porque: t(d.porque), canal: d.canal, origem: dados.origem, lista_id: null, lista_nome: null, responsavel_id: resp || null,
        situacao: "a_abordar", toques: 0, proximo_contato: hojeSp(), ultimo_contato_em: null, encerrado_em: null, motivo_encerramento: null,
        negocio_id: null, created_at: new Date().toISOString(), ultima_resposta: null,
      });
      toast.success(`${d.empresa.trim()} entrou em A abordar`);
      setAberto(false);
    } finally {
      ocupado.current = false;
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={setAberto}
      title="Nova empresa para abordar"
      description="Só a empresa é obrigatória. Entra na lista de hoje."
      className="max-w-xl"
      footer={<>
        <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
        <Button type="submit" form="novo-prospect" variant="primary" disabled={enviando}>{enviando ? "Salvando…" : "Adicionar"}</Button>
      </>}
    >
      <form id="novo-prospect" onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2"><Label htmlFor="np-empresa">Empresa</Label><Input id="np-empresa" required autoFocus {...campo("empresa")} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="np-pessoa">Pessoa</Label><Input id="np-pessoa" {...campo("pessoa")} placeholder="Quem decide" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="np-cargo">Cargo</Label><Input id="np-cargo" {...campo("cargo")} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="np-linkedin">LinkedIn</Label><Input id="np-linkedin" {...campo("linkedin")} placeholder="linkedin.com/in/…" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="np-whats">WhatsApp</Label><Input id="np-whats" inputMode="tel" {...campo("whatsapp")} placeholder="(11) 98765-4321" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="np-email">E-mail</Label><Input id="np-email" type="email" {...campo("email")} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="np-insta">Instagram</Label><Input id="np-insta" {...campo("instagram")} placeholder="@empresa" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="np-site">Site</Label><Input id="np-site" {...campo("site")} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="np-cidade">Cidade</Label><Input id="np-cidade" {...campo("cidade")} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="np-seg">Segmento</Label><Input id="np-seg" {...campo("segmento")} placeholder="Ex.: construtora" /></div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="np-canal">Canal para abordar</Label>
          <Select id="np-canal" className="h-9" value={d.canal} onChange={(e) => setD((x) => ({ ...x, canal: e.target.value as CanalProspect }))}>
            {(Object.keys(CANAIS_PROSPECT) as CanalProspect[]).map((c) => <option key={c} value={c}>{CANAIS_PROSPECT[c]}</option>)}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="np-resp">Responsável</Label>
          <Select id="np-resp" className="h-9" value={resp} onChange={(e) => setResp(e.target.value)}>
            {equipe.filter((x) => x.papel !== "projetos").map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2"><Label htmlFor="np-porque">Por que abordar</Label><Textarea id="np-porque" className="min-h-16" {...campo("porque")} placeholder="Ex.: site lento, lançou empreendimento novo" /></div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="np-origem">De onde veio o contato</Label>
          <Input id="np-origem" {...campo("origem")} placeholder="Ex.: indicação do João, evento Sinduscon" />
          <p className="text-xs text-fg-subtle">Guardamos a origem para responder se alguém perguntar como conseguimos o contato (LGPD).</p>
        </div>
      </form>
    </Dialog>
  );
}
