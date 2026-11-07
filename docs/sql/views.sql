-- Camada analítica do painel de deputados (2022 × 2026).
--
-- Executada uma vez, na abertura do painel, contra os Parquet do pacote. Tudo
-- que as telas consultam passa por aqui: nenhuma consulta da interface toca a
-- tabela crua, para que uma mudança de definição tenha um lugar só, e para que
-- o número do painel seja o mesmo de quem baixa o pacote e roda o SQL.
--
-- Tabelas de origem (views criadas pelo app sobre data/*.parquet):
--   municipios(cod_ibge, municipio, geometria)
--   locais(local_id, cod_ibge, municipio, nr_local, local, endereco, lat, lon,
--          fonte_coordenada, mesmo_predio, coordenada_aproximada)
--   candidatos(cargo, chave, nome, numero_2022, partido_2022, votos_2022,
--              numero_2026, partido_2026, votos_2026)
--   votos(cargo, ano, local_id, tipo, chave, nome, numero, partido, votos)


-- Votos válidos (nominais + legenda) do cargo em cada local e ano: base das
-- porcentagens. Branco e nulo não entram, como no cálculo oficial.
CREATE OR REPLACE VIEW v_validos_local AS
SELECT cargo, ano, local_id, SUM(votos) AS validos
FROM votos
WHERE tipo IN ('Nominal', 'Legenda')
GROUP BY ALL;


-- Um candidato num local: votos de cada ano e a variação.
-- Só existe linha onde o candidato teve voto em pelo menos um dos anos.
CREATE OR REPLACE VIEW v_por_local AS
WITH nominal AS (
    SELECT
        cargo, chave, local_id,
        SUM(votos) FILTER (WHERE ano = 2022) AS votos_2022,
        SUM(votos) FILTER (WHERE ano = 2026) AS votos_2026
    FROM votos
    WHERE tipo = 'Nominal'
    GROUP BY ALL
)
SELECT
    n.cargo, n.chave, n.local_id,
    l.cod_ibge, l.municipio, l.local, l.endereco, l.lat, l.lon,
    l.fonte_coordenada, l.mesmo_predio, l.coordenada_aproximada,
    COALESCE(n.votos_2022, 0)::INTEGER AS votos_2022,
    COALESCE(n.votos_2026, 0)::INTEGER AS votos_2026,
    (COALESCE(n.votos_2026, 0) - COALESCE(n.votos_2022, 0))::INTEGER AS variacao,
    CASE
        WHEN COALESCE(n.votos_2026, 0) > COALESCE(n.votos_2022, 0) THEN 'subiu'
        WHEN COALESCE(n.votos_2026, 0) < COALESCE(n.votos_2022, 0) THEN 'caiu'
        ELSE 'igual'
    END AS situacao,
    ROUND(100 * n.votos_2022 / v22.validos, 2) AS pct_2022,
    ROUND(100 * n.votos_2026 / v26.validos, 2) AS pct_2026
FROM nominal n
JOIN locais l USING (local_id)
LEFT JOIN v_validos_local v22 ON v22.cargo = n.cargo AND v22.local_id = n.local_id AND v22.ano = 2022
LEFT JOIN v_validos_local v26 ON v26.cargo = n.cargo AND v26.local_id = n.local_id AND v26.ano = 2026;


-- Válidos do cargo no município, somando todos os locais (não só os do
-- candidato): é o denominador da fatia do candidato no município.
CREATE OR REPLACE VIEW v_validos_municipio AS
SELECT v.cargo, v.ano, l.cod_ibge, SUM(v.validos) AS validos
FROM v_validos_local v
JOIN locais l USING (local_id)
GROUP BY ALL;


-- Um candidato num município. Município sem nenhum voto do candidato nos dois
-- anos não tem linha: o mapa o pinta como 'sem voto'.
CREATE OR REPLACE VIEW v_por_municipio AS
WITH soma AS (
    SELECT cargo, chave, cod_ibge,
           SUM(votos_2022)::INTEGER AS votos_2022,
           SUM(votos_2026)::INTEGER AS votos_2026
    FROM v_por_local
    GROUP BY ALL
)
SELECT
    s.cargo, s.chave, s.cod_ibge, m.municipio,
    s.votos_2022, s.votos_2026,
    (s.votos_2026 - s.votos_2022)::INTEGER AS variacao,
    CASE WHEN s.votos_2022 > 0
         THEN ROUND(100 * (s.votos_2026 - s.votos_2022) / s.votos_2022, 1) END AS variacao_pct,
    ROUND(100 * s.votos_2022 / v22.validos, 2) AS pct_2022,
    ROUND(100 * s.votos_2026 / v26.validos, 2) AS pct_2026,
    CASE
        WHEN s.votos_2026 > s.votos_2022 THEN 'subiu'
        WHEN s.votos_2026 < s.votos_2022 THEN 'caiu'
        ELSE 'igual'
    END AS situacao
FROM soma s
JOIN municipios m USING (cod_ibge)
LEFT JOIN v_validos_municipio v22 ON v22.cargo = s.cargo AND v22.cod_ibge = s.cod_ibge AND v22.ano = 2022
LEFT JOIN v_validos_municipio v26 ON v26.cargo = s.cargo AND v26.cod_ibge = s.cod_ibge AND v26.ano = 2026;


-- Totais do candidato no estado e quantos municípios subiram ou caíram.
CREATE OR REPLACE VIEW v_totais AS
SELECT
    cargo, chave,
    SUM(votos_2022)::INTEGER AS votos_2022,
    SUM(votos_2026)::INTEGER AS votos_2026,
    (SUM(votos_2026) - SUM(votos_2022))::INTEGER AS variacao,
    COUNT(*) FILTER (WHERE situacao = 'subiu')::INTEGER AS municipios_subiu,
    COUNT(*) FILTER (WHERE situacao = 'caiu')::INTEGER AS municipios_caiu,
    COUNT(*) FILTER (WHERE situacao = 'igual')::INTEGER AS municipios_igual
FROM v_por_municipio
GROUP BY ALL;


-- Lista de candidatos do seletor, do mais ao menos votado em 2026.
CREATE OR REPLACE VIEW v_candidatos AS
SELECT
    cargo, chave, nome,
    numero_2022, partido_2022, votos_2022,
    numero_2026, partido_2026, votos_2026,
    CASE
        WHEN votos_2022 > 0 AND votos_2026 > 0 THEN 'nos dois anos'
        WHEN votos_2026 > 0 THEN 'só em 2026'
        ELSE 'só em 2022'
    END AS participacao
FROM candidatos;


-- Tudo o que foi votado para o cargo num local em 2026: candidatos, legendas,
-- brancos e nulos, na ordem da cédula de resultado.
CREATE OR REPLACE VIEW v_lista_2026 AS
SELECT
    cargo, local_id, chave, tipo, nome,
    CASE WHEN tipo = 'Nominal' THEN numero END AS numero,
    partido, votos,
    CASE tipo WHEN 'Nominal' THEN 0 WHEN 'Legenda' THEN 1 WHEN 'Branco' THEN 2 ELSE 3 END AS ordem_tipo
FROM votos
WHERE ano = 2026;
