import type { Client, Interaction } from "discord.js";
import type { Event } from "@events/Event";
import { Events } from "discord.js";
import Logger from "@utils/logger";
import { prisma } from "@db";
const logger = new Logger();

export default {
  event: Events.InteractionCreate,
  async execute(client: Client, interaction: Interaction) {
    if (!interaction.isCommand()) return;

    // Make sure DM interactions get ignored
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "This bot only works in servers.",
        ephemeral: true,
      });
      return;
    }

    const guildSettings = await prisma.guildSettings.findUnique({
      where: {
        guildId: interaction.guildId,
      },
    });

    const command = client.commands.get(interaction.commandName);

    if (!command || !command.executeSlash) return;

    if (!interaction.isChatInputCommand()) return;

    try {
      await command.executeSlash(client, interaction, guildSettings);
    } catch (error) {
      logger.error(`Error executing interaction-based command: ${error}`);
      await interaction.reply({
        content: "There was an error executing that command.",
        ephemeral: true,
      });
    }
  },
} as Event;