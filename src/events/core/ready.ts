import { Client } from "discord.js";
import type { Event } from "@events/Event";

const readyEvent: Event = {
  event: "ready",
  once: true,
  execute(client: Client) {
    console.log(`Logged in as ${client.user?.tag}`);
  },
};

export default readyEvent;
