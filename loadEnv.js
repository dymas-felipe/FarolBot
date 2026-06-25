// loadEnv.js
//
// Arquivo isolado cuja única responsabilidade é carregar o .env.
// Importar este arquivo PRIMEIRO (antes de qualquer outro import que
// dependa de process.env) garante que as variáveis já estejam
// disponíveis quando módulos como criarIssue.js e listarIssues.js
// instanciam o Octokit no topo do arquivo (fora de qualquer função).
//
// Motivo técnico: em ES Modules, todos os "import" no topo de um
// arquivo são resolvidos e executados antes de qualquer outra linha
// do próprio arquivo. Se dotenv.config() estivesse só no index.js
// depois dos imports dos comandos, os comandos já teriam tentado ler
// process.env.GITHUB_TOKEN como undefined no momento do import.

import dotenv from "dotenv";

dotenv.config();
