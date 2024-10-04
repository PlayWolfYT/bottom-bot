import type { Client, Interaction } from "discord.js";
import type { Event } from "@events/Event";
import { ChannelType, Events } from "discord.js";
import Logger from "@/logger";
const logger = new Logger();

export default {
  event: Events.InteractionCreate,
  async execute(client: Client, interaction: Interaction) {
    if (!interaction.isCommand()) return;

    // Make sure DM interactions get ignored
    if (
      interaction.channel?.type === ChannelType.DM ||
      interaction.channel?.type === ChannelType.GroupDM
    ) {
      await interaction.reply({
        content: "This bot only works in servers.",
        ephemeral: true,
      });
      return;
    }

    const command = client.commands.get(interaction.commandName);

    if (!command || !command.executeSlash) return;

    if (!interaction.isChatInputCommand()) return;

    try {
      await command.executeSlash(client, interaction);
    } catch (error) {
      logger.error(`Error executing interaction-based command: ${error}`);
      await interaction.reply({
        content: "There was an error executing that command.",
        ephemeral: true,
      });
    }
  },
} as Event;