#!/usr/bin/env python3
"""
Carrega no Supabase um recorte dos dados abertos de CNPJ da Receita Federal.

Recorte: estabelecimentos ATIVOS, dos estados em UFS, com CNAE principal nos
prefixos de CNAES, com telefone ou e-mail, e que NÃO são MEI.

Uso (o robô do GitHub roda isso uma vez por mês):
  SUPABASE_DB_URL=postgresql://... UFS=MG python3 scripts/carregar-cnpj.py

Só usa a biblioteca padrão + o comando psql.
"""
import csv, io, os, re, subprocess, sys, tempfile, unicodedata, urllib.request, zipfile

BASE = os.environ.get("CNPJ_BASE", "https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/")
UFS = {u.strip().upper() for u in os.environ.get("UFS", "MG").split(",") if u.strip()}
# Saúde · Comércio e alimentação · Serviços (prefixos do CNAE principal)
CNAES = tuple(os.environ.get("CNAES", ",".join([
    "863", "864", "865", "7500", "9602",                      # saúde, estética, veterinária
    "47", "1091102", "561", "562",                            # varejo, padaria, restaurantes
    "6911", "6920", "682", "9313", "85", "5510", "5590", "4520", "9601",  # serviços
])).split(","))
MAX_LINHAS = int(os.environ.get("MAX_LINHAS", "900000"))
DB = os.environ.get("SUPABASE_DB_URL")
csv.field_size_limit(10_000_000)


def log(*a):
    print(*a, flush=True)


def baixar(nome, pasta, destino):
    url = pasta + nome
    log(f"baixando {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "PainelStark/1.0"})
    with urllib.request.urlopen(req, timeout=600) as r, open(destino, "wb") as f:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b)
    return destino


def linhas_zip(caminho):
    with zipfile.ZipFile(caminho) as z:
        for nome in z.namelist():
            with z.open(nome) as f:
                yield from csv.reader(io.TextIOWrapper(f, encoding="latin-1", newline=""), delimiter=";", quotechar='"')


def pasta_mais_recente():
    html = urllib.request.urlopen(urllib.request.Request(BASE, headers={"User-Agent": "PainelStark/1.0"}), timeout=60).read().decode("utf-8", "ignore")
    meses = sorted(set(re.findall(r'href="(\d{4}-\d{2})/"', html)))
    if not meses:
        sys.exit("Não achei as pastas mensais da Receita em " + BASE)
    return BASE + meses[-1] + "/"


def sem_acento(t):
    return "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn").lower().strip()


def tel(ddd, numero):
    d = re.sub(r"\D", "", (ddd or "") + (numero or ""))
    d = d.lstrip("0")
    if len(d) == 10 and d[2] in "6789":  # celular antigo sem o 9
        d = d[:2] + "9" + d[2:]
    if len(d) == 11:
        return f"({d[:2]}) {d[2:7]}-{d[7:]}"
    if len(d) == 10:
        return f"({d[:2]}) {d[2:6]}-{d[6:]}"
    return None


def titulo(t):
    t = re.sub(r"\s+", " ", t or "").strip()
    return t.title() if t.isupper() else t


