import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Octokit } from "octokit";
import { traduzirErroGitHub } from "../utils/githubErrors.js";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export default {
  data: new SlashCommandBuilder()
    .setName("comentar-issue")
    .setDescription("Adiciona um comentário em uma issue existente")
    .addIntegerOption((option) =>
      option
        .setName("numero")
        .setDescription("Número da issue (ex: 42)")
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((option) =>
      option
        .setName("comentario")
        .setDescription("Texto do comentário a ser adicionado")
        .setRequired(true)
    ),

  async execute(interaction) {
    const numero = interaction.options.getInteger("numero");
    const comentario = interaction.options.getString("comentario");

    await interaction.deferReply();

    try {
      // Identifica quem comentou, já que o comentário no GitHub vai
      // aparecer postado pela conta do bot, não pela conta da pessoa
      // que rodou o comando no Discord.
      const corpoFormatado = [
        comentario,
        "",
        `— via Discord, **${interaction.user.tag}**`,
      ].join("\n");

      // Endpoint: POST /repos/{owner}/{repo}/issues/{issue_number}/comments
      const response = await octokit.rest.issues.createComment({
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        issue_number: numero,
        body: corpoFormatado,
      });

      const comentarioCriado = response.data;

      const embed = new EmbedBuilder()
        .setColor(0x2ea44f)
        .setTitle(`💬 Comentário adicionado à issue #${numero}`)
        .setURL(comentarioCriado.html_url)
        .setDescription(comentario)
        .setFooter({ text: `Comentado por ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Erro ao comentar na issue do GitHub:", error);

      const embedErro = new EmbedBuilder()
        .setColor(0xd73a49)
        .setTitle("❌ Falha ao adicionar o comentário")
        .setDescription(traduzirErroGitHub(error, "comentar na issue"));

      await interaction.editReply({ embeds: [embedErro] });
    }
  },
};
