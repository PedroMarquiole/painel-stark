// HTML simples e legível em qualquer cliente de e-mail. O texto vem dos templates do banco.

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const linkify = (s: string) => s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#D9440F">$1</a>');

export function emailHtml(corpo: string, opts: { equipe?: boolean } = {}) {
  const paragrafos = esc(corpo)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${linkify(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F3EEE5;padding:24px 12px">
<div style="max-width:560px;margin:0 auto;background:#FDFAF5;border:1px solid #E2D9CA;border-radius:12px;padding:28px 28px 16px;font-family:Inter,Arial,sans-serif;font-size:15px;color:#1F1A14">
${paragrafos}
<p style="margin:20px 0 0;padding-top:14px;border-top:1px solid #E2D9CA;font-size:12px;color:#635A4E">${
    opts.equipe ? "Aviso automático do Painel Stark." : "Stark — Software sob medida"
  }</p></div></body></html>`;
}

export function emailTexto(corpo: string) {
  return corpo;
}
