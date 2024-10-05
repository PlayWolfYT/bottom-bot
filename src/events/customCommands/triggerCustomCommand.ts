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

        logger.debug(`Custom command ${command} triggered by ${message.author.username}`);

        const parsedResponse = await parseAdvancedResponse(response, context);

        if (parsedResponse !== null) {
            await message.channel.send(parsedResponse);

            // Send follow-up messages if any
            if (context.followUps && context.followUps.length > 0) {
                for (const followUp of context.followUps) {
                    await message.channel.send(followUp);
                }
            }
        } else {
            logger.warn(`Custom command ${command} triggered by ${message.author.username} returned an empty response`);
            await message.channel.send(`(Empty response)`);
        }
    },
} as Event;


async function parseAdvancedResponse(response: string, context: ParseContext): Promise<string | null> {
    let parsedResponse = parseBasicReplacements(response, context);

    // Now process instructions step by step
    let loopCount = 0; // To prevent infinite loops
    const maxLoops = 1000;
    const instructionRegex = /{(set|webrequest|eval|if|choose|random|followup|require|not);(.*?)}|{if;.*?}[\s\S]*?{endif}/;
    let instruction = '';
    while (loopCount < maxLoops) {
        loopCount++;
        const match = parsedResponse.match(instructionRegex);
        if (!match) {
            break;
        }

        instruction = match[0];
        const startIndex = match.index || 0;
        const endIndex = startIndex + instruction.length;

        let replacement = '';

        if (instruction.startsWith('{set;')) {
            // Variable assignment
            replacement = await processVariableAssignment(instruction, context);
        } else if (instruction.startsWith('{webrequest;')) {
            // Web request
            replacement = await processWebRequestInstruction(instruction, context);
        } else if (instruction.startsWith('{eval;')) {
            // Eval
            replacement = await processEvalInstruction(instruction, context);
        } else if (instruction.startsWith('{if;')) {
            // Conditional
            replacement = await processConditionalInstruction(instruction, context);
        } else if (instruction.startsWith('{choose;')) {
            // Choose
            replacement = processChooseInstruction(instruction, context);
        } else if (instruction.startsWith('{random;')) {
            // Random
            replacement = processRandomInstruction(instruction, context);
        } else if (instruction.startsWith('{followup;')) {
            // Follow-up
            replacement = processFollowUpInstruction(instruction, context);
        } else if (instruction.startsWith('{require;') || instruction.startsWith('{not;')) {
            // Permission checks
            const canExecute = await checkPermissions(parsedResponse, context);
            if (!canExecute) return null;

            // Remove permission check lines from the response
            replacement = '';
        } else {
            // Unknown instruction, skip
            replacement = instruction;
        }

        // Replace the instruction in parsedResponse
        parsedResponse = parsedResponse.slice(0, startIndex) + replacement + parsedResponse.slice(endIndex);

        // Process any variable usages in the replacement
        parsedResponse = parseVariableUsages(parsedResponse, context);
    }

    if (loopCount >= maxLoops) {
        logger.error('Maximum loop count exceeded in parseAdvancedResponse');
        logger.error(`Response: ${response}`);
        logger.error(`Parsed response: ${parsedResponse}`);
        logger.error(`Followup: ${context.followUps}`);
        logger.error(`Variables: ${JSON.stringify(context.variables, null, 2)}`);
        logger.error(`Was stuck on ${instruction}`);
        throw new Error('Maximum loop count exceeded in parseAdvancedResponse');
    }

    // After processing all instructions, process any remaining variable usages
    parsedResponse = parseVariableUsages(parsedResponse, context);

    // Process arguments
    parsedResponse = parseArguments(parsedResponse, context);

    return parsedResponse;
}


async function processVariableAssignment(instruction: string, context: ParseContext): Promise<string> {
    // Instruction format: {set;varName=value}
    const setRegex = /{set;(\w+)=(.*?)}/;
    const match = instruction.match(setRegex);
    if (!match) return instruction; // Shouldn't happen

    const varName = match[1];
    let value = match[2];

    // Process value for possible nested placeholders
    value = await parseNestedPlaceholders(value, context);
    context.variables[varName] = value;
    return ''; // Remove the {set;...} from the response
}

function parseVariableUsages(response: string, context: ParseContext): string {
    // Variable usage with support for nested properties
    const varRegex = /{var;([\w.]+)}/g;
    response = response.replace(varRegex, (_, varPath) => {
        const parts = varPath.split('.');
        let value = context.variables;
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                value = {};
                break;
            }
        }
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value, null, 2);
        }
        return (value as any)?.toString() || '';
    });

    return response;
}

