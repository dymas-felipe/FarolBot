import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Octokit } from "octokit";
import { traduzirErroGitHub } from "../utils/githubErrors.js";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const PRS_POR_PAGINA = 10;
const TAMANHO_MAX_TITULO = 80;

export default {
  data: new SlashCommandBuilder()
    .setName("listar-prs")
    .setDescription("Mostra os pull requests abertos no repositório configurado")
    .addIntegerOption((option) =>
      option
        .setName("pagina")
        .setDescription("Número da página de resultados (padrão: 1)")
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction) {
    const pagina = interaction.options.getInteger("pagina") ?? 1;

    await interaction.deferReply();

    try {
      // Endpoint dedicado a pull requests (diferente do endpoint de
      // issues usado em /listar-issues), o que já retorna só PRs,
      // sem precisar filtrar nada manualmente.
      const response = await octokit.rest.pulls.list({
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        state: "open",
        per_page: 100,
        sort: "created",
        direction: "desc",
      });

      const prsAbertos = response.data;

      if (prsAbertos.length === 0) {
        const embedVazio = new EmbedBuilder()
          .setColor(0x2ea44f)
          .setTitle("🎉 Nenhum pull request aberto!")
          .setDescription(
            `Não há pull requests abertos em **${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}**.`
          );

        await interaction.editReply({ embeds: [embedVazio] });
        return;
      }

      const totalPaginas = Math.ceil(prsAbertos.length / PRS_POR_PAGINA);
      const paginaValida = Math.min(pagina, totalPaginas);
      const inicio = (paginaValida - 1) * PRS_POR_PAGINA;
      const prsDaPagina = prsAbertos.slice(inicio, inicio + PRS_POR_PAGINA);

      const fields = prsDaPagina.map((pr) => {
        const tituloCortado =
          pr.title.length > TAMANHO_MAX_TITULO
            ? `${pr.title.slice(0, TAMANHO_MAX_TITULO)}…`
            : pr.title;

        const autor = pr.user?.login ?? "desconhecido";

        // draft = rascunho ainda não pronto para revisão; sinalizamos
        // isso porque normalmente PRs em draft não devem ser revisados ainda.
        const statusDraft = pr.draft ? " 📝 *(rascunho)*" : "";

        return {
          name: `#${pr.number} — ${tituloCortado}${statusDraft}`,
          value: [
            `[Abrir no GitHub](${pr.html_url})`,
            `👤 ${autor} • 🔀 \`${pr.head.ref}\` → \`${pr.base.ref}\``,
          ].join("\n"),
        };
      });

      const embedLista = new EmbedBuilder()
        .setColor(0x1f6feb) // azul, cor que o GitHub usa para PRs abertos
        .setTitle(`🔀 Pull requests abertos — ${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`)
        .setDescription(`Total: **${prsAbertos.length}** PR(s) aberto(s).`)
        .addFields(fields)
        .setFooter({ text: `Página ${paginaValida} de ${totalPaginas}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embedLista] });
    } catch (error) {
      console.error("Erro ao listar pull requests do GitHub:", error);

      const embedErro = new EmbedBuilder()
        .setColor(0xd73a49)
        .setTitle("❌ Falha ao listar os pull requests")
        .setDescription(traduzirErroGitHub(error, "listar os pull requests"));

      await interaction.editReply({ embeds: [embedErro] });
    }
  },
};
