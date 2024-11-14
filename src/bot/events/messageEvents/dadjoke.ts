import type { Event } from "@events/Event";
import Logger from "@utils/logger";
import { Events } from "discord.js";

const logger = new Logger();

export default {
  event: Events.MessageCreate,
  execute(client, message) {
    if (message.author.bot) return;

    let matches = message.content
      // Remove all markdown characters
      .replace(/[*_~`|#]/g, "")
      .match(/(?:\s|^)i'?m(?:\s(.*))|(?:\s|^)i am\s+(.*)/i);

    // Get everything after "I'm", "I am", or "Im" and before the first comma or space
    let name =
      (matches?.[2] === undefined ? matches?.[1] : matches?.[3])
        ?.split(",")[0]
        ?.trim() || "";

    if (name.length === 0) {
      return;
    }

    // Calculate a 7% chance, if we don't hit it, we return
    const roll = Math.random();
    if (roll > 0.07) {
      logger.debug(
        `Dadjoke event missed for ${message.author.displayName} (rolled ${roll})`
      );
      return;
    }

    // We check if the content after (the name) is just a couple words, or if it's a full sentence.
    // If it is more than 5 words, we simply take the first 5 words as the name.
    if (name.split(" ").length > 5) {
      name = name.split(" ").slice(0, 5).join(" ");
    }

    message.reply(`Hi ${name}, I'm ${client.user?.displayName}!`);
  },
} as Event;
