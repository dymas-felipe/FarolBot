import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import { Octokit } from "octokit";

// Instancia o cliente do GitHub uma única vez, reutilizando a conexão
// em todas as execuções do comando (evita overhead de criar um cliente novo a cada chamada).
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export default {
  // Definição do Slash Command: nome, descrição e parâmetros (options)
  data: new SlashCommandBuilder()
    .setName("criar-issue")
    .setDescription("Cria uma nova Issue no repositório do GitHub configurado")
    .addStringOption((option) =>
      option
        .setName("titulo")
        .setDescription("Título da issue")
        .setRequired(true)
        .setMaxLength(256) // limite da própria API do GitHub
    )
    .addStringOption((option) =>
      option
        .setName("descricao")
        .setDescription("Descrição detalhada do problema ou tarefa")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("label")
        .setDescription("Label/etiqueta da issue (ex: bug, enhancement, documentation)")
        .setRequired(false)
    ),

  // Função executada quando o comando é disparado no Discord
  async execute(interaction) {
    // Captura os valores informados pelo usuário no Discord
    const titulo = interaction.options.getString("titulo");
    const descricao = interaction.options.getString("descricao");
    const label = interaction.options.getString("label");

    // deferReply mantém o "Bot está pensando..." visível enquanto a
    // requisição ao GitHub é processada (slash commands expiram em 3s
    // se não houver resposta, e a chamada de rede pode levar mais que isso).
    // flags: Ephemeral faz a resposta aparecer só para quem usou o comando;
    // remova essa flag se quiser que a resposta final seja pública no canal.
    await interaction.deferReply();

    try {
      // Monta o corpo da issue. Adicionamos um rodapé indicando quem
      // abriu a issue via Discord, o que ajuda a rastrear a origem depois.
      const corpoFormatado = [
        descricao,
        "",
        "---",
        `📨 Issue criada via Discord por **${interaction.user.tag}**`,
      ].join("\n");

      // Chamada à API REST do GitHub para criar a issue.
      // Endpoint: POST /repos/{owner}/{repo}/issues
      const response = await octokit.rest.issues.create({
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        title: titulo,
        body: corpoFormatado,
        // Só envia o array de labels se o usuário tiver informado um;
        // caso contrário a issue é criada sem nenhuma label.
        labels: label ? [label] : [],
      });

      const issue = response.data;

      // Monta um embed amigável confirmando a criação, com link direto
      // para a issue no GitHub.
      const embedSucesso = new EmbedBuilder()
        .setColor(0x2ea44f) // verde GitHub
        .setTitle(`✅ Issue #${issue.number} criada com sucesso!`)
        .setURL(issue.html_url)
        .addFields(
          { name: "Título", value: issue.title },
          {
            name: "Repositório",
            value: `${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`,
            inline: true,
          },
          {
            name: "Label",
            value: label ?? "Nenhuma",
            inline: true,
          }
        )
        .setFooter({ text: `Criada por ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embedSucesso] });
    } catch (error) {
      // Loga o erro completo no console do servidor para facilitar debug,
      // mas mostra ao usuário só uma mensagem amigável (sem detalhes técnicos
      // sensíveis, como o token).
      console.error("Erro ao criar issue no GitHub:", error);

      // Trata os erros mais comuns de forma específica para dar um feedback
      // mais útil do que um "algo deu errado" genérico.
      let mensagemErro = "Ocorreu um erro inesperado ao criar a issue. Tente novamente mais tarde.";

      if (error.status === 401) {
        mensagemErro = "Token do GitHub inválido ou expirado. Avise um administrador do bot.";
      } else if (error.status === 404) {
        mensagemErro =
          "Repositório não encontrado. Verifique se `GITHUB_OWNER`/`GITHUB_REPO` estão corretos e se o token tem acesso a ele.";
      } else if (error.status === 422) {
        mensagemErro =
          "O GitHub rejeitou os dados enviados (ex: label inexistente no repositório). Verifique o nome da label e tente novamente.";
      } else if (error.status === 403) {
        mensagemErro = "Sem permissão suficiente no token para criar issues neste repositório.";
      }

      const embedErro = new EmbedBuilder()
        .setColor(0xd73a49) // vermelho GitHub
        .setTitle("❌ Falha ao criar a issue")
        .setDescription(mensagemErro);

      await interaction.editReply({ embeds: [embedErro] });
    }
  },
};
