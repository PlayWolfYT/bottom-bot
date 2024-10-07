import { prisma } from "@/database";
import type { Event } from "@events/Event";
import { Events } from "discord.js";

export default {
    event: Events.MessageCreate,
    async execute(client, message) {
        if (message.author.bot) return;
        if (!message.reference?.messageId) return;

        // Check if the referenced message is a reply from the bot to a reminder
        const reminderReply = await message.channel.messages.fetch(message.reference.messageId);
        if (reminderReply.author.id !== client.user?.id) return;

        // Check if the user wants to cancel the reminder
        if (message.content.toLowerCase().includes("cancel")) {
            const reminder = await prisma.reminder.delete({
                where: {
                    messageId: message.reference.messageId
                }
            });

            if (reminder) {
                await message.reply("Reminder cancelled.");
                await reminderReply.edit("Reminder cancelled.");
            } else {
                await message.reply("No reminder found to cancel.");
            }
        }
    },
} as Event