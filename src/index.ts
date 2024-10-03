import { env } from "bun";
import { Client, Collection, IntentsBitField } from "discord.js";
import { isCommand, type Command } from "@commands/Command";
import { readdirSync } from "fs";
import { validateEnvVariables } from "@/env-variables";
import { prisma } from "@db";

validateEnvVariables();

const prefix = env.BOT_PREFIX || "!";

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

client.commands = new Collection();

// Load command files
const commandFiles = readdirSync("@commands").filter(
  (file) => file.endsWith(".ts") || file.endsWith(".js")
);

for (const file of commandFiles) {
  const command: Command | any = require(`@commands/${file}`).default;

  if (!isCommand(command)) {
    console.error(`Command ${file} is not a valid command.`);
    continue;
  } else {
    client.commands.set(command.name, command);
    console.log(`Command '${command.name}' loaded successfully.`);
  }
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

// Message event listener
client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();

  console.debug(`Searching for command: '${commandName}'...`);

  const command = client.commands.get(commandName!);

  if (!command || !command.executeMessage) {
    console.debug(
      `Command not found or does not have executeMessage function. Returning...`
    );
    return;
  }

  try {
    console.debug(`Executing command: ${commandName}...`);
    await command.executeMessage(client, message, args);
    console.debug(`Command executed successfully.`);
  } catch (error) {
    console.error(error);
    message.reply("There was an error executing that command.");
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command || !command.executeSlash) return;

  try {
    await command.executeSlash(client, interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: "There was an error executing that command.",
      ephemeral: true,
    });
  }
});

// Add shutdown hook
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}. Logging out and shutting down...`);

  let error = false;

  try {
    await client.destroy();
    console.log("Successfully logged out and destroyed the client.");
  } catch (err) {
    error = true;
    console.error("Error during logout:", err);
  }

  try {
    await prisma.$disconnect();
    console.log("Successfully disconnected from the database.");
  } catch (err) {
    error = true;
    console.error("Error during database disconnection:", err);
  }

  process.exit(error ? 1 : 0);
}

client.login(env.BOT_TOKEN);
