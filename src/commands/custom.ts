import type { Command } from "@/commands/Command";
import { prisma } from "@/database";
import Logger from "@/logger";
import type { ReplyFunction } from "@/types";
import { ActionRowBuilder, EmbedBuilder, ModalBuilder, SlashCommandBuilder, TextInputBuilder, TextInputStyle, type InteractionReplyOptions, type MessageReplyOptions } from "discord.js";
import { PagedEmbed } from "@/utils/PagedEmbed";
import type { CustomCommand } from "@prisma/client";

const logger = new Logger();

async function generateHelpReply(
  guildId: string,
  userId: string,
  replyFunction: ReplyFunction
): Promise<void> {
  const pagedEmbed = new PagedEmbed<CustomCommand>(
    async (page, itemsPerPage) => {
      const customCommands = await prisma.customCommand.findMany({
        where: { guildId: guildId },
        skip: (page - 1) * itemsPerPage,
        take: itemsPerPage,
      });
      const totalPages = await prisma.customCommand.count({ where: { guildId } });
      return { items: customCommands, totalPages: Math.ceil(totalPages / itemsPerPage) };
    },
    (displayedCommands, currentPage, totalPages) => {
      const embed = new EmbedBuilder()
        .setTitle("Custom Commands")
        .setDescription(`Custom commands are commands that you can add to the bot.\n${displayedCommands.length} commands found.`)
        .setColor("#f542dd")
        .setFooter({ text: `Page ${currentPage} • ${totalPages} pages available` });

      for (const command of displayedCommands) {
        embed.addFields({
          name: command.name.slice(0, 256),
          value: command.response.slice(0, 1024),
          inline: true,
        });
      }

      return embed;
    },
    userId,
    replyFunction,
  );

  await pagedEmbed.createPagedEmbed();
}

export default {
  name: "custom",
  description: "Custom commands",
  async executeMessage(_client, message, args) {
    try {
      await handleCommand(args[0], args.slice(1), message.guildId!, message.author.id, (options) => message.reply(options as MessageReplyOptions));
    } catch (error) {
      logger.error(`Error executing custom command: ${error} for ${message.author.displayName}`);
      message.reply("There was an error executing that command.");
    }
  },
  async executeSlash(_client, interaction) {
    const subcommand = interaction.options.getSubcommand(true);
    let args: string[] = [];

    switch (subcommand) {
      case "list":
        break;
      case "add":
        if (!interaction.options.getString("name") || !interaction.options.getString("response")) {
          interaction.reply({ content: "Usage: !custom add [name] [response]" });
          return;
        }
        args = [interaction.options.getString("name")!, interaction.options.getString("response")!];
        break;
      case "add-modal":
        await interaction.showModal(new ModalBuilder().setTitle("Add Custom Command").setCustomId("customAddModal").addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId("customAddName").setLabel("Name").setPlaceholder("The name of the custom command").setStyle(TextInputStyle.Short)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId("customAddResponse").setLabel("Response").setPlaceholder("The response of the custom command").setStyle(TextInputStyle.Paragraph)
          )
        ))
        return;
      case "remove":
        if (!interaction.options.getString("name")) {
          interaction.reply({ content: "Usage: !custom remove [name / uuid]" });
          return;
        }
        args = [interaction.options.getString("name")!];
        break;
      case "edit":
        if (!interaction.options.getString("name") || !interaction.options.getString("response")) {
          interaction.reply({ content: "Usage: !custom edit [name / uuid] [new response]" });
          return;
        }
        args = [interaction.options.getString("name")!, interaction.options.getString("response")!];
        break;
    }

    try {
      await handleCommand(subcommand, args, interaction.guildId!, interaction.user.id,
        (options) => interaction.reply(options as InteractionReplyOptions));
    } catch (error) {
      logger.error(`Error executing custom command: ${error} for ${interaction.user.displayName}`);
      interaction.reply({ content: "There was an error executing that command." });
    }
  },
  slashCommandData: new SlashCommandBuilder()
    .setName("custom")
    .setDescription("Custom commands")
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List custom commands")
    )

    .addSubcommand((subcommand) =>
      subcommand.setName("add").setDescription("Add a custom command")
        .addStringOption((option) =>
          option.setName("name").setDescription("The name of the custom command").setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("response").setDescription("The response of the custom command").setRequired(true)
        )
    ).addSubcommand((subcommand) =>
      subcommand.setName("add-modal").setDescription("Open a modal to add a custom command")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("remove").setDescription("Remove a custom command")
        .addStringOption((option) =>
          option.setName("name").setDescription("The name of the custom command").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("edit").setDescription("Edit a custom command")
        .addStringOption((option) =>
          option.setName("name").setDescription("The name of the custom command").setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("response").setDescription("The response of the custom command").setRequired(true)
        )
    ),
} as Command;

async function handleCommand(subcommand: string, args: string[], guildId: string, userId: string, replyFunction: ReplyFunction) {
  switch (subcommand) {
    case "list":
      await generateHelpReply(guildId, userId, replyFunction);
      break;
    case "add":
      if (args.length < 2) {
        logger.debug(`Invalid number of arguments for add subcommand: ${args.length} (${args.join(" ")})`);
        await replyFunction({ content: "Usage: !custom add [name] [response]" });
        return;
      }
      const name = args[0];
      const response = args.slice(1).join(" ");

      const customCommand = await prisma.customCommand.create({
        data: {
          guildId,
          name,
          response,
        },
      });

      await replyFunction({ content: "", embeds: [new EmbedBuilder().setTitle("Custom Command Added").setDescription(`Command **'${customCommand.name}'** with response **'${customCommand.response}'** has been added. (ID: ${customCommand.id})`).setColor("#00ff00")] });
      break;
    case "remove":
      if (args.length < 2) {
        logger.debug(`Invalid number of arguments for remove subcommand: ${args.length} (${args.join(" ")})`);
        await replyFunction({ content: "Usage: !custom remove [name / uuid]" });
        return;
      }
      const identifier = args[1];
      // TODO: Implement removing custom command
      await replyFunction({ content: `Removing custom command: ${identifier} (not implemented yet)` });
      break;
    case "edit":
      if (args.length < 3) {
        logger.debug(`Invalid number of arguments for edit subcommand: ${args.length} (${args.join(" ")})`);
        await replyFunction({ content: "Usage: !custom edit [name / uuid] [new response]" });
        return;
      }
      const editIdentifier = args[1];
      const newResponse = args.slice(2).join(" ");
      // TODO: Implement editing custom command
      await replyFunction({ content: `Editing custom command: ${editIdentifier} (not implemented yet)` });
      break;
    default:
      await replyFunction({ content: "Invalid subcommand. Use !custom (list|add|remove|edit)" });
      break;
  }
}
