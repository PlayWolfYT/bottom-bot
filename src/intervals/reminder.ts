import { prisma } from "@/database";
import type { Interval } from "@/intervals/Interval";

export default {
  interval: 1000 * 10,
  execute: async (client) => {
    // Fetch reminders from database
    // Check if any reminders are due
    // Execute reminder
    // Remove past reminders
    console.log("Checking for reminders...");
    const now = new Date();
    const reminders = await prisma.reminder.findMany({
      where: {
        time: {
          lte: now,
        },
      },
    });

    for (const reminder of reminders) {
      const guild = await client.guilds.fetch(reminder.guildId);
      const channel = await guild.channels.fetch(reminder.channelId);

      if (channel && channel.isTextBased()) {
        try {
          try {
            const message = await channel.messages.fetch(reminder.messageId);
            await message.reply(
              `<@${reminder.userId}>, here's your reminder: ${reminder.reminderText}`
            );
          } catch (error) {
            await channel.send(
              `<@${reminder.userId}>, here's your reminder: ${reminder.reminderText} (Failed to reply to original message)`
            );
          }
        } catch (error) {
          console.error(`Failed to send reminder ${reminder.id}:`, error);
        }
      }
    }

    // Remove executed reminders
    await prisma.reminder.deleteMany({
      where: {
        time: {
          lte: now,
        },
      },
    });
  },
} as Interval;
