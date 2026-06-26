import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Octokit } from "octokit";
import { traduzirErroGitHub } from "../utils/githubErrors.js";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export default {
  data: new SlashCommandBuilder()
    .setName("atribuir-issue")
    .setDescription("Atribui ou remove um responsável (assignee) de uma issue")
    .addIntegerOption((option) =>
      option
        .setName("numero")
        .setDescription("Número da issue (ex: 42)")
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((option) =>
      option
        .setName("usuario")
        .setDescription("Username do GitHub a ser atribuído (ex: octocat)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("acao")
        .setDescription("Atribuir ou remover esse usuário da issue (padrão: atribuir)")
        .setRequired(false)
        .addChoices(
          { name: "Atribuir", value: "atribuir" },
          { name: "Remover", value: "remover" }
        )
    ),

  async execute(interaction) {
    const numero = interaction.options.getInteger("numero");
    const usuario = interaction.options.getString("usuario");
    const acao = interaction.options.getString("acao") ?? "atribuir";

    await interaction.deferReply();

    try {
      // O Octokit expõe endpoints diferentes para adicionar e remover
      // assignees: POST .../assignees para adicionar, DELETE .../assignees
      // para remover. Username do GitHub precisa existir e ter acesso ao repo,
      // senão a API simplesmente ignora o nome sem erro (ver nota abaixo).
      const response =
        acao === "remover"
          ? await octokit.rest.issues.removeAssignees({
              owner: process.env.GITHUB_OWNER,
              repo: process.env.GITHUB_REPO,
              issue_number: numero,
              assignees: [usuario],
            })
          : await octokit.rest.issues.addAssignees({
              owner: process.env.GITHUB_OWNER,
              repo: process.env.GITHUB_REPO,
              issue_number: numero,
              assignees: [usuario],
            });

      const issue = response.data;
      const assigneesAtuais = issue.assignees?.length
        ? issue.assignees.map((a) => a.login).join(", ")
        : "Nenhum";

      // A API do GitHub não retorna erro se o username informado não
      // tiver acesso ao repositório — ela apenas ignora silenciosamente
      // esse nome na lista de assignees. Por isso conferimos manualmente
      // se a atribuição realmente "pegou", para avisar o usuário caso não.
      const usuarioConsta = issue.assignees?.some(
        (a) => a.login.toLowerCase() === usuario.toLowerCase()
      );

      if (acao === "atribuir" && !usuarioConsta) {
        const embedAviso = new EmbedBuilder()
          .setColor(0xd29922) // amarelo de aviso
          .setTitle("⚠️ Usuário não foi atribuído")
          .setDescription(
            `O GitHub não atribuiu **${usuario}** à issue #${numero}. ` +
              `Isso geralmente acontece quando o usuário não tem acesso de colaborador a este repositório.`
          );

        await interaction.editReply({ embeds: [embedAviso] });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x2ea44f)
        .setTitle(
          acao === "remover"
            ? `🚫 ${usuario} removido da issue #${issue.number}`
            : `👤 ${usuario} atribuído à issue #${issue.number}`
        )
        .setURL(issue.html_url)
        .addFields(
          { name: "Título", value: issue.title },
          { name: "Responsáveis atuais", value: assigneesAtuais }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Erro ao atribuir/remover assignee da issue no GitHub:", error);

      const embedErro = new EmbedBuilder()
        .setColor(0xd73a49)
        .setTitle("❌ Falha ao atualizar responsáveis")
        .setDescription(traduzirErroGitHub(error, "atualizar os responsáveis da issue"));

      await interaction.editReply({ embeds: [embedErro] });
    }
  },
};
