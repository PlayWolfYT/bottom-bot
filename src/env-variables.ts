import type { Collection } from "discord.js";
import type { Command } from "@commands/Command";
import { env } from "bun";
import type { Event } from "@/events/Event";

// Extend the Bun environment to include the bot token, prefix and client ID
declare module "bun" {
  interface Env {
    BOT_TOKEN?: string;
    BOT_PREFIX?: string;
    CLIENT_ID?: number;
  }
}

// Extend Client to include commands
declare module "discord.js" {
  interface Client {
    commands: Collection<string, Command>;
    events: Collection<string, Event[]>;
  }
}

export function validateEnvVariables() {
  if (!env.BOT_TOKEN) {
    console.error("BOT_TOKEN must be set in the environment variables.");
    process.exit(1);
  }
  if (!env.CLIENT_ID) {
    console.error("CLIENT_ID must be set in the environment variables.");
    process.exit(1);
  }
}
