import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Octokit } from "octokit";
import { traduzirErroGitHub } from "../utils/githubErrors.js";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export default {
  data: new SlashCommandBuilder()
    .setName("reabrir-issue")
    .setDescription("Reabre uma issue que estava fechada")
    .addIntegerOption((option) =>
      option
        .setName("numero")
        .setDescription("Número da issue a ser reaberta (ex: 42)")
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction) {
    const numero = interaction.options.getInteger("numero");

    await interaction.deferReply();

    try {
      const response = await octokit.rest.issues.update({
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        issue_number: numero,
        state: "open",
      });

      const issue = response.data;

      // Deixa um rastro no histórico da issue no GitHub indicando que
      // a reabertura partiu do Discord, e por quem.
      await octokit.rest.issues.createComment({
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        issue_number: numero,
        body: `🔓 Issue reaberta via Discord por **${interaction.user.tag}**`,
      });

      const embed = new EmbedBuilder()
        .setColor(0x2ea44f)
        .setTitle(`🔓 Issue #${issue.number} reaberta`)
        .setURL(issue.html_url)
        .addFields(
          { name: "Título", value: issue.title },
          { name: "Reaberta por", value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Erro ao reabrir issue no GitHub:", error);

      const embedErro = new EmbedBuilder()
        .setColor(0xd73a49)
        .setTitle("❌ Falha ao reabrir a issue")
        .setDescription(traduzirErroGitHub(error, "reabrir a issue"));

      await interaction.editReply({ embeds: [embedErro] });
    }
  },
};
