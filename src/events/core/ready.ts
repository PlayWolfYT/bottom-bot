import { Client } from "discord.js";
import type { Event } from "@events/Event";

const readyEvent: Event<"ready"> = {
  name: "ready",
  once: true,
  execute(client: Client) {
    console.log(`Logged in as ${client.user?.tag}`);
  },
};

export default readyEvent;
