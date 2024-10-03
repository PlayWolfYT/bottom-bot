import {
  Client,
  Message,
  CommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

export interface Command {
  name: string;
  description: string;
  executeMessage?: (
    client: Client,
    message: Message,
    args: string[]
  ) => Promise<void>;
  executeSlash?: (
    client: Client,
    interaction: CommandInteraction
  ) => Promise<void>;
  slashCommandData?: SlashCommandBuilder;
}

export function isCommand(command: Command | any): command is Command {
  if (typeof command !== "object" || command === null) {
    return false;
  }

  return (
    "name" in command &&
    "description" in command &&
    ("executeMessage" in command || "executeSlash" in command)
  );
}
