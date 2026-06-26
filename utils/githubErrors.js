// utils/githubErrors.js
//
// Centraliza a tradução de erros HTTP do GitHub para mensagens amigáveis.
// Extraído para um único lugar porque o mesmo bloco de tratamento se
// repetia em todos os comandos que falam com a API do GitHub — manter
// isso centralizado significa que, se um dia quisermos melhorar uma
// mensagem de erro, fazemos isso em um único arquivo.

/**
 * Traduz um erro lançado pelo Octokit em uma mensagem amigável em português.
 * @param {Error & { status?: number }} error - erro capturado no catch
 * @param {string} acaoFalhou - descrição da ação que falhou, ex: "criar a issue"
 * @returns {string} mensagem amigável para mostrar ao usuário no Discord
 */
export function traduzirErroGitHub(error, acaoFalhou = "completar a ação") {
  switch (error.status) {
    case 401:
      return "Token do GitHub inválido ou expirado. Avise um administrador do bot.";
    case 403:
      return `Sem permissão suficiente no token para ${acaoFalhou} neste repositório.`;
    case 404:
      return (
        `Não encontrado. Verifique se o número informado existe, e se ` +
        `\`GITHUB_OWNER\`/\`GITHUB_REPO\` estão corretos e acessíveis pelo token.`
      );
    case 422:
      return `O GitHub rejeitou os dados enviados ao tentar ${acaoFalhou}. Confira os valores informados (ex: label ou usuário inexistente).`;
    default:
      return `Ocorreu um erro inesperado ao tentar ${acaoFalhou}. Tente novamente mais tarde.`;
  }
}
