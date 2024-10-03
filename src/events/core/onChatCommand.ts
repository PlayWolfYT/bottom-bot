import { ChannelType, Client, Message } from "discord.js";
import type { Event } from "@events/Event";
import { env } from "bun";

const prefix = env.BOT_PREFIX || "!";

const messageCreateEvent: Event = {
  event: "messageCreate",
  async execute(client: Client, message: Message) {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    // Make sure DM messages get ignored
    if (
      message.channel.type === ChannelType.DM ||
      message.channel.type === ChannelType.GroupDM
    ) {
      message.reply("This bot only works in servers.");
      return;
    }

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    const command = client.commands.get(commandName!);

    if (!command || !command.executeMessage) {
      console.debug(
        `Command not found or does not have executeMessage function. Returning...`
      );
      return;
    }

    try {
      console.debug(`Executing chat-based command: ${commandName}...`);
      await command.executeMessage(client, message, args);
      console.debug(`Chat-based command executed successfully.`);
    } catch (error) {
      console.error(error);
      message.reply("There was an error executing that command.");
    }
  },
};

export default messageCreateEvent;
