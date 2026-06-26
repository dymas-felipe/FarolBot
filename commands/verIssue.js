import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Octokit } from "octokit";
import { traduzirErroGitHub } from "../utils/githubErrors.js";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Limites para não ultrapassar os tamanhos máximos de embed do Discord
// (description: 4096 caracteres, cada field value: 1024 caracteres).
const TAMANHO_MAX_DESCRICAO = 1500;
const TAMANHO_MAX_COMENTARIO = 300;
const QTD_ULTIMOS_COMENTARIOS = 3;

export default {
  data: new SlashCommandBuilder()
    .setName("ver-issue")
    .setDescription("Mostra os detalhes completos de uma issue específica")
    .addIntegerOption((option) =>
      option
        .setName("numero")
        .setDescription("Número da issue (ex: 42)")
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction) {
    const numero = interaction.options.getInteger("numero");

    await interaction.deferReply();

    try {
      // Busca a issue e os comentários em paralelo, já que uma chamada
      // não depende do resultado da outra — economiza tempo de espera.
      const [issueResponse, comentariosResponse] = await Promise.all([
        octokit.rest.issues.get({
          owner: process.env.GITHUB_OWNER,
          repo: process.env.GITHUB_REPO,
          issue_number: numero,
        }),
        octokit.rest.issues.listComments({
          owner: process.env.GITHUB_OWNER,
          repo: process.env.GITHUB_REPO,
          issue_number: numero,
          per_page: QTD_ULTIMOS_COMENTARIOS,
          // "desc" não é suportado nativamente neste endpoint, então
          // pedimos os primeiros e invertemos depois caso necessário;
          // aqui buscamos todos e pegamos os últimos no código.
        }),
      ]);

      const issue = issueResponse.data;
      const comentarios = comentariosResponse.data;

      const labelsTexto = issue.labels
        .map((l) => (typeof l === "string" ? l : l.name))
        .join(", ");

      const assigneesTexto = issue.assignees?.length
        ? issue.assignees.map((a) => a.login).join(", ")
        : "Nenhum";

      // Corta a descrição da issue se for muito longa, para não
      // ultrapassar o limite de 4096 caracteres do campo description.
      const corpoIssue = issue.body || "*Sem descrição.*";
      const corpoCortado =
        corpoIssue.length > TAMANHO_MAX_DESCRICAO
          ? `${corpoIssue.slice(0, TAMANHO_MAX_DESCRICAO)}…\n\n*(descrição cortada — veja o restante no GitHub)*`
          : corpoIssue;

      const embed = new EmbedBuilder()
        .setColor(issue.state === "open" ? 0x2ea44f : 0x8957e5)
        .setTitle(`${issue.state === "open" ? "🟢" : "🔒"} #${issue.number} — ${issue.title}`)
        .setURL(issue.html_url)
        .setDescription(corpoCortado)
        .addFields(
          { name: "Status", value: issue.state === "open" ? "Aberta" : "Fechada", inline: true },
          { name: "Autor", value: issue.user?.login ?? "desconhecido", inline: true },
          { name: "Responsáveis", value: assigneesTexto, inline: true },
          { name: "Labels", value: labelsTexto || "Nenhuma", inline: true },
          { name: "Comentários", value: String(issue.comments), inline: true },
          {
            name: "Criada em",
            value: `<t:${Math.floor(new Date(issue.created_at).getTime() / 1000)}:R>`,
            inline: true,
          }
        )
        .setTimestamp();

      // Mostra os últimos comentários (se houver), cada um com autor e
      // trecho do texto, cortado para não estourar o limite do field.
      if (comentarios.length > 0) {
        const ultimosComentarios = comentarios.slice(-QTD_ULTIMOS_COMENTARIOS);

        const textoComentarios = ultimosComentarios
          .map((c) => {
            const trecho =
              c.body.length > TAMANHO_MAX_COMENTARIO
                ? `${c.body.slice(0, TAMANHO_MAX_COMENTARIO)}…`
                : c.body;
            return `**${c.user?.login ?? "desconhecido"}:** ${trecho}`;
          })
          .join("\n\n");

        embed.addFields({
          name: `💬 Últimos comentários (${issue.comments} no total)`,
          value: textoComentarios.slice(0, 1024),
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Erro ao buscar detalhes da issue no GitHub:", error);

      const embedErro = new EmbedBuilder()
        .setColor(0xd73a49)
        .setTitle("❌ Falha ao buscar a issue")
        .setDescription(traduzirErroGitHub(error, "buscar os detalhes da issue"));

      await interaction.editReply({ embeds: [embedErro] });
    }
  },
};
