"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, Select } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ORIGENS, SERVICOS, SITUACOES, type Servico, type Situacao } from "@/lib/rotulos";
import { chamar } from "@/lib/chamar";
import { formatProtocolo } from "@/lib/utils";
import { criarLead } from "@/app/(painel)/acoes";

/** Lead que chegou por fora do site (telefone, indicação, evento): mesmas regras do formulário. */
export function NovoLead({ aberto, setAberto }: { aberto: boolean; setAberto: (v: boolean) => void }) {
  const router = useRouter();
  const [servicos, setServicos] = React.useState<Servico[]>([]);
  const [erro, setErro] = React.useState<string>();
  const [enviando, setEnviando] = React.useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const elemento = e.currentTarget;
    const form = new FormData(elemento);
    setEnviando(true);
    setErro(undefined);
    const r = await chamar(criarLead({
      nome: String(form.get("nome") ?? ""), email: String(form.get("email") ?? ""), whatsapp: String(form.get("whatsapp") ?? ""),
      empresa: String(form.get("empresa") ?? ""), servicos, situacao_atual: String(form.get("situacao") ?? "") as Situacao | "",
      dor: String(form.get("dor") ?? ""), origem: String(form.get("origem") ?? ""),
    }));
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    const numero = (r.dados as { numero?: number } | undefined)?.numero;
    toast.success(numero ? `Lead ${formatProtocolo(numero)} criado` : "Lead criado", { description: "Aparece na caixa de entrada; a equipe foi avisada." });
    elemento.reset();
    setAberto(false);
    setServicos([]);
    router.refresh();
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={setAberto}
      title="Novo lead"
      description="Para pedidos que chegaram por telefone, indicação ou evento."
      footer={
        <>
          <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
          <Button variant="primary" type="submit" form="form-novo-lead" disabled={enviando}>{enviando ? "Criando…" : "Criar lead"}</Button>
        </>
      }
    >
      <form id="form-novo-lead" onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2"><Label htmlFor="nl-nome">Nome</Label><Input id="nl-nome" name="nome" required autoFocus /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="nl-email">E-mail</Label><Input id="nl-email" name="email" type="email" required /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="nl-whats">WhatsApp</Label><Input id="nl-whats" name="whatsapp" placeholder="(11) 98765-4321" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="nl-empresa">Empresa</Label><Input id="nl-empresa" name="empresa" /></div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nl-origem">Como chegou</Label>
          <Select id="nl-origem" name="origem" defaultValue="indicacao">
            {Object.entries(ORIGENS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </Select>
        </div>
        <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
          <legend className="mb-1.5 text-xs font-medium text-fg-muted">O que precisa</legend>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(SERVICOS) as Servico[]).map((s) => {
              const on = servicos.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setServicos(on ? servicos.filter((x) => x !== s) : [...servicos, s])}
                  className={cn(
                    "h-7 rounded-full border px-3 text-xs transition-colors",
                    on ? "border-accent bg-accent-soft text-fg" : "border-border text-fg-muted hover:border-border-strong",
                  )}
                >
                  {SERVICOS[s]}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="nl-situacao">Como resolve hoje</Label>
          <Select id="nl-situacao" name="situacao" defaultValue="">
            <option value="">Não informado</option>
            {Object.entries(SITUACOES).filter(([k]) => k !== "nao_informado").map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="nl-dor">O que está custando mais tempo ou dinheiro</Label>
          <Textarea id="nl-dor" name="dor" maxLength={1200} required />
        </div>
        {erro && <p role="alert" className="text-sm text-danger sm:col-span-2">{erro}</p>}
      </form>
    </Dialog>
  );
}
