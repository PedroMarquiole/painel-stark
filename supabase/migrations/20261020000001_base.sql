-- ════════════════════════════════════════════════════════════════════════════
-- Painel Stark · 0001 · Base: extensões, tipos, configuração, equipe, SLA
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists citext;
create extension if not exists pg_trgm;

-- ─── Tipos ──────────────────────────────────────────────────────────────────
create type public.papel_equipe as enum ('admin', 'comercial', 'projetos');

-- Serviços e situações do formulário do site (Passo 1). Rótulos ficam na UI.
create type public.servico as enum (
  'sistemas_web', 'aplicativo', 'automacao_ia', 'integracoes_apis',
  'dashboards', 'site_landing', 'loja_virtual', 'evoluir_existente'
);
create type public.situacao_atual as enum (
  'manual_whatsapp', 'planilhas', 'sistema_nao_atende', 'nao_existe'
);

create type public.etapa_negocio as enum (
  'novo', 'triagem', 'diagnostico', 'descoberta', 'proposta', 'negociacao', 'ganho', 'perdido'
);
create type public.motivo_perda as enum (
  'preco', 'prazo', 'sem_resposta', 'concorrente', 'fora_de_escopo', 'outro'
);
create type public.fase_projeto as enum ('descoberta', 'prototipo', 'desenvolvimento', 'lancamento');
create type public.canal as enum ('email', 'whatsapp', 'ligacao', 'reuniao', 'nota', 'sistema');
create type public.direcao as enum ('entrada', 'saida', 'interna');
create type public.complexidade as enum ('P', 'M', 'G');

-- ─── Configuração global (chave/valor, editável pelo admin) ─────────────────
create table public.app_config (
  chave text primary key,
  valor jsonb not null,
  descricao text,
  updated_at timestamptz not null default now()
);

insert into public.app_config (chave, valor, descricao) values
  ('dominio_permitido', '"stark.dev.br"', 'Domínio Google da agência; contas de fora entram inativas. [CONFIRMAR]'),
  ('sla_horas_uteis', '24', 'Promessa do site: retorno em até 1 dia útil'),
  ('sla_alerta_horas', '4', 'Abaixo disso o SLA fica "vencendo"'),
  ('horario_comercial', '{"inicio":"08:00","fim":"19:00","dias":[1,2,3,4,5]}', 'Janela para mensagens automáticas ao cliente'),
  ('fuso', '"America/Sao_Paulo"', null);

-- ─── Equipe ─────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null unique,
  nome text not null,
  papel public.papel_equipe not null default 'comercial',
  ativo boolean not null default false,
  avatar_url text,
  whatsapp text,
  capacidade_semanal_horas numeric(5,1) not null default 40,
  servicos_foco public.servico[] not null default '{}', -- usado na atribuição por tipo de serviço
  preferencias jsonb not null default '{}'::jsonb,       -- tema, densidade, widgets da home
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpers de autorização (security definer: leem profiles sem recursão de RLS)
create function public.papel_atual() returns public.papel_equipe
language sql stable security definer set search_path = public as $$
  select papel from public.profiles where id = auth.uid() and ativo
$$;

create function public.is_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and ativo)
$$;

create function public.tem_papel(variadic papeis public.papel_equipe[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.papel_atual() = any (papeis), false)
$$;

-- Novo login → perfil. Domínio da agência entra ativo; primeiro usuário vira admin.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  dominio text := (select valor #>> '{}' from public.app_config where chave = 'dominio_permitido');
  do_dominio boolean := split_part(new.email, '@', 2) = dominio;
begin
  insert into public.profiles (id, email, nome, avatar_url, ativo, papel)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    do_dominio,
    case when do_dominio and not exists (select 1 from public.profiles where papel = 'admin')
         then 'admin'::public.papel_equipe else 'comercial'::public.papel_equipe end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Só admin (ou o servidor) muda papel, ativo e capacidade.
create function public.proteger_campos_profile() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.papel, new.ativo, new.capacidade_semanal_horas, new.email)
     is distinct from (old.papel, old.ativo, old.capacidade_semanal_horas, old.email)
     and auth.uid() is not null and not public.tem_papel('admin') then
    raise exception 'Apenas admin altera papel, status, capacidade ou e-mail';
  end if;
  return new;
end $$;

create trigger profiles_proteger before update on public.profiles
  for each row execute function public.proteger_campos_profile();

-- ─── updated_at genérico ────────────────────────────────────────────────────
create function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ─── Feriados e SLA (espelha src/lib/sla.ts — manter em sincronia) ──────────
create table public.feriados (
  data date primary key,
  nome text not null,
  tipo text not null check (tipo in ('nacional', 'facultativo', 'local', 'recesso')),
  conta_no_sla boolean not null default true
);

-- Páscoa (Meeus/Jones/Butcher)
create function public.pascoa(ano int) returns date
language plpgsql immutable as $$
declare a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int;
begin
  a := ano % 19; b := ano / 100; c := ano % 100; d := b / 4; e := b % 4;
  f := (b + 8) / 25; g := (b - f + 1) / 3; h := (19 * a + b - d - g + 15) % 30;
  i := c / 4; k := c % 4; l := (32 + 2 * e + 2 * i - h - k) % 7; m := (a + 11 * h + 22 * l) / 451;
  return make_date(ano, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
end $$;

create function public.gerar_feriados(ano int) returns void
language plpgsql as $$
declare p date := public.pascoa(ano);
begin
  insert into public.feriados (data, nome, tipo) values
    (make_date(ano, 1, 1),   'Confraternização Universal', 'nacional'),
    (make_date(ano, 4, 21),  'Tiradentes', 'nacional'),
    (make_date(ano, 5, 1),   'Dia do Trabalho', 'nacional'),
    (make_date(ano, 9, 7),   'Independência', 'nacional'),
    (make_date(ano, 10, 12), 'Nossa Senhora Aparecida', 'nacional'),
    (make_date(ano, 11, 2),  'Finados', 'nacional'),
    (make_date(ano, 11, 15), 'Proclamação da República', 'nacional'),
    (make_date(ano, 11, 20), 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional'),
    (make_date(ano, 12, 25), 'Natal', 'nacional'),
    (p - 2,  'Sexta-feira Santa', 'nacional'),
    (p - 48, 'Carnaval (segunda)', 'facultativo'),
    (p - 47, 'Carnaval (terça)', 'facultativo'),
    (p + 60, 'Corpus Christi', 'facultativo')
  on conflict (data) do nothing;
end $$;

select public.gerar_feriados(y) from generate_series(2025, 2032) y;

-- Prazo de N horas úteis: relógio corre só em dias úteis (24h/dia), fuso de Brasília.
create function public.sla_deadline(chegada timestamptz, horas_uteis int default 24)
returns timestamptz
language plpgsql stable set search_path = public as $$
declare
  cur timestamp := chegada at time zone 'America/Sao_Paulo';
  restante interval := make_interval(hours => horas_uteis);
  dia date;
  fim_dia timestamp;
  disponivel interval;
begin
  for _ in 1..60 loop
    dia := cur::date;
    fim_dia := (dia + 1)::timestamp;
    if extract(isodow from dia) < 6
       and not exists (select 1 from public.feriados f where f.data = dia and f.conta_no_sla) then
      disponivel := fim_dia - cur;
      if restante <= disponivel then
        return (cur + restante) at time zone 'America/Sao_Paulo';
      end if;
      restante := restante - disponivel;
    end if;
    cur := fim_dia;
  end loop;
  raise exception 'sla_deadline: não convergiu para %', chegada;
end $$;
