import { prisma } from "@/database";
import type { Event } from "@/events/Event";
import Logger from "@/logger";
import { env } from "bun";
import { Events, Role, Message, Client } from "discord.js";

interface ParseContext {
    message: Message;
    args: string[];
    client: Client;
    variables: Record<string, any>;
    followUps?: string[];
}


const logger = new Logger();

export default {
    event: Events.MessageCreate,
    async execute(client, message) {
        if (message.author.bot) return;
        if (!message.inGuild()) return;

        const guildSettings = await prisma.guildSettings.findUnique({
            where: {
                guildId: message.guildId,
            },
        });

        const prefix = guildSettings?.prefix || env.BOT_PREFIX || "!";

        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        let command = args.shift()?.toLowerCase();
        if (!command) return;

        // Check if the custom command exists for this guild
        const customCommand = await prisma.customCommand.findFirst({
            where: {
                guildId: message.guildId,
                name: command
            }
        });

        if (!customCommand) return;

        const response = customCommand.response;
        if (!response) return;

        const context: ParseContext = {
            message,
            args,
            client,
            variables: {},
        };

        const parsedResponse = await parseAdvancedResponse(response, context);

        if (parsedResponse) {
            logger.info(`Custom command triggered: ${command} - ${parsedResponse} - ${message.author.username} - ${message.author.id} - ${message.guildId} - ${message.channelId}`);
            logger.debug(`message content: ${message.content}, detected command: ${command}, prisma command: ${customCommand.name}`);
            await message.channel.send(parsedResponse);

            // Send follow-up messages if any
            if (context.followUps && context.followUps.length > 0) {
                for (const followUp of context.followUps) {
                    await message.channel.send(followUp);
                }
            }
        }
    },
} as Event;

async function parseAdvancedResponse(response: string, context: ParseContext): Promise<string | null> {
    let parsedResponse = response;

    // Basic replacements
    parsedResponse = parseBasicReplacements(parsedResponse, context);

    // Variable assignments and usages
    parsedResponse = await parseVariables(parsedResponse, context);

    // Advanced parsing
    parsedResponse = await parseConditionals(parsedResponse, context);
    parsedResponse = parseChoose(parsedResponse, context);

    // Permission checks
    const canExecute = await checkPermissions(parsedResponse, context);
    if (!canExecute) return null;

    // Remove permission check lines from the response
    parsedResponse = parsedResponse.replace(/^{(require|not):.*}$/gm, '').trim();

    // Parse arguments
    parsedResponse = parseArguments(parsedResponse, context);

    // Handle follow-up messages
    const followUps = extractFollowUps(parsedResponse, context);
    parsedResponse = removeFollowUps(parsedResponse);

    context.followUps = followUps;

    return parsedResponse;
}

async function parseVariables(response: string, context: ParseContext): Promise<string> {
    // Variable assignment
    const setRegex = /{set:(\w+)=(.*?)}/g;
    response = await replaceAsync(response, setRegex, async (match, varName, value) => {
        // Process value for possible nested placeholders
        value = await parseNestedPlaceholders(value, context);
        context.variables[varName] = value;
        return ''; // Remove the {set:...} from the response
    });

    // Variable usage
    const varRegex = /{var:(\w+)}/g;
    response = response.replace(varRegex, (_, varName) => {
        return context.variables[varName] || '';
    });

    return response;
}

async function parseNestedPlaceholders(value: string, context: ParseContext): Promise<string> {
    // Process basic replacements
    value = parseBasicReplacements(value, context);

    // Process arguments
    value = parseArguments(value, context);

    // Process random numbers
    value = value.replace(/{random:(\d+)-(\d+)}/g, (_, min, max) => {
        const num = Math.floor(Math.random() * (parseInt(max) - parseInt(min) + 1)) + parseInt(min);
        return num.toString();
    });

    return value;
}

