// utils/carregarComandos.js
//
// Lê dinamicamente todos os arquivos .js dentro de commands/ e os
// importa, retornando uma lista com os módulos de comando.
//
// Vantagem: tanto o index.js quanto o deploy-commands.js passam a usar
// essa mesma função, então adicionar um novo comando no futuro significa
// apenas criar o arquivo em commands/ — sem precisar editar nem
// index.js nem deploy-commands.js manualmente.

import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PASTA_COMANDOS = path.join(__dirname, "..", "commands");

/**
 * Importa todos os comandos da pasta commands/.
 * @returns {Promise<Array<{data: object, execute: Function}>>}
 */
export async function carregarComandos() {
  const arquivos = readdirSync(PASTA_COMANDOS).filter((arquivo) => arquivo.endsWith(".js"));

  const comandos = [];

  for (const arquivo of arquivos) {
    const caminhoCompleto = path.join(PASTA_COMANDOS, arquivo);
    // file:// é necessário no Windows para o import dinâmico funcionar
    // corretamente com caminhos absolutos.
    const moduloUrl = `file://${caminhoCompleto.replace(/\\/g, "/")}`;
    const modulo = await import(moduloUrl);

    if (modulo.default?.data && modulo.default?.execute) {
      comandos.push(modulo.default);
    } else {
      console.warn(`⚠️ Arquivo "${arquivo}" ignorado: não exporta um comando válido (data + execute).`);
    }
  }

  return comandos;
}
