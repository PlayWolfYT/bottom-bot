import { EmbedBuilder } from "discord.js";

export function createErrorEmbed(message: string, error: Error) {
    return new EmbedBuilder()
        .setTitle("An error occured")
        .setDescription(message)
        .addFields({ name: "Error", value: error.message.substring(0, 1024) })
        .setColor("#ff0000");
}