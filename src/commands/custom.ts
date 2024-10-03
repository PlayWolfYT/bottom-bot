import type { Command } from "@/commands/Command";
import { prisma } from "@/database";
import type { MessageReplyOptions } from "discord.js";
import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

async function generateHelpReply(
  guildId: string,
  page: number = 1
): Promise<MessageReplyOptions> {
  const customCommands = await prisma.customCommand.findMany({
    where: {
      guildId: guildId,
    },
    skip: (page - 1) * 25,
    take: 25,
  });

  const embed = new EmbedBuilder()
    .setTitle("Custom Commands")
    .setDescription(
      "Custom commands are commands that you can add to the bot."
    );

  for (const command of customCommands) {
    embed.addFields({
      name: command.name.slice(0, 256),
      value: command.response.slice(0, 1024),
      inline: true,
    });
  }

  return {
    embeds: [embed],
  };
}

export default {
  name: "custom",
  description: "Custom commands",
  async executeMessage(_client, message, args) {
    const subcommand = args[0]?.toLowerCase();

    switch (subcommand) {
      case "list":
        // TODO: Implement listing custom commands
        message.reply(await generateHelpReply(message.guildId!));
        break;
      case "add":
        if (args.length < 3) {
          message.reply("Usage: !custom add [name] [response]");
          return;
        }
        const name = args[1];
        const response = args.slice(2).join(" ");
        // TODO: Implement adding custom command
        message.reply(`Adding custom command: ${name} (not implemented yet)`);
        break;
      case "remove":
        if (args.length < 2) {
          message.reply("Usage: !custom remove [name / uuid]");
          return;
        }
        const identifier = args[1];
        // TODO: Implement removing custom command
        message.reply(
          `Removing custom command: ${identifier} (not implemented yet)`
        );
        break;
      case "edit":
        if (args.length < 3) {
          message.reply("Usage: !custom edit [name / uuid] [new response]");
          return;
        }
        const editIdentifier = args[1];
        const newResponse = args.slice(2).join(" ");
        // TODO: Implement editing custom command
        message.reply(
          `Editing custom command: ${editIdentifier} (not implemented yet)`
        );
        break;
      default:
        message.reply("Invalid subcommand. Use !custom (list|add|remove|edit)");
    }
  },
  executeSlash(client, interaction) {
    interaction.reply("Custom Command Test");
  },
  slashCommandData: new SlashCommandBuilder()
    .setName("custom")
    .setDescription("Custom commands")
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List custom commands")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("add").setDescription("Add a custom command")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("remove").setDescription("Remove a custom command")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("edit").setDescription("Edit a custom command")
    ),
} as Command;
