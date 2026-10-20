-- ════════════════════════════════════════════════════════════════════════════
-- Dados de DEMONSTRAÇÃO (fictícios). Não passam por registrar_lead: nenhuma
-- mensagem é enviada. E-mails usam o domínio inexistente ".exemplo".
-- Tudo fica em demo_registros → select limpar_demonstracao(); apaga.
-- Requer ao menos um perfil ativo (admin/comercial) para ser responsável.
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  pessoas text[][] := array[
    ['Marina Albuquerque', 'Clínica Vitta', 'sistemas_web,automacao_ia', 'sistema_nao_atende', 'Agendamento é feito em 3 lugares diferentes e a recepção perde 2h por dia conferindo horários.', 'google'],
    ['João Pedro Lima', 'Transportes Lima', 'dashboards', 'planilhas', 'Fechamento do mês leva uma semana porque os dados de frete vêm de 4 planilhas diferentes.', 'instagram'],
    ['Carla Mendes', 'Ateliê Mendes', 'loja_virtual,site_landing', 'manual_whatsapp', 'Vendo pelo WhatsApp e perco pedido quando o volume aumenta no fim do ano.', 'site'],
    ['Eduardo Furtado', 'Furtado Engenharia', 'aplicativo', 'nao_existe', 'Equipe de campo preenche relatório em papel e a gente digita tudo de novo no escritório.', 'indicacao'],
    ['Patrícia Rocha', 'Rocha Contabilidade', 'automacao_ia,integracoes_apis', 'planilhas', 'Recebemos 300 notas por mês por e-mail e alguém baixa e lança uma por uma no sistema.', 'linkedin'],
    ['Ricardo Tavares', 'Academia Pulso', 'aplicativo,sistemas_web', 'sistema_nao_atende', 'O sistema atual não deixa o aluno remarcar aula pelo celular e a recepção vive no telefone.', 'google'],
    ['Fernanda Lopes', 'Imobiliária Lopes', 'sistemas_web,integracoes_apis', 'manual_whatsapp', 'Os corretores controlam visitas no WhatsApp e ninguém sabe qual imóvel está reservado.', 'campanha'],
    ['Bruno Carvalho', 'Distribuidora BC', 'integracoes_apis,dashboards', 'sistema_nao_atende', 'O ERP não conversa com a loja virtual e o estoque fica errado todo dia.', 'google'],
    ['Juliana Prado', 'Escola Viver', 'site_landing', 'nao_existe', 'Precisamos de um site para matrículas de 2027; hoje só temos Instagram.', 'instagram'],
    ['Marcelo Antunes', 'Antunes Advocacia', 'automacao_ia', 'planilhas', 'Controlamos prazos processuais em planilha e já perdemos um prazo este ano.', 'indicacao'],
    ['Aline Souza', 'Doce Souza', 'loja_virtual', 'manual_whatsapp', 'Encomendas de bolo chegam por WhatsApp, Instagram e telefone e às vezes a gente esquece uma.', 'site'],
    ['Thiago Martins', 'Martins Logística', 'dashboards,sistemas_web', 'planilhas', 'O cliente pede posição da carga e a gente precisa ligar para o motorista para saber.', 'linkedin'],
    ['Camila Reis', 'Studio Reis', 'site_landing,automacao_ia', 'manual_whatsapp', 'Respondo as mesmas perguntas de preço no Direct dezenas de vezes por dia.', 'instagram'],
    ['Gustavo Nunes', 'Nunes Auto Peças', 'evoluir_existente', 'sistema_nao_atende', 'Temos um sistema feito há 6 anos que ninguém consegue mais manter e trava toda semana.', 'indicacao'],
    ['Renata Barros', 'Clínica Sorriso Barros', 'sistemas_web', 'planilhas', 'Orçamentos de tratamento são feitos no Excel e o paciente demora para receber.', 'google'],
    ['Felipe Costa', 'Costa Engenharia Elétrica', 'aplicativo,integracoes_apis', 'nao_existe', 'Os técnicos precisam registrar fotos da obra e hoje mandam tudo solto no grupo.', 'site'],
    ['Larissa Moreira', 'Moreira Eventos', 'sistemas_web,dashboards', 'planilhas', 'Cada evento tem uma planilha de fornecedores e o financeiro nunca fecha.', 'campanha'],
    ['Diego Ferreira', 'Ferreira Pet', 'loja_virtual,integracoes_apis', 'sistema_nao_atende', 'A loja virtual não emite nota e o estoque da loja física não aparece no site.', 'google'],
    ['Beatriz Almeida', 'Almeida Consultoria', 'automacao_ia', 'manual_whatsapp', 'Os relatórios para cliente levam 2 dias para montar copiando dados de 3 ferramentas.', 'linkedin'],
    ['Rodrigo Pires', 'Pires Materiais', 'sistemas_web', 'planilhas', 'Pedido de orçamento chega por e-mail e vendedor monta à mão; demora 1 dia para responder.', 'site'],
    ['Vanessa Teixeira', 'Teixeira Moda', 'site_landing', 'nao_existe', 'Quero só uma landing page para a coleção nova.', 'instagram'],
    ['André Gomes', 'Gomes Climatização', 'aplicativo', 'manual_whatsapp', 'Os chamados de manutenção chegam no WhatsApp pessoal dos técnicos e se perdem.', 'google'],
    ['Paula Ribeiro', 'Ribeiro Odontologia', 'evoluir_existente,automacao_ia', 'sistema_nao_atende', 'O sistema da clínica não manda lembrete de consulta e temos 20% de faltas.', 'indicacao'],
    ['Lucas Andrade', 'Andrade Agro', 'dashboards,integracoes_apis', 'planilhas', 'Dados de colheita ficam em 5 planilhas por fazenda; ninguém tem visão consolidada.', 'linkedin'],
    ['Mariana Castro', 'Castro Fisioterapia', 'sistemas_web,site_landing', 'manual_whatsapp', 'Agenda dos fisioterapeutas é no caderno e pacientes ligam para remarcar.', 'site'],
    ['Henrique Dias', 'Dias Segurança', 'aplicativo,dashboards', 'sistema_nao_atende', 'As rondas são registradas em papel e o cliente pede comprovação que não temos.', 'campanha'],
    ['Isabela Freitas', 'Freitas Arquitetura', 'sistemas_web', 'planilhas', 'Controle de horas por projeto em planilha; não sabemos se o projeto deu lucro.', 'google'],
    ['Otávio Batista', 'Batista Gráfica', 'automacao_ia,integracoes_apis', 'manual_whatsapp', 'Orçamentos de impressão chegam com arquivos no WhatsApp e alguém confere tudo à mão.', 'instagram'],
    ['Sabrina Cunha', 'Cunha Estética', 'loja_virtual,automacao_ia', 'nao_existe', 'Queremos vender pacotes online e confirmar agendamento sem ninguém da recepção.', 'site'],
    ['Vinícius Ramos', 'Ramos Transportes', 'evoluir_existente', 'sistema_nao_atende', 'Temos um sistema de frota que precisa de novas telas e relatório de combustível.', 'indicacao']
  ];
  -- etapa, dias atrás, valor, respondido (horas após chegada; null = sem resposta)
  plano text[][] := array[
    ['novo','0.02','','',''], ['novo','0.2','','',''], ['novo','0.9','','',''], ['triagem','1.5','','2',''],
    ['triagem','3','','5',''], ['diagnostico','6','35000','1',''], ['diagnostico','9','22000','3',''],
    ['descoberta','12','48000','2',''], ['descoberta','15','60000','4',''], ['proposta','18','42000','1',''],
    ['proposta','21','18000','6',''], ['proposta','26','75000','2',''], ['negociacao','28','52000','3',''],
    ['negociacao','33','30000','1',''], ['ganho','36','45000','2','25'], ['ganho','40','28000','5','30'],
    ['ganho','47','64000','1','38'], ['ganho','55','15000','8','46'], ['ganho','62','38000','2','50'],
    ['perdido','20','25000','3','preco'], ['perdido','31','12000','30','sem_resposta'],
    ['perdido','44','40000','2','concorrente'], ['perdido','52','8000','4','fora_de_escopo'],
    ['perdido','58','20000','26','prazo'], ['triagem','2.4','','',''], ['diagnostico','7','27000','30',''],
    ['novo','1.1','','',''], ['proposta','23','33000','2',''], ['ganho','68','90000','3','60'], ['novo','0.6','','','']
  ];
  equipe uuid[] := (select array_agg(id order by created_at) from public.profiles where ativo and papel in ('admin', 'comercial'));
  i int; p text[]; pl text[]; dias numeric; chegada timestamptz;
  v_emp uuid; v_cont uuid; v_neg uuid; v_lead uuid; v_resp uuid; v_slug text; v_email text;
