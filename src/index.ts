import { env } from "bun";
import { Client, Collection, IntentsBitField } from "discord.js";
import { isCommand, type Command } from "@commands/Command";
import { readdirSync } from "fs";
import { validateEnvVariables } from "@/env-variables";
import { prisma } from "@db";
import { isEvent, type Event } from "@events/Event";
import { isInterval, type Interval } from "@/intervals/Interval";

validateEnvVariables();

const client = new Client({
  intents: [
    IntentsBitField.Flags.GuildEmojisAndStickers,
    //IntentsBitField.Flags.GuildMembers,
    //IntentsBitField.Flags.GuildMessagePolls,
    //IntentsBitField.Flags.GuildMessageReactions,
    //IntentsBitField.Flags.GuildMessageTyping,
    IntentsBitField.Flags.GuildMessages,
    //IntentsBitField.Flags.GuildModeration,
    //IntentsBitField.Flags.GuildPresences,
    //IntentsBitField.Flags.GuildScheduledEvents,
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.MessageContent,
  ],
});

client.commands = new Collection();
client.events = new Collection();

// Load command files
const commandFiles = readdirSync("./src/commands", {
  recursive: true,
}).filter(
  (file) =>
    ((file as string).endsWith(".ts") || (file as string).endsWith(".js")) &&
    file !== "Command.ts"
);

for (const file of commandFiles) {
  const command: Command | any = require(`./commands/${file}`).default;

  if (!isCommand(command)) {
    console.error(`Command ${file} is not a valid command.`);
    continue;
  } else {
    client.commands.set(command.name, command);
    console.log(`Command '${command.name}' loaded successfully.`);
  }
}

// Load event files
const eventFiles = readdirSync("./src/events", {
  recursive: true,
}).filter(
  (file) =>
    ((file as string).endsWith(".ts") || (file as string).endsWith(".js")) &&
    file !== "Event.ts"
);

for (const file of eventFiles) {
  const event: Event | any = require(`./events/${file}`).default;

  if (!isEvent(event)) {
    console.error(`Event ${file} is not a valid event.`);
    continue;
  } else {
    if (event.once) {
      // Typescript behaves horribly with the dynamic event, so we just cast it to any
      (client as any).once(event.event, (...args: any[]) =>
        (event as any).execute(client, ...args)
      );
    } else {
      (client as any).on(event.event, (...args: any[]) =>
        (event as any).execute(client, ...args)
      );
    }

    if (!client.events.has(event.event)) {
      client.events.set(event.event, []);
    }
    client.events.get(event.event)!.push(event);
    console.debug(
      `Successfully bound file '${file}' to event '${event.event}'`
    );
  }
}

// Load interval files
const intervalFiles = readdirSync("./src/intervals", {
  recursive: true,
}).filter(
  (file) =>
    ((file as string).endsWith(".ts") || (file as string).endsWith(".js")) &&
    file !== "Interval.ts"
);

for (const file of intervalFiles) {
  const interval: Interval | any = require(`./intervals/${file}`).default;

  if (!isInterval(interval)) {
    console.error(`Interval ${file} is not a valid interval.`);
    continue;
  } else {
    setInterval(() => interval.execute(client), interval.interval);
    console.log(`Interval '${file}' loaded successfully.`);
  }
}

// Add shutdown hook
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}. Logging out and shutting down...`);

  let error = false;

  try {
    await client.destroy();
    console.log("Successfully logged out and destroyed the client.");
  } catch (err) {
    error = true;
    console.error("Error during logout:", err);
  }

  try {
    await prisma.$disconnect();
    console.log("Successfully disconnected from the database.");
  } catch (err) {
    error = true;
    console.error("Error during database disconnection:", err);
  }

  process.exit(error ? 1 : 0);
}

client.login(env.BOT_TOKEN);
