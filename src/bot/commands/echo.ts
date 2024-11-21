import { SlashCommandBuilder } from "discord.js";
import type { Command } from "./Command";
import { env } from "bun";

export default {
    name: "echo",
    description: "Echo a message to the channel",
    executeMessage: async (_client, message, args) => {
        // Delete the message, then echo the content to the channel
        if (message.author.bot) return;
        if (!message.channel.isSendable()) return;
        if (env.BOT_OWNER_ID && message.author.id !== env.BOT_OWNER_ID) return;

        const content = args.join(" ");
        if (content === "") {
            return;
        }

        await message.delete();
        await message.channel.send({ content });
    },
    executeSlash: async (_client, interaction) => {
        if (!interaction.channel?.isSendable()) return;

        const content = interaction.options.getString("content", true).trim();
        if (content === "") {
            interaction.reply({ content: "No content provided!", ephemeral: true });
            return;
        }

        await interaction.reply({ content: "Echoed!", ephemeral: true });
        await interaction.channel.send({ content });
    },
    slashCommandData: new SlashCommandBuilder()
        .setName("echo")
        .setDescription("Echo a message to the channel")
        .addStringOption(option => option.setName("content").setDescription("The content to echo").setRequired(true))
} satisfies Command;