def main():
    if not DB and not os.environ.get("SECO"):
        sys.exit("Defina SUPABASE_DB_URL (connection string do Supabase).")
    pasta = pasta_mais_recente()
    log("pasta:", pasta, "| estados:", ",".join(sorted(UFS)))
    tmp = tempfile.mkdtemp()

    # Municípios: código → nome
    mun = {}
    for r in linhas_zip(baixar("Municipios.zip", pasta, os.path.join(tmp, "m.zip"))):
        if len(r) >= 2:
            mun[r[0]] = titulo(r[1])

    # 1) Estabelecimentos do recorte
    cand = {}
    for i in range(10):
        arq = baixar(f"Estabelecimentos{i}.zip", pasta, os.path.join(tmp, "e.zip"))
        for r in linhas_zip(arq):
            if len(r) < 28 or r[19] not in UFS or r[5] != "02" or not r[11].startswith(CNAES):
                continue
            t1, t2 = tel(r[21], r[22]), tel(r[23], r[24])
            email = (r[27] or "").strip().lower() or None
            if email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
                email = None
            if not (t1 or t2 or email):
                continue
            cnpj = r[0] + r[1] + r[2]
            rua = " ".join(x for x in [r[13], r[14]] if x).strip()
            cand[cnpj] = {
                "basico": r[0], "nome": titulo(r[4]), "cnae": r[11], "uf": r[19], "municipio": mun.get(r[20], r[20]),
                "bairro": titulo(r[17]) or None, "endereco": titulo(", ".join(x for x in [rua, r[15]] if x)) or None,
                "cep": r[18] or None, "telefone": t1 or t2, "telefone2": t2 if t1 else None, "email": email,
                "abertura": f"{r[10][:4]}-{r[10][4:6]}-{r[10][6:8]}" if re.match(r"^\d{8}$", r[10] or "") and r[10] != "00000000" else None,
            }
        os.remove(arq)
        log(f"  Estabelecimentos{i}: {len(cand)} no recorte até agora")
    basicos = {c["basico"] for c in cand.values()}

    # 2) Tira MEI
    mei = set()
    arq = baixar("Simples.zip", pasta, os.path.join(tmp, "s.zip"))
    for r in linhas_zip(arq):
        if len(r) >= 5 and r[0] in basicos and r[4] == "S":
            mei.add(r[0])
    os.remove(arq)
    cand = {k: v for k, v in cand.items() if v["basico"] not in mei}
    basicos = {c["basico"] for c in cand.values()}
    log(f"sem MEI: {len(cand)}")
    if len(cand) > MAX_LINHAS:
        sys.exit(f"Recorte grande demais ({len(cand)} > {MAX_LINHAS}). Diminua CNAES ou UFS.")

    # 3) Razão social e porte
    emp = {}
    for i in range(10):
        arq = baixar(f"Empresas{i}.zip", pasta, os.path.join(tmp, "x.zip"))
        for r in linhas_zip(arq):
            if len(r) >= 6 and r[0] in basicos:
                emp[r[0]] = (titulo(r[1]), int(r[5]) if r[5].isdigit() else None)
        os.remove(arq)

    # 4) Carrega
    saida = os.path.join(tmp, "empresas.csv")
    with open(saida, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        for cnpj, c in cand.items():
            razao, porte = emp.get(c["basico"], (None, None))
            w.writerow([cnpj, c["nome"] or razao or cnpj, razao, c["cnae"], c["uf"], c["municipio"], sem_acento(c["municipio"]),
                        c["bairro"], c["endereco"], c["cep"], c["telefone"], c["telefone2"], c["email"], c["abertura"], porte])
    if os.environ.get("SECO"):
        log(f"SECO: {len(cand)} linhas em {saida}"); print(open(saida, encoding="utf-8").read()); return
    ufs_sql = ",".join(f"'{u}'" for u in sorted(UFS))
    sql = f"""
\\set ON_ERROR_STOP on
begin;
create temp table carga (like public.empresas_cnpj including defaults) on commit drop;
\\copy carga (cnpj, nome, razao, cnae, uf, municipio, municipio_norm, bairro, endereco, cep, telefone, telefone2, email, abertura, porte) from '{saida}' with (format csv)
insert into public.empresas_cnpj select * from carga
  on conflict (cnpj) do update set nome = excluded.nome, razao = excluded.razao, cnae = excluded.cnae, uf = excluded.uf,
    municipio = excluded.municipio, municipio_norm = excluded.municipio_norm, bairro = excluded.bairro, endereco = excluded.endereco,
    cep = excluded.cep, telefone = excluded.telefone, telefone2 = excluded.telefone2, email = excluded.email,
    abertura = excluded.abertura, porte = excluded.porte, carregado_em = current_date;
-- quem saiu do recorte (fechou, virou MEI…) sai da base
delete from public.empresas_cnpj e where e.uf in ({ufs_sql}) and not exists (select 1 from carga c where c.cnpj = e.cnpj);
commit;
analyze public.empresas_cnpj;
select uf, count(*) as empresas, pg_size_pretty(pg_total_relation_size('public.empresas_cnpj')) as tamanho from public.empresas_cnpj group by uf;
"""
    subprocess.run(["psql", DB, "-v", "ON_ERROR_STOP=1", "-f", "-"], input=sql.encode(), check=True)
    log("pronto.")


if __name__ == "__main__":
    main()
