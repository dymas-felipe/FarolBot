// deploy-commands.js
//
// Este script é executado SEPARADAMENTE do bot (você roda ele uma vez,
// ou sempre que adicionar/alterar um comando). Ele avisa o Discord
// quais Slash Commands existem, com quais parâmetros.
//
// Usamos GUILD_ID aqui (registro "de servidor") porque a propagação é
// instantânea — ótimo para desenvolvimento. Registro global (sem GUILD_ID)
// pode levar até 1h para aparecer em todos os servidores.

// IMPORTANTE: este import precisa ser o primeiro de todos, pelo mesmo
// motivo explicado no index.js — garante que o .env já está carregado
// antes dos módulos de comando serem importados.
import "./loadEnv.js";

import { REST, Routes } from "discord.js";
import criarIssue from "./commands/criarIssue.js";
import listarIssues from "./commands/listarIssues.js";

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

// Validação simples para falhar rápido caso falte alguma variável de ambiente
if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error(
    "❌ Variáveis de ambiente faltando. Verifique DISCORD_TOKEN, CLIENT_ID e GUILD_ID no .env"
  );
  process.exit(1);
}

// Cada comando exporta sua definição em `data` (SlashCommandBuilder).
// O .toJSON() converte para o formato que a API do Discord espera.
const commands = [criarIssue.data.toJSON(), listarIssues.data.toJSON()];

const rest = new REST().setToken(DISCORD_TOKEN);

try {
  console.log(`🔄 Registrando ${commands.length} slash command(s)...`);

  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands,
  });

  console.log("✅ Slash commands registrados com sucesso!");
} catch (error) {
  console.error("❌ Erro ao registrar os comandos:", error);
}
