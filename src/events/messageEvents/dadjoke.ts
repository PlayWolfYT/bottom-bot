import type { Event } from "@/events/Event";

export default {
  event: "messageCreate",
  execute(client, message) {
    if (message.author.bot) return;

    // Get everything after "I'm", "I am", or "Im" and before the first comma or space
    let name =
      message.content
        // Remove all markdown characters
        .replace(/[*_~`|#]/g, "")
        .match(/(?:i'?m|i am)\s+(.*)/i)?.[1]
        ?.split(",")[0]
        ?.trim() || "";

    if (name.length === 0) {
      return;
    }

    // Calculate a 7% chance, if we don't hit it, we return
    const roll = Math.random();
    if (roll > 0.07) {
      console.debug(
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
