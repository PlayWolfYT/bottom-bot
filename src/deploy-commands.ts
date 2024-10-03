import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import { readdirSync } from "fs";
import { isCommand, type Command } from "@commands/Command";
import { env } from "bun";
import { validateEnvVariables } from "@/env-variables";

validateEnvVariables();

const commands = [];
const commandFiles = readdirSync("@commands").filter(
  (file) => file.endsWith(".ts") || file.endsWith(".js")
);

for (const file of commandFiles) {
  const command: Command = require(`@commands/${file}`).default;
  if (!isCommand(command)) {
    console.error(`Command ${file} is not a valid command.`);
    continue;
  } else if (command.executeSlash) {
    commands.push({
      name: command.name,
      description: command.description,
    });
  } else {
    console.debug(
      `Command ${file} does not have a slash command implementation.`
    );
  }
}

const rest = new REST({ version: "10" }).setToken(env.BOT_TOKEN!);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationCommands(env.CLIENT_ID!.toString()), {
      body: commands,
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();
