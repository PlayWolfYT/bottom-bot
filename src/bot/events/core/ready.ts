import { Client, Events } from "discord.js";
import type { Event } from "@events/Event";
import Logger from "@utils/logger";

const logger = new Logger();

export default {
  event: Events.ClientReady,
  once: true,
  execute(client: Client) {
    logger.info(`Logged in as ${client.user?.tag}`);
  },
} as Event;
