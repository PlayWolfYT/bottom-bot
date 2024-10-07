import { env } from "bun";
import { ActivityType, Client, Collection, IntentsBitField } from "discord.js";
import { isCommand, type Command } from "@/bot/commands/Command";
import { readdirSync } from "fs";
import { validateEnvVariables } from "@/utils/env-variables";
import { prisma } from "@db";
import { isEvent, type Event } from "@events/Event";
import { isInterval, type Interval } from "@/bot/intervals/Interval";
import { Logger } from '@/utils/logger';
import chalk from "chalk";
import path from "path";

const logger = new Logger();

// Create sub loggers
const commandLogger = logger.subLogger('commands');
const eventLogger = logger.subLogger('events');
const intervalLogger = logger.subLogger('intervals');

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

    return client;
}

// Loading Functions
async function loadCommands() {
    commandLogger.debug('Searching for command files...');
    const commandFiles = readdirSync(path.join(__dirname, "./commands"), {
        recursive: true,
    }).filter(
        (file) =>
            ((file as string).endsWith(".ts") || (file as string).endsWith(".js")) &&
            file !== "Command.ts"
    );

    commandLogger.debug(`Found ${chalk.bold.green(commandFiles.length)} viable command files.`);

    client.commands.clear();
    for (const file of commandFiles) {
        const command: Command | any = require(path.join(__dirname, `./commands/${file}`)).default;

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
    const eventFiles = readdirSync(path.join(__dirname, "./events"), {
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
        const event: Event | any = require(path.join(__dirname, `./events/${file}`)).default;

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
    const intervalFiles = readdirSync(path.join(__dirname, "./intervals"), {
        recursive: true,
    }).filter(
        (file) =>
            ((file as string).endsWith(".ts") || (file as string).endsWith(".js")) &&
            file !== "Interval.ts"
    );

    intervalLogger.debug(`Found ${chalk.bold.green(intervalFiles.length)} viable interval files.`);

    client.intervals.clear();
    for (const file of intervalFiles) {
        const interval: Interval | any = require(path.join(__dirname, `./intervals/${file}`)).default;

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

// Shutdown Function
async function gracefulShutdown(signal: string) {
    logger.info(`Received ${chalk.bold.red(signal)}. Logging out and shutting down...`);
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
export async function startBot() {
    // Constants and Configurations
    validateEnvVariables();

    // Make sure the database connection is established
    prisma.$connect().then(() => {
        logger.info('Connected to the database.');
    });

    // Create the client
    client = createClient();

    // Load commands, events, and intervals
    await loadCommands();
    await loadEvents();
    await loadIntervals();

    // Login to the bot
    await client.login(env.BOT_TOKEN);

    // Set the bot's presence
    client.user?.setPresence({
        status: "online",
        activities: [
            {
                name: "being a good bottom!",
                type: ActivityType.Competing,
                url: "https://bottombot.playwolf.net/"
            }
        ]
    });


    // Shutdown Hooks
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

    // Handle Ctrl+C on Windows
    if (process.platform === "win32") {
        var rl = require("readline").createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.on("SIGINT", function () {
            process.emit("SIGINT");
        });
    }

    return true;
}