async function parseNestedPlaceholders(value: string, context: ParseContext): Promise<string> {
    // Process basic replacements
    value = parseBasicReplacements(value, context);

    // Process variable usages
    value = parseVariableUsages(value, context);

    // Process arguments
    value = parseArguments(value, context);

    // Process random numbers
    value = value.replace(/{random;(\d+)-(\d+)}/g, (_, min, max) => {
        const num = Math.floor(Math.random() * (parseInt(max) - parseInt(min) + 1)) + parseInt(min);
        return num.toString();
    });

    return value;
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
        .replace(/{random;(\d+)-(\d+)}/g, (_, min, max) => {
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

function processRandomInstruction(instruction: string, context: ParseContext): string {
    // Instruction format: {random;min-max}
    const randomRegex = /{random;(\d+)-(\d+)}/;
    const match = instruction.match(randomRegex);
    if (!match) return instruction;

    const min = parseInt(match[1], 10);
    const max = parseInt(match[2], 10);
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    return num.toString();
}

async function processConditionalInstruction(instruction: string, context: ParseContext): Promise<string> {
    // Instruction format: {if;condition}...{else}...{endif}
    const ifRegex = /{if;(.*?)}([\s\S]*?)(?:{else}([\s\S]*?))?{endif}/;
    const match = instruction.match(ifRegex);
    if (!match) return instruction;

    const condition = match[1];
    const ifTrue = match[2];
    const ifFalse = match[3] || '';

    const result = await evaluateCondition(condition, context);
    return result ? ifTrue : ifFalse;
}

function processChooseInstruction(instruction: string, context: ParseContext): string {
    // Instruction format: {choose;option1;option2;...}
    const chooseRegex = /{choose;(.*?)}/;
    const match = instruction.match(chooseRegex);
    if (!match) return instruction;

    const options = match[1].split(';');
    const choice = options[Math.floor(Math.random() * options.length)];
    return choice;
}

async function checkPermissions(response: string, context: ParseContext): Promise<boolean> {
    const { message } = context;
    const requireRegex = /{require;(.*?)}/g;
    const notRegex = /{not;(.*?)}/g;

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

async function safeEval(condition: string, context: ParseContext): Promise<boolean | any> {
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
        // Add access to custom variables
        var: context.variables,
        // Add JSON parsing function
        parseJSON: (key: string) => {
            try {
                return JSON.parse(context.variables[key]);
            } catch (error) {
                console.error(`Error parsing JSON for key ${key}: ${error}`);
                return null;
            }
        },
        // Add JSON methods
        JSON: {
            stringify: JSON.stringify,
            parse: JSON.parse
        },
        // Add a safe eval function for specific operations
        safeEval: (code: string) => {
            // List of allowed functions
            const allowedFunctions = ['JSON.stringify', 'JSON.parse'];

            // Check if the code starts with an allowed function
            if (allowedFunctions.some(func => code.trim().startsWith(func))) {
                return eval(code);
            } else {
                throw new Error('Unauthorized eval operation');
            }
        }
    };

    // Create a new function with the condition
    const func = new Function(...Object.keys(variables), `return (${condition});`);

    // Call the function with the variables
    return func(...Object.values(variables));
}

function processFollowUpInstruction(instruction: string, context: ParseContext): string {
    // Instruction format: {followup;message}
    const followUpRegex = /{followup;(.*?)}/;
    const match = instruction.match(followUpRegex);
    if (!match) return instruction;

    let followUpContent = match[1];

    // Process the follow-up content for placeholders
    followUpContent = parseBasicReplacements(followUpContent, context);
    followUpContent = parseArguments(followUpContent, context);

    context.followUps = context.followUps || [];
    context.followUps.push(followUpContent);

    return ''; // Remove the {followup;...} from the response
}

async function processWebRequestInstruction(instruction: string, context: ParseContext): Promise<string> {
    // Instruction format: {webrequest;varName;url}
    const webRequestRegex = /{webrequest;(\w+);([^}]+)}/;
    const match = instruction.match(webRequestRegex);
    if (!match) return instruction;

    const variableName = match[1];
    let url = match[2];

    // Process the URL for placeholders
    url = await parseNestedPlaceholders(url, context);

    try {
        const options: RequestInit = {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        };

        logger.debug(`Making web request: ${url}`);
        const result = await fetch(url, options);
        if (!result.ok) {
            throw new Error(`HTTP error! status: ${result.status}`);
        }

        const data = await result.json();
        context.variables[variableName] = data;
        return ''; // Remove the {webrequest;...} from the response
    } catch (error: any) {
        console.error(`Error making web request: ${error}`);
        return `Error: ${error.message ?? error.toString()}`;
    }
}

async function processEvalInstruction(instruction: string, context: ParseContext): Promise<string> {
    // Instruction format: {eval;code}
    const evalRegex = /{eval;(.*?)}/;
    const match = instruction.match(evalRegex);
    if (!match) return instruction;

    const code = match[1];

    try {
        const result = await safeEval(code, context);
        return result.toString();
    } catch (error) {
        console.error(`Error in eval: ${error}`);
        return `Error: ${error}`;
    }
}
