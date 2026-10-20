/**
 * Destino de redirecionamento seguro: só caminhos deste próprio site.
 * Valida pela origem resolvida (não por prefixo): "//x.com", "/\\x.com" e "/\t/x.com"
 * começam com "/" mas o parser de URL leva para outro domínio.
 */
export function caminhoInterno(destino: string | null | undefined, origem: string, padrao = "/"): string {
  if (!destino) return padrao;
  try {
    const base = new URL(origem);
    const u = new URL(destino, base);
    if (u.origin !== base.origin) return padrao;
    return u.pathname + u.search;
  } catch {
    return padrao;
  }
}
