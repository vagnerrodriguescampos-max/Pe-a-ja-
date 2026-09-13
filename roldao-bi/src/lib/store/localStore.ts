import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Armazenamento em disco, com a mesma interface mínima que o BI usa do
 * Netlify Blobs: `get(key, { type: 'json' })` e `setJSON(key, valor)`.
 *
 * Existe por dois motivos práticos:
 *
 * 1. Rodar o BI fora do Netlify exigia siteID + token. Sem eles, TODA rota de
 *    API respondia 500 e as 17 páginas abriam em branco — não dava nem para
 *    abrir o projeto na própria máquina sem ter em mãos o segredo do site de
 *    produção.
 * 2. Uma demonstração não deve depender de um serviço externo nem carregar a
 *    credencial que dá acesso aos dados reais de um cliente. Com o disco, o
 *    projeto sobe sozinho, com base fictícia, em qualquer lugar.
 *
 * Produção não muda: quando as variáveis do Netlify existem, elas continuam
 * mandando. Este armazenamento é o que atende quando elas não existem.
 */

function raiz(): string {
  return process.env.BI_DATA_DIR || path.join(process.cwd(), '.data');
}

/* A chave vira caminho de arquivo ("facts/abc.json" -> .data/facts/abc.json).
   Normalizar e conferir o prefixo impede que uma chave com ".." escreva fora
   da pasta de dados. */
function caminho(chave: string): string {
  const base = raiz();
  const destino = path.normalize(path.join(base, chave));
  if (destino !== base && !destino.startsWith(base + path.sep)) {
    throw new Error(`Chave inválida para o armazenamento local: ${chave}`);
  }
  return destino;
}

export interface ArmazenamentoBi {
  get(chave: string, opcoes?: { type?: string }): Promise<unknown>;
  setJSON(chave: string, valor: unknown): Promise<void>;
}

export function criarArmazenamentoLocal(): ArmazenamentoBi {
  return {
    async get(chave: string) {
      try {
        return JSON.parse(await fs.readFile(caminho(chave), 'utf8'));
      } catch (err) {
        // Chave inexistente é ausência de dado, não falha: o Blob Store
        // devolve null nesse caso e o BI conta com isso para saber que
        // ainda não há importação. Qualquer outro erro (permissão, JSON
        // corrompido) precisa subir, para não virar "BI vazio" silencioso.
        if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
        throw err;
      }
    },
    async setJSON(chave: string, valor: unknown) {
      const destino = caminho(chave);
      await fs.mkdir(path.dirname(destino), { recursive: true });
      // Grava em arquivo temporário e renomeia: se o processo morrer no meio
      // de uma importação grande, o arquivo antigo continua íntegro em vez de
      // ficar pela metade.
      const temporario = `${destino}.tmp-${process.pid}`;
      await fs.writeFile(temporario, JSON.stringify(valor), 'utf8');
      await fs.rename(temporario, destino);
    },
  };
}

export function caminhoDoArmazenamentoLocal(): string {
  return raiz();
}