function extractFollowUps(response: string, context: ParseContext): string[] {
    const followUps: string[] = [];
    const followUpRegex = /{followup:(.*?)}/g;
    let match;
    while ((match = followUpRegex.exec(response)) !== null) {
        let followUpContent = match[1];

        // Process the follow-up content for placeholders
        followUpContent = parseBasicReplacements(followUpContent, context);
        followUpContent = parseArguments(followUpContent, context);

        followUps.push(followUpContent);
    }
    return followUps;
}

function removeFollowUps(response: string): string {
    return response.replace(/{followup:.*?}/g, '').trim();
}


function parseBasicReplacements(response: string, context: ParseContext): string {
    const { message, client } = context;

    return response
        // User-related replacements
        .replace(/{user\.username}/g, message.author.username)
        .replace(/{user\.tag}/g, message.author.tag)
        .replace(/{user\.id}/g, message.author.id)
        .replace(/{user\.mention}/g, `<@${message.author.id}>`)
        .replace(/{user\.roles}/g, message.member?.roles.cache
            .filter(r => r.name !== '@everyone') // Exclude @everyone
            .map(r => r.name)
            .join(', ') || 'No Roles')

        // Server-related replacements
        .replace(/{server\.name}/g, message.guild?.name || '')
        .replace(/{server\.id}/g, message.guild?.id || '')
        .replace(/{server\.memberCount}/g, message.guild?.memberCount.toString() || '')
        .replace(/{server\.time}/g, new Date().toLocaleString())

        // Channel-related replacements
        .replace(/{channel\.name}/g, ('name' in message.channel && message.channel.name) || '')
        .replace(/{channel\.id}/g, message.channel.id)

        // Argument replacements
        .replace(/{args}/g, context.args.join(' '))
        .replace(/{args\[(\d+)\]}/g, (_, index) => context.args[parseInt(index)] || '')

        // Random number generation
        .replace(/{random:(\d+)-(\d+)}/g, (_, min, max) => {
            const num = Math.floor(Math.random() * (parseInt(max) - parseInt(min) + 1)) + parseInt(min);
            return num.toString();
        })

        // Additional custom replacements
        .replace(/{client\.uptime}/g, formatUptime(client.uptime || 0));
}


function formatUptime(uptime: number): string {
    const seconds = Math.floor((uptime / 1000) % 60);
    const minutes = Math.floor((uptime / (1000 * 60)) % 60);
    const hours = Math.floor((uptime / (1000 * 60 * 60)) % 24);
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24));

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}


async function parseConditionals(response: string, context: ParseContext): Promise<string> {
    const ifRegex = /{if:(.*?)}([\s\S]*?)(?:{else}([\s\S]*?))?{endif}/g;

    return await replaceAsync(response, ifRegex, async (match, condition, ifTrue, ifFalse = '') => {
        // No need to replace placeholders in the condition
        // since variables are accessed directly

        const result = await evaluateCondition(condition, context);
        return result ? ifTrue : ifFalse;
    });
}



function parseChoose(response: string, context: ParseContext): string {
    const chooseRegex = /{choose:(.*?)}/g;
    const choices: string[] = [];

    response = response.replace(chooseRegex, (_, options) => {
        const optionList = options.split(';');
        const choice = optionList[Math.floor(Math.random() * optionList.length)];
        choices.push(choice);
        return '{choice}';
    });

    return response.replace(/{choice}/g, () => choices.shift() || '');
}


