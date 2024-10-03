import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import { readdirSync } from "fs";
import { isCommand, type Command } from "@commands/Command";
import { env } from "bun";
import { validateEnvVariables } from "@/env-variables";
import { type RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js";

validateEnvVariables();

const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

// Updated command loading logic
const commandFiles = readdirSync("./src/commands", {
  recursive: true,
}).filter(
  (file) =>
    ((file as string).endsWith(".ts") || (file as string).endsWith(".js")) &&
    file !== "Command.ts"
);

for (const file of commandFiles) {
  const command: Command | any = require(`./commands/${file}`).default;

  if (!isCommand(command)) {
    console.error(`Command ${file} is not a valid command.`);
    continue;
  } else if (command.executeSlash) {
    commands.push(
      command.slashCommandData?.toJSON() ?? {
        name: command.name,
        description: command.description,
      }
    );
    console.log(`Slash command '${command.name}' loaded successfully.`);
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
