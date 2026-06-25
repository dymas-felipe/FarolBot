import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Octokit } from "octokit";

// Reaproveita o mesmo padrão de cliente único do GitHub.
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Limite de issues exibidas por página do embed. O Discord aceita até
// 25 "fields" por embed, mas mantemos um número menor para a mensagem
// não ficar gigante e difícil de ler de uma vez.
const ISSUES_POR_PAGINA = 10;

// Tamanho máximo de cada "value" de field no Discord é 1024 caracteres.
// Cortamos o título da issue bem antes disso para nunca ultrapassar.
const TAMANHO_MAX_TITULO = 80;

export default {
  data: new SlashCommandBuilder()
    .setName("listar-issues")
    .setDescription("Mostra as issues abertas no repositório do GitHub configurado")
    .addStringOption((option) =>
      option
        .setName("label")
        .setDescription("Filtrar apenas issues com essa label (ex: bug)")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("pagina")
        .setDescription("Número da página de resultados (padrão: 1)")
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction) {
    const label = interaction.options.getString("label");
    const pagina = interaction.options.getInteger("pagina") ?? 1;

    // Sem flag de Ephemeral aqui de propósito: o objetivo é que todo
    // mundo no canal veja a lista de issues abertas, não só quem rodou
    // o comando.
    await interaction.deferReply();

    try {
      // Endpoint: GET /repos/{owner}/{repo}/issues
      // Por padrão a API do GitHub já retorna apenas issues com state "open",
      // mas deixamos explícito para não depender do comportamento padrão.
      // Pull requests também aparecem nesse endpoint (o GitHub trata PR como
      // um tipo de issue por baixo dos panos), então filtramos elas fora.
      const response = await octokit.rest.issues.listForRepo({
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        state: "open",
        labels: label || undefined,
        per_page: 100, // busca um lote grande; paginamos a exibição nós mesmos
        sort: "created",
        direction: "desc",
      });

      // Remove pull requests da lista (a API do GitHub inclui PRs nesse
      // endpoint; PRs têm a propriedade `pull_request` definida, issues não têm).
      const issuesAbertas = response.data.filter((item) => !item.pull_request);

      if (issuesAbertas.length === 0) {
        const embedVazio = new EmbedBuilder()
          .setColor(0x2ea44f)
          .setTitle("🎉 Nenhuma issue aberta!")
          .setDescription(
            label
              ? `Não há issues abertas com a label \`${label}\` em **${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}**.`
              : `Não há issues abertas em **${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}**.`
          );

        await interaction.editReply({ embeds: [embedVazio] });
        return;
      }

      // Calcula a paginação manual sobre o array já filtrado.
      const totalPaginas = Math.ceil(issuesAbertas.length / ISSUES_POR_PAGINA);
      const paginaValida = Math.min(pagina, totalPaginas);
      const inicio = (paginaValida - 1) * ISSUES_POR_PAGINA;
      const issuesDaPagina = issuesAbertas.slice(inicio, inicio + ISSUES_POR_PAGINA);

      // Monta um field por issue, com link clicável direto pro GitHub.
      // Markdown de link em embed do Discord funciona dentro do texto do field.
      const fields = issuesDaPagina.map((issue) => {
        const tituloCortado =
          issue.title.length > TAMANHO_MAX_TITULO
            ? `${issue.title.slice(0, TAMANHO_MAX_TITULO)}…`
            : issue.title;

        const labelsTexto = issue.labels
          .map((l) => (typeof l === "string" ? l : l.name))
          .join(", ");

        const autor = issue.user?.login ?? "desconhecido";

        return {
          name: `#${issue.number} — ${tituloCortado}`,
          value: [
            `[Abrir no GitHub](${issue.html_url})`,
            `👤 ${autor}${labelsTexto ? ` • 🏷️ ${labelsTexto}` : ""}`,
          ].join("\n"),
        };
      });

      const embedLista = new EmbedBuilder()
        .setColor(0x2ea44f)
        .setTitle(`📋 Issues abertas — ${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`)
        .setDescription(
          `Total: **${issuesAbertas.length}** issue(s) aberta(s)${
            label ? ` com a label \`${label}\`` : ""
          }.`
        )
        .addFields(fields)
        .setFooter({ text: `Página ${paginaValida} de ${totalPaginas}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embedLista] });
    } catch (error) {
      console.error("Erro ao listar issues do GitHub:", error);

      let mensagemErro = "Ocorreu um erro inesperado ao buscar as issues. Tente novamente mais tarde.";

      if (error.status === 401) {
        mensagemErro = "Token do GitHub inválido ou expirado. Avise um administrador do bot.";
      } else if (error.status === 404) {
        mensagemErro =
          "Repositório não encontrado. Verifique se `GITHUB_OWNER`/`GITHUB_REPO` estão corretos e se o token tem acesso a ele.";
      } else if (error.status === 403) {
        mensagemErro = "Sem permissão suficiente no token para ler issues deste repositório.";
      }

      const embedErro = new EmbedBuilder()
        .setColor(0xd73a49)
        .setTitle("❌ Falha ao listar as issues")
        .setDescription(mensagemErro);

      await interaction.editReply({ embeds: [embedErro] });
    }
  },
};
