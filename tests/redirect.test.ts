import { describe, expect, it } from "vitest";
import { caminhoInterno } from "@/lib/redirect";

const O = "https://painel.stark.dev";
describe("caminhoInterno", () => {
  it.each([
    ["/leads?id=1", "/leads?id=1"],
    ["/redefinir-senha", "/redefinir-senha"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["/\t/evil.com", "/"],
    ["/\n/evil.com", "/"],
    ["https://evil.com/x", "/"],
    ["javascript:alert(1)", "/"],
    ["", "/"],
    [null, "/"],
    ["leads", "/leads"],
  ])("%j → %s", (entrada, saida) => expect(caminhoInterno(entrada, O)).toBe(saida));
});
