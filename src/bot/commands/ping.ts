import type { Command } from "@commands/Command";
import { Client, Message, CommandInteraction } from "discord.js";

export default {
  name: "ping",
  description: "Replies with Pong!",
  executeMessage: async (
    _client: Client,
    message: Message,
    _args: string[]
  ) => {
    await message.reply({
      embeds: [generatePingEmbed(message.createdTimestamp, message.client)],
    });
  },
  executeSlash: async (_client: Client, interaction: CommandInteraction) => {
    await interaction.reply({
      embeds: [
        generatePingEmbed(interaction.createdTimestamp, interaction.client),
      ],
    });
  },
} satisfies Command;

function generatePingEmbed(creationTimestamp: number, client: Client) {
  const ping = Date.now() - creationTimestamp;
  const gatewayPing = client.ws.ping;
  return {
    title: "Pong!",
    description: `Ping: ${ping}ms\nGateway Ping: ${gatewayPing}ms`,
    color: ping < 100 ? 0x00ff00 : ping < 200 ? 0xffff00 : 0xff0000,
  };
}