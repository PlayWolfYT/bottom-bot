import type { GuildSettings } from "@prisma/client";
import {
  Client,
  Message,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  type SlashCommandSubcommandsOnlyBuilder,
  AutocompleteInteraction,
} from "discord.js";

export interface Command {
  name: string;
  description: string;
  executeMessage?: (
    client: Client,
    message: Message,
    args: string[],
    guildSettings: GuildSettings | undefined
  ) => Promise<void>;
  executeSlash?: (
    client: Client,
    interaction: ChatInputCommandInteraction,
    guildSettings: GuildSettings | undefined
  ) => Promise<void>;
  slashCommandData?: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  autoComplete?: (
    client: Client,
    interaction: AutocompleteInteraction,
    guildSettings: GuildSettings | undefined
  ) => Promise<void>;
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
