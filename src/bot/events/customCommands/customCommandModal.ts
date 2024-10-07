import { prisma } from "@db";
import type { Event } from "@events/Event";
import { Events } from "discord.js";

export default {
    event: Events.InteractionCreate,
    async execute(_client, interaction) {
        if (!interaction.isModalSubmit() || interaction.customId !== "customAddModal") return;

        if (!interaction.inGuild()) {
            await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
            return;
        }

        const name = interaction.fields.getTextInputValue("customAddName");
        const response = interaction.fields.getTextInputValue("customAddResponse");

        const customCommand = await prisma.customCommand.create({
            data: {
                name,
                response,
                guildId: interaction.guildId!,
            },
        });

        await interaction.reply({ content: `Custom command **'${customCommand.name}'** with response **'${customCommand.response}'** has been added. (ID: ${customCommand.id})` });
    },
} as Event