import type { GuildSettings } from "@prisma/client";
import {
  Client,
  Message,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  type SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

export interface Command {
  name: string;
  description: string;
  executeMessage?: (
    client: Client,
    message: Message,
    args: string[],
    guildSettings: GuildSettings
  ) => Promise<void>;
  executeSlash?: (
    client: Client,
    interaction: ChatInputCommandInteraction,
    guildSettings: GuildSettings
  ) => Promise<void>;
  slashCommandData?: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
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
