import type { Client, Interaction } from "discord.js";
import type { Event } from "@events/Event";
import { Events } from "discord.js";
import Logger from "@utils/logger";
import { prisma } from "@db";
const logger = new Logger();

export default {
  event: Events.InteractionCreate,
  async execute(client: Client, interaction: Interaction) {
    if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) return;

    // Make sure DM interactions get ignored
    if (!interaction.inGuild()) {
      if (interaction.isAutocomplete()) return;
      await interaction.reply({
        content: "This bot only works in servers.",
        ephemeral: true,
      });
      return;
    }

    let guildSettings;

    try {
      guildSettings = await prisma.guildSettings.findUniqueOrThrow({
        where: {
          guildId: interaction.guildId,
        },
      });
    } catch (error) {
      guildSettings = undefined;
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    if (interaction.isChatInputCommand() && command.executeSlash) {
      try {
        await command.executeSlash(client, interaction, guildSettings);
      } catch (error) {
        logger.error(`Error executing interaction-based command: ${error}`);
        await interaction.reply({
          content: "There was an error executing that command.",
          ephemeral: true,
        });
      }
    } else if (interaction.isAutocomplete() && command.autoComplete) {
      try {
        await command.autoComplete(client, interaction, guildSettings);
      } catch (error) {
        logger.error(`Error executing interaction-based command: ${error}`);
        await interaction.respond([]);
      }
    }
  },
} as Event;