begin
  if equipe is null then raise exception 'seed_demo: crie ao menos um usuário antes'; end if;
  for i in 1 .. array_length(pessoas, 1) loop
    p := array[pessoas[i][1], pessoas[i][2], pessoas[i][3], pessoas[i][4], pessoas[i][5], pessoas[i][6]];
    pl := array[plano[i][1], plano[i][2], plano[i][3], plano[i][4], plano[i][5]];
    dias := pl[2]::numeric;
    chegada := now() - make_interval(secs => (dias * 86400)::int);
    v_resp := equipe[1 + (i % array_length(equipe, 1))];
    v_slug := lower(regexp_replace(translate(p[2], 'áàâãéêíóôõúçÁÉÍÓÚÇ', 'aaaaeeiooouc AEIOUC'), '[^a-zA-Z]+', '', 'g'));
    v_email := lower(split_part(translate(p[1], 'áàâãéêíóôõúçÁÉÍÓÚÇ', 'aaaaeeiooouc AEIOUC'), ' ', 1)) || '@' || v_slug || '.exemplo';

    insert into public.empresas (nome, created_at) values (p[2], chegada) returning id into v_emp;
    insert into public.contatos (nome, email, whatsapp, empresa_id, responsavel_id, created_at)
    values (p[1], v_email, '+55119' || lpad((70000000 + i * 1379)::text, 8, '0'), v_emp, v_resp, chegada)
    returning id into v_cont;

    insert into public.negocios (titulo, contato_id, empresa_id, responsavel_id, servicos, valor_estimado, created_at)
    values (public.rotulo_servico(split_part(p[3], ',', 1)::public.servico) || ' · ' || p[2], v_cont, v_emp, v_resp,
            string_to_array(p[3], ',')::public.servico[], nullif(pl[3], '')::numeric, chegada)
    returning id into v_neg;

    insert into public.leads (contato_id, negocio_id, responsavel_id, servicos, situacao_atual, dor, nome_informado,
                              email_informado, whatsapp_informado, empresa_informada, origem_informada,
                              utm_source, consentimento_lgpd_em, origem_ingestao, created_at)
    values (v_cont, v_neg, v_resp, string_to_array(p[3], ',')::public.servico[], p[4]::public.situacao_atual, p[5], p[1],
            v_email, '(11) 9' || lpad((70000000 + i * 1379)::text, 8, '0'), p[2], p[6],
            case when p[6] in ('google', 'instagram', 'linkedin', 'campanha') then p[6] end, chegada, 'api', chegada)
    returning id into v_lead;

    insert into public.atividades (tipo, canal, direcao, automatica, contato_id, negocio_id, lead_id, titulo, corpo, ocorreu_em)
    values ('lead_recebido', 'sistema', 'entrada', true, v_cont, v_neg, v_lead,
            'Pedido ' || (select public.formatar_protocolo(protocolo) from public.leads where id = v_lead) || ' recebido pelo site', p[5], chegada);

    if pl[4] <> '' then
      insert into public.atividades (tipo, canal, direcao, automatica, contato_id, negocio_id, lead_id, autor_id, titulo, corpo, ocorreu_em)
      values ('mensagem', case when i % 2 = 0 then 'whatsapp' else 'email' end::public.canal, 'saida', false, v_cont, v_neg, v_lead, v_resp,
              'Primeiro contato', 'Oi, ' || split_part(p[1], ' ', 1) || '! Aqui é da Stark. Podemos marcar 30 minutos para entender melhor?',
              chegada + make_interval(hours => pl[4]::int));
    end if;

    -- avança no funil (o gatilho registra cada mudança na linha do tempo)
    if pl[1] <> 'novo' then
      update public.negocios
         set etapa = pl[1]::public.etapa_negocio,
             motivo_perda = case when pl[1] = 'perdido' then pl[5]::public.motivo_perda end
       where id = v_neg;
      update public.negocios
         set etapa_desde = chegada + make_interval(days => greatest(1, (dias / 3)::int)),
             ganho_em = case when pl[1] = 'ganho' then chegada + make_interval(days => pl[5]::int) end,
             perdido_em = case when pl[1] = 'perdido' then chegada + make_interval(days => greatest(2, (dias / 2)::int)) end
       where id = v_neg;
      update public.atividades set ocorreu_em = chegada + make_interval(days => greatest(1, (dias / 3)::int))
       where negocio_id = v_neg and tipo = 'mudanca_etapa';
      update public.leads set status = case when pl[1] = 'ganho' then 'convertido' else 'em_atendimento' end where id = v_lead;
    end if;

    insert into public.demo_registros values ('empresas', v_emp), ('contatos', v_cont), ('negocios', v_neg), ('leads', v_lead);
  end loop;
end $$;
