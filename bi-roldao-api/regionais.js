'use strict';
/**
 * Mapa oficial loja -> regional.
 *
 * O parser lê a regional da aba "Base nova regional", e o layout dessa aba já
 * mudou duas vezes de um jeito que enganou a detecção automática — a última foi
 * uma legenda com os nomes das regionais parada à direita da tabela, que passa
 * em qualquer teste de conteúdo e não pertence à loja daquela linha.
 *
 * A heurística ficou mais dura, mas heurística nenhuma resolve isso para sempre:
 * a planilha é de terceiros e vai mudar de novo. Então existe esta camada, que
 * é o oposto de adivinhar — um de-para mantido por quem sabe a resposta, gravado
 * no volume e aplicado POR CIMA do que a importação trouxer.
 *
 * Regras:
 *  - o mapa nunca é preenchido sozinho; só entra o que a pessoa gravar;
 *  - loja fora do mapa mantém o que veio da planilha, não vira vazio;
 *  - aplicar o mapa reescreve o seed, então vale para a base já importada e
 *    para as próximas, sem precisar reimportar.
 */

const fs = require('fs');
const path = require('path');

function arquivo(dataDir) { return path.join(dataDir, 'regionais.json'); }

/** { mapa: { "48": "INTERIOR" }, atualizado: ISO } — nunca lança. */
function ler(dataDir) {
  try {
    const p = arquivo(dataDir);
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (j && typeof j.mapa === 'object' && j.mapa) return { mapa: j.mapa, atualizado: j.atualizado || null };
    }
  } catch (e) { console.error('regionais.json ilegivel:', e.message); }
  return { mapa: {}, atualizado: null };
}

function gravar(dataDir, mapa) {
  const limpo = {};
  for (const k of Object.keys(mapa || {})) {
    const n = String(k).trim();
    const v = String(mapa[k] == null ? '' : mapa[k]).trim();
    if (!n) continue;
    if (v) limpo[n] = v;      // string vazia remove a loja do mapa
  }
  const conteudo = { mapa: limpo, atualizado: new Date().toISOString() };
  fs.writeFileSync(arquivo(dataDir), JSON.stringify(conteudo, null, 1));
  return conteudo;
}

/**
 * Aplica o mapa sobre um seed já montado. Devolve quantas lojas foram
 * corrigidas — o número serve para o log dizer se a importação bateu com o
 * cadastro ou se a planilha voltou a divergir.
 */
function aplicar(seed, mapa) {
  if (!seed || !Array.isArray(seed.stores) || !mapa) return { corrigidas: 0, divergentes: [] };
  let corrigidas = 0;
  const divergentes = [];
  for (const s of seed.stores) {
    const oficial = mapa[String(s.num)];
    if (!oficial) continue;
    if (String(s.regional || '').trim() !== oficial) {
      divergentes.push({ loja: s.num, nome: s.name, daPlanilha: s.regional || '', oficial });
      s.regional = oficial;
      corrigidas++;
    }
  }
  seed.regionals = [...new Set(seed.stores.map(s => s.regional).filter(Boolean))].sort();
  return { corrigidas, divergentes };
}

/** Regionais conhecidas: as do mapa oficial mais as que vieram da planilha. */
function conhecidas(seed, mapa) {
  const set = new Set(Object.values(mapa || {}).filter(Boolean));
  if (seed && Array.isArray(seed.stores)) {
    for (const s of seed.stores) if (s.regional) set.add(String(s.regional).trim());
  }
  return [...set].sort();
}

module.exports = { ler, gravar, aplicar, conhecidas, arquivo };
