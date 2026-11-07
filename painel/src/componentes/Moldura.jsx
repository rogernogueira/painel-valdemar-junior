// Cabeçalho e rodapé do painel: faixa com o assunto (itens separados por
// divisória de 1 px, nunca por "·") e rodapé com notas de método e fontes.

function Itens({ itens }) {
  return <ul className="itens">{itens.filter(Boolean).map((t) => <li key={t}>{t}</li>)}</ul>;
}

export function Cabecalho({ indicadores }) {
  return (
    <header>
      <div className="faixa gutter">
        <Itens itens={indicadores} />
      </div>
    </header>
  );
}

export function Rodape({ dataset }) {
  return (
    <footer className="rodape gutter">
      <p>
        Candidatos casados entre as eleições pelo nome na urna; número e partido podem mudar. Locais
        casados por município e número do local: "outro prédio" indica que o mesmo número passou a ser
        outro endereço, e "coordenada aproximada" que a posição foi estimada (povoado ou centro do
        município).
      </p>
      <p>
        Fontes: Boletins de Urna do 1º turno de 2022 e 2026 e cadastros de locais de votação (dados
        abertos do TSE); malha municipal do IBGE; coordenadas faltantes completadas pelo OpenStreetMap;
        fundo do mapa da Esri.
        {dataset && <> Pacote <code>{dataset.dataset_id}</code>, gerado em {dataset.exported_at.slice(0, 10)}.</>}
      </p>
      <p className="credito">
        Feito por Rogério Nogueira
      </p>
    </footer>
  );
}
