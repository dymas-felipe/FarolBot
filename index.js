// index.js
//
// Ponto de entrada do bot. Conecta ao Discord via Gateway e fica
// escutando interações (slash commands) o tempo todo.

// IMPORTANTE: este import precisa ser o primeiro de todos. Ele carrega
// o .env antes que qualquer outro módulo (como os comandos, que
// instanciam o Octokit já no topo do arquivo) tente ler process.env.
import "./loadEnv.js";

import { Client, Collection, GatewayIntentBits, Events } from "discord.js";
import criarIssue from "./commands/criarIssue.js";
import listarIssues from "./commands/listarIssues.js";

const { DISCORD_TOKEN } = process.env;

if (!DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN não definido no .env");
  process.exit(1);
}

// Intents mínimas: como só usamos Slash Commands (interações), não
// precisamos de intents privilegiadas como leitura de mensagens ou
// presença de membros. Isso evita a necessidade de habilitar
// "Privileged Gateway Intents" no Developer Portal.
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Collection mapeia nome do comando -> módulo do comando, permitindo
// adicionar novos comandos no futuro sem precisar tocar no index.js.
client.commands = new Collection();
client.commands.set(criarIssue.data.name, criarIssue);
client.commands.set(listarIssues.data.name, listarIssues);

// Disparado uma vez quando o bot termina de logar com sucesso.
client.once(Events.ClientReady, (readyClient) => {
  console.log(`🤖 Bot online como ${readyClient.user.tag}`);
});

// Disparado a cada interação (slash command, botão, etc.) no servidor.
client.on(Events.InteractionCreate, async (interaction) => {
  // Filtra apenas interações de Slash Command; ignora outras (botões,
  // menus, etc.) que este bot não trata.
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.warn(`⚠️ Comando "${interaction.commandName}" não encontrado.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    // Camada extra de segurança: se o próprio comando deixar escapar
    // um erro não tratado, ainda assim respondemos ao usuário em vez
    // de deixar a interação travada em "Bot está pensando...".
    console.error(`Erro ao executar o comando "${interaction.commandName}":`, error);

    const respostaErro = {
      content: "❌ Ocorreu um erro inesperado ao executar este comando.",
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(respostaErro);
    } else {
      await interaction.reply(respostaErro);
    }
  }
});

client.login(DISCORD_TOKEN);
