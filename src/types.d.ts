import { Collection, type InteractionReplyOptions, type MessageCreateOptions } from "discord.js";
import type { Command } from "./bot/commands/Command";
import type { Event } from "./bot/events/Event";
import type { Interval } from "./bot/intervals/Interval";

export type ReplyFunction = (options: MessageCreateOptions | InteractionReplyOptions) => Promise<Message!>;

// Extend the Bun environment to include the bot token, prefix and client ID
declare module "bun" {
    interface Env {
        BOT_TOKEN?: string;
        BOT_PREFIX?: string;
        BOT_OWNER_ID?: string;
        CLIENT_ID?: number;
    }
}

// Extend Client to include commands
declare module "discord.js" {
    interface Client {
        commands: Collection<string, Command>;
        events: Collection<string, Event[]>;
        intervals: Collection<string, Interval>;
    }
}
