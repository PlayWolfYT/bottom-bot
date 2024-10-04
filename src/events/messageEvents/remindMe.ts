import { prisma } from "@/database";
import type { Event } from "@/events/Event";
import * as chrono from "chrono-node";
import { Events } from "discord.js";
import Logger from "@/logger";
const logger = new Logger();

export default {
  event: Events.MessageCreate,
  async execute(_client, message) {
    if (message.author.bot) return;

    if (message.content.toLowerCase().includes("remind me")) {
      const timeMatch = message.content.match(
        /remind\s?me (.+?) (to|that) (.+)/i
      );
      if (!timeMatch) {
        message.reply(
          "Sorry, I couldn't understand when you want to be reminded. Please use the format: 'Remind me [time] to [message]'"
        );
        return;
      }

      const [, timeString, , reminderText] = timeMatch;
      const reminderTime = chrono.parseDate(
        timeString,
        {
          instant: new Date(message.createdTimestamp),
          timezone: "UTC",
        },
        {
          forwardDate: true,
        }
      );

      if (!reminderTime) {
        message.reply(
          "Sorry, I couldn't understand the time you specified. Please try again with a clearer time format."
        );
        return;
      }

      try {
        await prisma.reminder.create({
          data: {
            guildId: message.guildId!,
            userId: message.author.id,
            messageId: message.id,
            channelId: message.channelId,
            time: reminderTime,
            reminderText,
          },
        });

        message.reply(
          `Okay, I'll remind you "${reminderText}" <t:${Math.floor(
            reminderTime.getTime() / 1000
          )}:R>`
        );
      } catch (error) {
        logger.error(`Error creating reminder: ${error}`);
        message.reply(
          "Sorry, there was an error setting your reminder. Please try again later."
        );
      }
    }
  },
} as Event;
