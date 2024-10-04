import { env } from "bun";
import { Client, Collection, IntentsBitField } from "discord.js";
import { isCommand, type Command } from "@commands/Command";
import { readdirSync } from "fs";
import { validateEnvVariables } from "@/env-variables";
import { prisma } from "@db";
import { isEvent, type Event } from "@events/Event";
import { isInterval, type Interval } from "@/intervals/Interval";
import { Logger } from './logger';
import chalk from "chalk";

// Constants and Configurations
validateEnvVariables();

const logger = new Logger('main');

// Create sub loggers
const commandLogger = logger.subLogger('commands');
const eventLogger = logger.subLogger('events');
const intervalLogger = logger.subLogger('intervals');

// Make sure the database is connected
prisma.$connect().then(() => {
  logger.info('Connected to the database.');
});

let client: Client;

function createClient() {
  client = new Client({
    intents: [
      IntentsBitField.Flags.GuildEmojisAndStickers,
      IntentsBitField.Flags.GuildMessages,
      IntentsBitField.Flags.Guilds,
      IntentsBitField.Flags.MessageContent,
    ],
  });
  client.commands = new Collection();
  client.events = new Collection();
  client.intervals = new Collection();
  client.config = {
    prefix: env.BOT_PREFIX || "!"
  }

  return client;
}

// Loading Functions
async function loadCommands() {
  commandLogger.debug('Searching for command files...');
  const commandFiles = readdirSync("./src/commands", {
    recursive: true,
  }).filter(
    (file) =>
      ((file as string).endsWith(".ts") || (file as string).endsWith(".js")) &&
      file !== "Command.ts"
  );

  commandLogger.debug(`Found ${chalk.bold.green(commandFiles.length)} viable command files.`);

  client.commands.clear();
  for (const file of commandFiles) {
    const command: Command | any = require(`./commands/${file}`).default;

    if (!isCommand(command)) {
      commandLogger.warn(`The file '${chalk.italic.cyan(file)}' in the '${chalk.italic.cyan('commands')} directory is not a valid command.`);
      continue;
    } else {
      client.commands.set(command.name, command);
      commandLogger.debug(`Command '${chalk.italic.cyan(command.name)}' loaded successfully.`);
    }
  }

  const invalidCommandFiles = commandFiles.length - client.commands.size;
  commandLogger.info(`Successfully loaded ${chalk.bold.green(client.commands.size)} commands. ${invalidCommandFiles > 0 ? chalk.yellow(`(${invalidCommandFiles} file${invalidCommandFiles !== 1 ? 's' : ''} skipped)`) : ''}`);
}

async function loadEvents() {
  eventLogger.debug('Searching for event files...');
  const eventFiles = readdirSync("./src/events", {
    recursive: true,
  }).filter(
    (file) =>
      ((file as string).endsWith(".ts") || (file as string).endsWith(".js")) &&
      file !== "Event.ts"
  );

  eventLogger.debug(`Found ${chalk.bold.green(eventFiles.length)} viable event files.`);
  let skippedFiles = 0;

  client.events.forEach((events: Event[], eventName: string) => {
    events.forEach(event => client.removeListener(eventName, event.execute));
  });
  client.events.clear();

  for (const file of eventFiles) {
    const event: Event | any = require(`./events/${file}`).default;

    if (!isEvent(event)) {
      eventLogger.warn(`The file '${chalk.italic.cyan(file)}' in the '${chalk.italic.cyan('events')} directory is not a valid event.`);
      skippedFiles++;
      continue;
    } else {
      if (event.once) {
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
      eventLogger.debug(`Successfully bound file '${chalk.italic.cyan(file)}' to event '${chalk.italic.cyan(event.event)}'`);
    }
  }

  eventLogger.info(`Successfully loaded ${chalk.bold.green(client.events.size)} events. ${skippedFiles > 0 ? chalk.yellow(`(${skippedFiles} file${skippedFiles !== 1 ? 's' : ''} skipped)`) : ''}`);
}

async function loadIntervals() {
  intervalLogger.debug('Searching for interval files...');
  const intervalFiles = readdirSync("./src/intervals", {
    recursive: true,
  }).filter(
    (file) =>
      ((file as string).endsWith(".ts") || (file as string).endsWith(".js")) &&
      file !== "Interval.ts"
  );

  intervalLogger.debug(`Found ${chalk.bold.green(intervalFiles.length)} viable interval files.`);

  client.intervals.clear();
  for (const file of intervalFiles) {
    const interval: Interval | any = require(`./intervals/${file}`).default;

    if (!isInterval(interval)) {
      intervalLogger.warn(`The file '${chalk.italic.cyan(file)}' in the '${chalk.italic.cyan('intervals')} directory is not a valid interval.`);
      continue;
    } else {
      setInterval(() => interval.execute(client), interval.interval);
      client.intervals.set(file.toString().split('.')[0], interval);
      intervalLogger.debug(`Interval '${chalk.italic.cyan(file)}' loaded successfully.`);
    }
  }

  const skippedIntervals = intervalFiles.length - client.intervals.size;
  intervalLogger.info(`Successfully loaded ${chalk.bold.green(client.intervals.size)} intervals. ${skippedIntervals > 0 ? chalk.yellow(`(${skippedIntervals} file${skippedIntervals !== 1 ? 's' : ''} skipped)`) : ''}`);

  // Execute intervals that should execute on init
  intervalLogger.debug('Executing intervals that should execute on init...');
  for (const [_name, interval] of client.intervals) {
    if (interval.executeOnInit) {
      interval.execute(client);
    }
  }
  intervalLogger.debug('Successfully executed intervals that should execute on init.');
}

// Reload Function
async function reloadBot() {
  try {
    // Destroy the existing client
    await client.destroy();

    // Create a new client

    // Reload commands
    await loadCommands();

    // Reload events
    await loadEvents();

    // Reload intervals
    await loadIntervals();
  } catch (error) {
    logger.error(`Error reloading the bot: ${error}`);
  }
}

// Shutdown Function
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${chalk.bold.red(signal)}. Logging out and shutting down...`);

  // Remove the input listener
  if (process.stdin.isTTY) {
    process.stdin.removeAllListeners('data');
    process.stdin.setRawMode(false);
    process.stdin.pause();
  }

  let error = false;

  try {
    await client.destroy();
    logger.info('Successfully logged out and destroyed the client.');
  } catch (err) {
    error = true;
    logger.error(`Error during logout: ${err}`);
  }

  try {
    await prisma.$disconnect();
    logger.info('Successfully disconnected from the database.');
  } catch (err) {
    error = true;
    logger.error(`Error during database disconnection: ${err}`);
  }

  logger.info('Goodbye! 👋');

  process.exit(error ? 1 : 0);
}

// Main Execution
async function main() {
  // Create the client
  client = createClient();

  // Load commands, events, and intervals
  await loadCommands();
  await loadEvents();
  await loadIntervals();

  // Login to the bot
  client.login(env.BOT_TOKEN);

  // Set up input listeners
  setupInputListeners();
}

// Input Listener Setup
function setupInputListeners() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', handleKeyPress);
  }
}

function handleKeyPress(key: Buffer) {
  const keyString = key.toString().toLowerCase();
  if (keyString === 'q') {
    gracefulShutdown(chalk.underline('Q') + 'uit');
  } else if (keyString === "r") {
    reloadBot();
  }
}

// Shutdown Hooks
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Start the application
main().catch(error => {
  console.error("Error starting the application:", error);
  process.exit(1);
});