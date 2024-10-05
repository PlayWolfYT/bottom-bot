import { Client, Events, Message } from "discord.js";
import type { Event } from "@events/Event";
import { env } from "bun";
import Logger from "@/logger";
import { prisma } from "@/database";

const logger = new Logger();

export default {
  event: Events.MessageCreate,
  async execute(client: Client, message: Message) {
    if (!message.guildId) return;
    const guildSettings = await prisma.guildSettings.findUnique({
      where: {
        guildId: message.guildId,
      },
    });

    const prefix = guildSettings?.prefix || env.BOT_PREFIX || "!";

    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    const command = client.commands.get(commandName!);

    if (!command || !command.executeMessage) {
      logger.debug(
        `Command not found or does not have executeMessage function. Returning...`
      );
      return;
    }

    try {
      logger.debug(`Executing chat-based command: ${commandName}...`);
      await command.executeMessage(client, message, args, guildSettings);
      logger.debug(`Chat-based command executed successfully.`);
    } catch (error) {
      logger.error(`Error executing chat-based command: ${error}`);
      message.reply("There was an error executing that command.");
    }
  },
} as Event;
