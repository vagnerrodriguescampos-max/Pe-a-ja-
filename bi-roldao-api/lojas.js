'use strict';
/**
 * Nome oficial da loja, por número.
 *
 * Três fontes chamam a mesma loja de três jeitos: a planilha de vendas, a Base
 * Contábil ("F. Da Rocha", "Mal. Tito", "C. Dutra") e o cadastro que a operação
 * usa no dia a dia ("FRANCO DA ROCHA", "MARECHAL", "CID. DUTRA"). Enquanto cada
 * tela mostrar o nome da sua própria fonte, duas telas do mesmo BI parecem
 * falar de lojas diferentes.
 *
 * A chave é o NÚMERO da loja — nunca o texto. Foi confiar em texto que já
 * produziu duas falhas nesta base: regionais embaralhadas por posição e uma
 * loja partida ao meio por estar grafada de dois jeitos.
 *
 * Regras, iguais às do de-para de regionais:
 *  - loja fora do mapa mantém o nome que veio da fonte, não vira vazio;
 *  - o mapa é aplicado na leitura, então vale para a base já importada;
 *  - a semente entra uma vez por versão e nunca desfaz ajuste feito depois.
 */

const fs = require('fs');
const path = require('path');

function arquivo(dataDir) { return path.join(dataDir, 'lojas.json'); }

/** { mapa: { "9": "GUARULHOS" }, atualizado, sementeVersao } — nunca lança. */
function ler(dataDir) {
  try {
    const p = arquivo(dataDir);
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (j && j.mapa && typeof j.mapa === 'object') {
        return { mapa: j.mapa, atualizado: j.atualizado || null, sementeVersao: j.sementeVersao == null ? 1 : j.sementeVersao };
      }
    }
  } catch (e) { console.error('lojas.json ilegivel:', e.message); }
  return { mapa: {}, atualizado: null, sementeVersao: 0 };
}

function gravar(dataDir, mapa, sementeVersao) {
  const limpo = {};
  for (const k of Object.keys(mapa || {})) {
    const n = String(k).trim();
    const v = String(mapa[k] == null ? '' : mapa[k]).trim().replace(/\s+/g, ' ');
    if (n && v) limpo[n] = v;      // string vazia remove a loja do mapa
  }
  const conteudo = { mapa: limpo, atualizado: new Date().toISOString() };
  if (sementeVersao != null) conteudo.sementeVersao = sementeVersao;
  else { const atual = ler(dataDir); if (atual.sementeVersao != null) conteudo.sementeVersao = atual.sementeVersao; }
  fs.writeFileSync(arquivo(dataDir), JSON.stringify(conteudo, null, 1));
  return conteudo;
}

/**
 * Aplica o nome oficial sobre uma lista de lojas ({num, name}).
 * Devolve quantas foram renomeadas e quais — o log serve para conferir que o
 * de-para casou com a base, em vez de silenciosamente não casar com nada.
 */
function aplicar(stores, mapa) {
  if (!Array.isArray(stores) || !mapa) return { renomeadas: 0, trocas: [] };
  let renomeadas = 0;
  const trocas = [];
  for (const s of stores) {
    const oficial = mapa[String(s.num)];
    if (!oficial) continue;
    const atual = String(s.name || '').trim();
    /* Comparação EXATA, não "ignorando maiúsculas". Pular por diferença só de
       caixa parece economia e não é: a base de vendas ficava com "ATIBAIA" e a
       DRE com "Atibaia", e dre.data é indexado pelo nome — duas grafias para a
       mesma loja é justamente o defeito que este módulo existe para eliminar.
       Na tela as duas aparecem iguais (titleCase), então isso só apareceria
       quando alguma tela cruzasse as duas bases. */
    if (atual === oficial) continue;
    trocas.push({ loja: s.num, de: atual, para: oficial });
    s.name = oficial;
    renomeadas++;
  }
  return { renomeadas, trocas };
}

/**
 * A DRE guarda os valores num objeto indexado por NOME (dre.data[nome]).
 * Renomear a loja sem mover a chave deixaria o cartão da loja vazio — o nome
 * novo não acharia nada. As duas coisas têm de andar juntas.
 */
function aplicarNaDre(dre, mapa) {
  if (!dre || !Array.isArray(dre.stores) || !mapa) return { renomeadas: 0, trocas: [] };
  const antes = dre.stores.map(s => ({ num: s.num, name: s.name }));
  const r = aplicar(dre.stores, mapa);
  if (!r.renomeadas) return r;
  const novo = {};
  dre.stores.forEach((s, i) => {
    const chaveAntiga = antes[i].name;
    novo[s.name] = dre.data[chaveAntiga] || dre.data[s.name] || {};
  });
  for (const k of Object.keys(dre.data || {})) if (!(k in novo)) novo[k] = dre.data[k];
  dre.data = novo;
  return r;
}

module.exports = { ler, gravar, aplicar, aplicarNaDre, arquivo };
