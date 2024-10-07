import type { Command } from "@commands/Command";
import path from "path";
import fs from "fs";

export default {
    name: "update",
    description: "Update the bot",
    executeMessage: async (_client, message) => {
        const triggerFile = path.join(process.cwd(), "_BOT_TRIGGERS", "TRIGGER_UPDATE");
        fs.writeFileSync(triggerFile, "");
        await message.reply("Bot update has been queued. Goodbye! :wave:");
    },
    executeSlash: async (_client, interaction) => {
        const triggerFile = path.join(process.cwd(), "_BOT_TRIGGERS", "TRIGGER_UPDATE");
        fs.writeFileSync(triggerFile, "");
        await interaction.reply({ content: "Bot update has been queued. Goodbye! :wave:", ephemeral: true });
    }
} as Command;