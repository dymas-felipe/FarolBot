import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Octokit } from "octokit";
import { traduzirErroGitHub } from "../utils/githubErrors.js";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export default {
  data: new SlashCommandBuilder()
    .setName("fechar-issue")
    .setDescription("Fecha uma issue existente no repositório configurado")
    .addIntegerOption((option) =>
      option
        .setName("numero")
        .setDescription("Número da issue a ser fechada (ex: 42)")
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((option) =>
      option
        .setName("motivo")
        .setDescription("Comentário opcional explicando o motivo do fechamento")
        .setRequired(false)
    ),

  async execute(interaction) {
    const numero = interaction.options.getInteger("numero");
    const motivo = interaction.options.getString("motivo");

    await interaction.deferReply();

    try {
      // Se um motivo foi informado, postamos como comentário antes de
      // fechar — assim o histórico da issue no GitHub fica claro sobre
      // por que ela foi encerrada, e quem fechou via Discord.
      if (motivo) {
        await octokit.rest.issues.createComment({
          owner: process.env.GITHUB_OWNER,
          repo: process.env.GITHUB_REPO,
          issue_number: numero,
          body: `🔒 ${motivo}\n\n— Fechada via Discord por **${interaction.user.tag}**`,
        });
      }

      // Endpoint: PATCH /repos/{owner}/{repo}/issues/{issue_number}
      // state_reason "completed" marca como resolvida (vs "not_planned"
      // para quando a issue é fechada sem ter sido implementada).
      const response = await octokit.rest.issues.update({
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        issue_number: numero,
        state: "closed",
        state_reason: "completed",
      });

      const issue = response.data;

      const embed = new EmbedBuilder()
        .setColor(0x8957e5) // roxo, mesma cor que o GitHub usa para issues fechadas
        .setTitle(`🔒 Issue #${issue.number} fechada`)
        .setURL(issue.html_url)
        .addFields(
          { name: "Título", value: issue.title },
          { name: "Fechada por", value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

      if (motivo) {
        embed.addFields({ name: "Motivo", value: motivo });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Erro ao fechar issue no GitHub:", error);

      const embedErro = new EmbedBuilder()
        .setColor(0xd73a49)
        .setTitle("❌ Falha ao fechar a issue")
        .setDescription(traduzirErroGitHub(error, "fechar a issue"));

      await interaction.editReply({ embeds: [embedErro] });
    }
  },
};
