import type { Command } from "@commands/Command";
import { prisma } from "@db";
import Logger from "@utils/logger";
import type { ReplyFunction } from "@/types";
import { ActionRowBuilder, EmbedBuilder, ModalBuilder, SlashCommandBuilder, TextInputBuilder, TextInputStyle, type InteractionReplyOptions, type MessageReplyOptions } from "discord.js";
import { PagedEmbed } from "@bot-utils/PagedEmbed";
import type { GuildSettings } from "@prisma/client";
import { env } from "bun";

const logger = new Logger();

const INVISIBLE_CHARACTER = "-";

async function generateHelpReply(
  guildId: string,
  userId: string,
  replyFunction: ReplyFunction,
  guildSettings: GuildSettings | undefined
): Promise<void> {
  const pagedEmbed = new PagedEmbed<{ name: string; id: string }>(
    async (page, itemsPerPage) => {
      const customCommands = await prisma.customCommand.findMany({
        where: { guildId: guildId },
        skip: (page - 1) * itemsPerPage,
        take: itemsPerPage,
        select: { name: true, id: true },
      });
      const totalPages = await prisma.customCommand.count({ where: { guildId } });
      return { items: customCommands, totalPages: Math.ceil(totalPages / itemsPerPage) };
    },
    (displayedCommands: { name: string; id: string }[], currentPage: number, totalPages: number) => {
      let description = `Custom commands are commands that you can add to the bot.\n${displayedCommands.length} commands found.\nTo get more info on a command, use the \`${guildSettings?.prefix ?? env.BOT_PREFIX}custom info [name / uuid]\` command.`;
      const embed = new EmbedBuilder()
        .setTitle("Custom Commands")
        .setColor("#f542dd")
        .setFooter({ text: `Page ${currentPage} • ${totalPages} pages available` });

      description += displayedCommands.map(command => `\n${guildSettings?.prefix ?? env.BOT_PREFIX}${command.name} • (ID: ${command.id})`).join('');

      embed.setDescription(description);

      return embed;
    },
    userId,
    replyFunction,
    { itemsPerPage: 25 }
  );

  await pagedEmbed.createPagedEmbed();
}

export default {
  name: "custom",
  description: "Custom commands",
  async executeMessage(_client, message, args, guildSettings) {
    try {
      await handleCommand(args[0], args.slice(1), message.guildId!, message.author.id, (options) => message.reply(options as MessageReplyOptions), guildSettings);
    } catch (error) {
      logger.error(`Error executing custom command: ${error} for ${message.author.displayName}`);
      message.reply("There was an error executing that command.");
    }
  },
  async executeSlash(_client, interaction, guildSettings) {
    const subcommand = interaction.options.getSubcommand(true);
    let args: string[] = [];

    switch (subcommand) {
      case "list":
        const detailed = interaction.options.getBoolean("detailed") ?? false;
        args = [detailed ? "true" : "false"];
        break;
      case "add":
        if (!interaction.options.getString("name") || !interaction.options.getString("response")) {
          interaction.reply({ content: `Usage: ${guildSettings?.prefix ?? env.BOT_PREFIX}custom add [name] [response]` });
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
          interaction.reply({ content: `Usage: ${interaction.commandName} remove [name / uuid]` });
          return;
        }
        args = [interaction.options.getString("name")!];
        break;
      case "edit":
        if (!interaction.options.getString("name") || !interaction.options.getString("response")) {
          interaction.reply({ content: `Usage: ${interaction.commandName} edit [name / uuid] [new response]` });
          return;
        }
        args = [interaction.options.getString("name")!, interaction.options.getString("response")!];
        break;
      case "clone":
        if (!interaction.options.getString("server")) {
          interaction.reply({ content: `Usage: ${interaction.commandName} clone [server id] (name) (new name)` });
          return;
        }
        args = [interaction.options.getString("server")!, interaction.options.getString("name") ?? "", interaction.options.getString("new-name") ?? ""];
        break;
    }

    try {
      await handleCommand(subcommand, args, interaction.guildId!, interaction.user.id,
        (options) => interaction.reply(options as InteractionReplyOptions), guildSettings);
    } catch (error) {
      logger.error(`Error executing custom command: ${error} for ${interaction.user.displayName}`);
      interaction.reply({ content: "There was an error executing that command." });
    }
  },
  slashCommandData: new SlashCommandBuilder()
    .setName("custom")
    .setDescription("Custom commands")
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List custom commands").addBooleanOption((option) => option.setName('detailed').setDescription('Show detailed information about each command'))
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
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("clone").setDescription("Clone a custom command from another server")
        .addStringOption((option) =>
          option.setName("server").setDescription("The server id of the server to clone the custom command(s) from").setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("name").setDescription("The specific custom command to clone").setRequired(false)
        )
        .addStringOption((option) =>
          option.setName("new-name").setDescription("The new name of the custom command (Used to avoid conflicts)").setRequired(false)
        )
    ),
} satisfies Command;

