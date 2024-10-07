import { prisma } from "@db";
import type { Event } from "@events/Event";
import * as chrono from "chrono-node";
import { Events } from "discord.js";
import Logger from "@utils/logger";
const logger = new Logger();

export default {
  event: Events.MessageCreate,
  async execute(_client, message) {
    if (message.author.bot) return;

    if (message.content.toLowerCase().includes("remind me")) {
      // Extract the content after "remind me"
      const reminderRequest = message.content
        .substring(
          message.content.toLowerCase().indexOf("remind me") + "remind me".length
        )
        .trim();

      // Get timezone from user settings
      let timezone = "UTC";
      const userSettings = await prisma.userSettings.findUnique({
        where: {
          userId: message.author.id,
        },
      });

      if (!userSettings) {
        // Get timezone from guild settings
        const guildSettings = await prisma.guildSettings.findUnique({
          where: {
            guildId: message.guildId!,
          },
        });
        if (guildSettings?.timezone) timezone = guildSettings.timezone;
      } else {
        if (userSettings.timezone) timezone = userSettings.timezone;
      }

      // Parse the date from the content
      const parsedResults = chrono.parse(reminderRequest, { instant: new Date(message.createdTimestamp), timezone }, { forwardDate: true });

      if (parsedResults.length === 0) {
        message.reply(
          "Sorry, I couldn't understand the time you specified. Please try again with a clearer time format."
        );
        return;
      }

      const parsedResult = parsedResults[0];
      const reminderTime = parsedResult.start.date();

      // Remove the time expressions from the content to get the reminder text
      let reminderText = reminderRequest;
      parsedResults.forEach((result) => {
        reminderText = reminderText.replace(result.text, "");
      });

      // Clean up the reminder text
      reminderText = reminderText.trim();

      // Detect and store the prefix ("to" or "that") if present
      let prefixMatch = reminderText.match(/^(to|that)\s+/i);
      let prefix = "to"; // Default prefix

      if (prefixMatch) {
        prefix = prefixMatch[1].toLowerCase();
        // Remove the prefix from the reminder text
        reminderText = reminderText.replace(/^(to|that)\s+/i, "").trim();
      }

      if (!reminderText) {
        message.reply(
          "Sorry, I couldn't find what you want to be reminded about. Please specify the reminder text."
        );
        return;
      }

      // Determine if the time expression is relative
      const timeExpressionText = parsedResult.text.toLowerCase();
      const relativeKeywords = ['in ', 'after ', 'later', 'from now'];
      let isRelative = relativeKeywords.some((keyword) => timeExpressionText.includes(keyword));

      // Determine the time format and word
      const timeUnix = Math.floor(reminderTime.getTime() / 1000);
      const timeFormat = isRelative ? `<t:${timeUnix}:R>` : `<t:${timeUnix}:f>`;
      const timeWord = isRelative ? "in" : "on";

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
          `Okay, I'll remind you ${prefix} "${reminderText}" ${timeWord} ${timeFormat}`
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
