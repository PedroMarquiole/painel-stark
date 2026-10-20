import type { Resultado } from "@/lib/dados/tipos";

/** Chama uma server action sem deixar falha de rede derrubar a tela: vira { ok: false } com mensagem. */
export async function chamar<T>(p: Promise<Resultado<T>>): Promise<Resultado<T>> {
  try {
    return await p;
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor. Tente de novo." };
  }
}