async function handleCommand(subcommand: string, args: string[], guildId: string, userId: string, replyFunction: ReplyFunction, guildSettings: GuildSettings | undefined) {
  switch (subcommand) {
    case "list":
      await generateHelpReply(guildId, userId, replyFunction, guildSettings);
      break;
    case "add": {
      if (args.length < 2) {
        await replyFunction({ content: `Usage: ${guildSettings?.prefix ?? env.BOT_PREFIX}custom add [name] [response]` });
        return;
      }
      const name = args[0];
      const response = args.slice(1).join(" ");

      // Check if a custom command with the same name already exists
      const existingCommand = await prisma.customCommand.findFirst({ where: { name, guildId } });
      if (existingCommand) {
        await replyFunction({ content: `A custom command with the name **'${name}'** already exists. (ID: ${existingCommand.id})` });
        return;
      }

      const customCommand = await prisma.customCommand.create({
        data: {
          guildId,
          name,
          response,
        },
      });

      await replyFunction({ content: "", embeds: [new EmbedBuilder().setTitle("Custom Command Added").setDescription(`Command **'${customCommand.name}'** with response **'${customCommand.response}'** has been added. (ID: ${customCommand.id})`).setColor("#00ff00")] });
      break;
    }
    case "remove": {
      if (args.length < 1) {
        await replyFunction({ content: `Usage: ${guildSettings?.prefix ?? env.BOT_PREFIX}custom remove [name / uuid]` });
        return;
      }
      const identifier = args[0];

      const customCommand = await prisma.customCommand.findFirst({ where: { OR: [{ name: identifier }, { id: identifier }] } });
      if (!customCommand) {
        await replyFunction({ content: `Couldnt find a command with ID or name **'${identifier}'**` });
        return;
      }
      await prisma.customCommand.delete({ where: { id: customCommand.id } });
      await replyFunction({ content: "", embeds: [new EmbedBuilder().setTitle("Custom Command Removed").setDescription(`Command **'${customCommand.name}'** with response **'${customCommand.response}'** has been removed. (ID: ${customCommand.id})`).setColor("#ff0000")] });
      break;
    }
    case "edit": {
      if (args.length < 2) {
        await replyFunction({ content: `Usage: ${guildSettings?.prefix ?? env.BOT_PREFIX}custom edit [name / uuid] [new response]` });
        return;
      }
      const editIdentifier = args[0];
      const newResponse = args.slice(1).join(" ");
      const customCommand = await prisma.customCommand.findFirst({ where: { OR: [{ name: editIdentifier }, { id: editIdentifier }] } });
      if (!customCommand) {
        await replyFunction({ content: `Couldnt find a command with ID or name **'${editIdentifier}'**` });
        return;
      }
      await prisma.customCommand.update({ where: { id: customCommand.id }, data: { response: newResponse } });
      await replyFunction({ content: "", embeds: [new EmbedBuilder().setTitle("Custom Command Edited").setDescription(`Command **'${customCommand.name}'** with response **'${customCommand.response}'** has been edited. (ID: ${customCommand.id})`).setColor("#00ff00")] });
      break;
    }
    case "info": {
      if (args.length < 1) {
        await replyFunction({ content: `Usage: ${guildSettings?.prefix ?? env.BOT_PREFIX}custom info [name / uuid]` });
        return;
      }
      const identifier = args[0];

      const customCommand = await prisma.customCommand.findFirst({ where: { OR: [{ name: identifier }, { id: identifier }] } });
      if (!customCommand) {
        await replyFunction({ content: `Couldnt find a command with ID or name **'${identifier}'**` });
        return;
      }

      await replyFunction({
        content: "",
        embeds: [
          new EmbedBuilder()
            .setTitle("Custom Command Info")
            .setDescription(`**Name:** ${customCommand.name}\n**ID:** ${customCommand.id}\n**Response:**\n${customCommand.response.replaceAll("https://", "htt" + INVISIBLE_CHARACTER + "ps://")}`)
            .setColor("#0000ff")
            .setFooter({ text: `Use ${guildSettings?.prefix ?? env.BOT_PREFIX}custom edit [name / uuid] [new response] to edit this command.` })
        ]
      });
      break;
    }
    case "clone": {
      if (args.length < 1) {
        await replyFunction({ content: `Usage: ${guildSettings?.prefix ?? env.BOT_PREFIX}custom clone [server id] (name) (new name)` });
        return;
      }
      const serverId = args[0];
      const name = args[1] ?? "";
      const newName = args[2] ?? "";

      if (name.length > 0) {
        // Find the specific custom command to clone
        const customCommand = await prisma.customCommand.findFirst({ where: { name, guildId: serverId } });
        if (!customCommand) {
          await replyFunction({ content: `Couldnt find a command with name **'${name}'**` });
          return;
        }

        // Check if a custom command with the same name already exists
        const existingCommand = await prisma.customCommand.findFirst({ where: { name: newName.length > 0 ? newName : customCommand.name, guildId } });
        if (existingCommand) {
          await replyFunction({ content: `A custom command with the name **'${newName.length > 0 ? newName : customCommand.name}'** already exists in your server (ID: ${existingCommand.id}). Please use a different name.` });
          return;
        }

        // Clone the custom command to the current server
        const newCommand = await prisma.customCommand.create({
          data: {
            guildId,
            name: newName.length > 0 ? newName : customCommand.name,
            response: customCommand.response,
          },
        });

        await replyFunction({ content: "", embeds: [new EmbedBuilder().setTitle("Custom Command Cloned").setDescription(`Command **'${customCommand.name}'** with response **'${customCommand.response}'** has been cloned to the current server. (ID: ${newCommand.id})`).setColor("#00ff00")] });
        break;
      } else {
        // Clone all custom commands from one server to another
        const customCommands = await prisma.customCommand.findMany({ where: { guildId: serverId } });

        if (customCommands.length === 0) {
          await replyFunction({ content: `No custom commands found on server **'${serverId}'**, or the server id is invalid.` });
          return;
        }

        // Check if the current server already has a custom command with the same name
        const existingCommands = await prisma.customCommand.findMany({ where: { guildId, name: { in: customCommands.map((command) => command.name) } } });

        const clonedCommands = customCommands.filter((command) => !existingCommands.some((existingCommand) => existingCommand.name === command.name));

        await prisma.customCommand.createMany({
          data: clonedCommands.map((command) => ({
            guildId,
            name: command.name,
            response: command.response,
          })),
        });

        await replyFunction({
          content: "",
          embeds: [
            new EmbedBuilder()
              .setTitle("Custom Commands Cloned")
              .setDescription(`**${clonedCommands.length}** custom commands from server **'${serverId}'** have been cloned to the current server. (${existingCommands.length} skipped due to name conflicts)`)
              .setColor("#00ff00")
              .addFields(
                {
                  name: "Cloned Commands",
                  value: clonedCommands.map((command) => `**${command.name}**`).join(", "),
                },
                {
                  name: "Skipped Commands",
                  value: existingCommands.map((command) => `**${command.name}**`).join(", "),
                }
              )
          ]
        });
        break;
      }
    }
    default:
      await replyFunction({ content: `Invalid subcommand. Use ${guildSettings?.prefix ?? env.BOT_PREFIX}custom (list|add|remove|edit|info|clone)` });
      break;
  }
}