async function checkPermissions(response: string, context: ParseContext): Promise<boolean> {
    const { message } = context;
    const requireRegex = /{require:(.*?)}/g;
    const notRegex = /{not:(.*?)}/g;

    const requirements = [...response.matchAll(requireRegex)].map(match => match[1]);
    const exclusions = [...response.matchAll(notRegex)].map(match => match[1]);

    for (const req of requirements) {
        if (req === 'serverMod') {
            if (!message.member?.permissions.has('ManageGuild')) return false;
        } else if (req.startsWith('#')) {
            if (!('name' in message.channel) || message.channel.name !== req.slice(1)) return false;
        } else {
            const role = message.guild?.roles.cache.find((r: Role) => r.name === req);
            if (!role || !message.member?.roles.cache.has(role.id)) return false;
        }
    }

    for (const excl of exclusions) {
        if (excl.startsWith('#')) {
            if ('name' in message.channel && message.channel.name === excl.slice(1)) return false;
        } else {
            const role = message.guild?.roles.cache.find((r: Role) => r.name === excl);
            if (role && message.member?.roles.cache.has(role.id)) return false;
        }
    }

    return true;
}

function parseArguments(response: string, context: ParseContext): string {
    const { args } = context;
    const argRegex = /\$(\d+)(\+?)/g;

    return response.replace(argRegex, (_, index, plus) => {
        const argIndex = parseInt(index) - 1;
        return plus ? args.slice(argIndex).join(' ') : args[argIndex] || '';
    });
}

async function evaluateCondition(condition: string, context: ParseContext): Promise<boolean> {
    const { message } = context;

    // Safe evaluation of the condition
    try {
        // Use a safe evaluation method
        const result = await safeEval(condition, context);
        return !!result;
    } catch (error) {
        console.error('Error evaluating condition:', error);
        return false;
    }
}

async function safeEval(condition: string, context: ParseContext): Promise<boolean> {
    const { message } = context;

    // Define allowed variables and functions
    const variables = {
        args: context.args,
        user: {
            id: message.author.id,
            username: message.author.username,
            tag: message.author.tag,
            roles: message.member?.roles.cache.map(role => role.name),
            hasRole: (roleName: string) => {
                return message.member?.roles.cache.some(role => role.name === roleName);
            },
        },
        server: {
            id: message.guild?.id,
            name: message.guild?.name,
            memberCount: message.guild?.memberCount,
            createdAt: message.guild?.createdAt,
            ownerId: message.guild?.ownerId,
            description: message.guild?.description,
            icon: message.guild?.icon,
            banner: message.guild?.banner,
            verificationLevel: message.guild?.verificationLevel,
            roles: message.guild?.roles.cache.map(role => ({
                id: role.id,
                name: role.name,
                color: role.color,
                permissions: role.permissions,
                position: role.position,
                hoist: role.hoist,
                managed: role.managed,
                mentionable: role.mentionable,
            })),
            channels: message.guild?.channels.cache.map(channel => ({
                id: channel.id,
                name: channel.name,
                type: channel.type,
                parentId: channel.parentId,
            })),
            x: message.guild?.scheduledEvents.cache.map(event => ({
                id: event.id,
                name: event.name,
                description: event.description,
                scheduledStart: event.scheduledStartAt,
                scheduledEnd: event.scheduledEndAt,
                status: event.status,
                entityType: event.entityType,
                creator: event.creator,
                channel: event.channel,
                entityMetadata: event.entityMetadata,
                creatorId: event.creatorId,
            })),
            stickers: message.guild?.stickers.cache.map(sticker => ({
                id: sticker.id,
                name: sticker.name,
                description: sticker.description,
                formatType: sticker.format,
                packId: sticker.packId,
            })),
        },
        channel: {
            id: message.channel.id,
            name: ('name' in message.channel && message.channel.name) || '',
        },
    };

    // Create a new function with the condition
    const func = new Function(...Object.keys(variables), `return (${condition});`);

    // Call the function with the variables
    return func(...Object.values(variables));
}



async function replaceAsync(str: string, regex: RegExp, asyncFn: (...args: string[]) => Promise<string>): Promise<string> {
    const promises: Promise<string>[] = [];
    str.replace(regex, (match, ...args) => {
        const promise = asyncFn(match, ...args);
        promises.push(promise);
        return match;
    });
    const data = await Promise.all(promises);
    return str.replace(regex, () => data.shift() || '');
}