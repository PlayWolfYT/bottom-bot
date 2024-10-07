import { prisma } from "@db";
import type { Interval } from "@intervals/Interval";
import Logger from "@utils/logger";
import type { Client } from "discord.js";

const logger = new Logger();

const REMINDER_CHECK_INTERVAL = 1000 * 60 * 60; // 1 hour

export default {
  interval: REMINDER_CHECK_INTERVAL,
  executeOnInit: true,
  execute: async (client: Client) => {
    logger.debug("Checking for reminders...");
    const now = new Date();
    const nextCycle = new Date(now.getTime() + REMINDER_CHECK_INTERVAL); // 1 hour from now

    const reminders = await prisma.reminder.findMany({
      where: {
        time: {
          gte: now,
          lt: nextCycle,
        },
      },
    });

    for (const reminder of reminders) {
      const timeUntilReminder = reminder.time.getTime() - now.getTime();

      setTimeout(async () => {
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
            logger.error(`Failed to send reminder ${reminder.id}: ${error}`);
          }
        }

        // Remove executed reminder
        await prisma.reminder.delete({
          where: {
            id: reminder.id,
          },
        });
      }, timeUntilReminder);
    }
  },
} as Interval;
