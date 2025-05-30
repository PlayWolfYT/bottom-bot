import { prisma } from "@db";
import type { Event } from "@events/Event";
import Sandbox from "@nyariv/sandboxjs";
import Logger from "@utils/logger";
import { env } from "bun";
import { ChannelType, EmbedBuilder, Events, Message, PermissionsBitField, Sticker, TextChannel, type MessageCreateOptions } from "discord.js";

interface ParseContext {
    message: Message & { channel: TextChannel };
    client: {
        uptime: number | null;
    };
    variables: Record<string, any>;
    followUps: string[];
}

type InstructionArray = ({ start: number; end: number } | undefined)[]


const logger = new Logger();

export default {
    event: Events.MessageCreate,
    async execute(client, message) {
        if (message.author.bot) return;
        if (!message.inGuild()) return;
        if (!message.channel.isTextBased()) return;

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
            message: message as Message & { channel: TextChannel },
            client: {
                uptime: client.uptime,
            },
            variables: {
                args,
                user: {
                    id: message.author.id,
                    username: message.author.username,
                    tag: message.author.tag,
                    mention: `<@${message.author.id}>`,
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
                    events: message.guild?.scheduledEvents.cache.map(event => ({
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
            },
            followUps: [],
        };

        logger.debug(`Custom command ${command} triggered by ${message.author.username}`);

        try {
            const parsedResponse = await parseResponse(response, context);

            if (parsedResponse !== null && parsedResponse.content && parsedResponse.content.length > 0) {
                await message.channel.send(parsedResponse);

                // Send follow-up messages if any
                if (context.followUps && context.followUps.length > 0) {
                    for (const followUp of context.followUps) {
                        // Trim the follow up and make sure its not empty
                        const trimmedFollowUp = followUp.trim();
                        if (trimmedFollowUp.length > 0) {
                            await message.channel.send(trimmedFollowUp);
                        }
                    }
                }
            } else {
                logger.warn(`Custom command ${command} triggered by ${message.author.username} returned an empty response`);
                await message.channel.send(`(Empty response)`);
            }
        } catch (error) {
            logger.error(`Error triggering custom command ${command} by ${message.author.username}: ${error}`);
            await message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('Error Triggering Custom Command')
                        .setDescription(`I encountered an error while trying to execute this command. \n\nError:\n\`\`\`${error}\`\`\``)
                        .setColor('DarkRed')
                ]
            });
        }
    },
} as Event;

async function parseResponse(text: string, context: ParseContext): Promise<MessageCreateOptions> {
    let response = text;
    let instructions: InstructionArray = [];
    let instructionStarts: number[] = [];

    for (let index = 0; index < text.length; index++) {
        const char = text[index];

        if (char === '\\') {
            index++; // Skip the next character
            continue;
        }

        if (char === '{') {
            instructionStarts.push(index);
        }

        if (char === '}') {
            const instructionStart = instructionStarts.pop();

            if (instructionStart === undefined) {
                throw new Error('Unbalanced braces in custom command response');
            }

            instructions.push({
                start: instructionStart,
                end: index + 1,
            });
        }
    }

    let stickersToSend: Sticker[] = [];
    for (let i = 0; i < instructions.length; i++) {
        const instruction = instructions[i];

        // Check if instruction is undefined, if so, we skipped it (probably because of an if statement)
        if (instruction === undefined) {
            logger.debug("Skipped an instruction on index " + i)
            continue;
        }

        // Grab the instruction from the text
        const instructionText = response.slice(instruction.start, instruction.end);

        // Grab the parts of the instruction (and remove the first and last character, since they are braces)
        const instructionParts = instructionText.slice(1, -1).split(';');
        const instructionType = instructionParts[0];
        const instructionValues = instructionParts.slice(1);

        let replacement = '';
        logger.debug(`HANDLING INSTRUCTION: ${instructionText.substring(0, 40)} (index ${instruction.start}, ${instruction.end})...`)
        // We are executing some kind of instruction
        switch (instructionType) {
            case 'if':
                {
                    const codeToEvaluate = 'return ' + instructionValues.join(';') + ';';
                    const sandbox = new Sandbox();
                    const execCode = sandbox.compile(codeToEvaluate);
                    const codeRes = execCode({ ...context.variables }, context).run();

                    const { fiIndex, elseIndex } = getNextElseAndFiStatements(instructions, response, i);
                    let fiInstr = instructions[fiIndex];

                    if (fiIndex == -1 || fiInstr === undefined) {
                        throw new Error(`Could not find correspoding FI-Instruction for IF-Instruction with index ${i}`)
                    }

                    // Scrap everything from the else block
                    const elseInstr = instructions[elseIndex];

                    if (codeRes) {
                        if (!elseInstr) {
                            logger.debug(`No else instruction found`);
                            break;
                        }

                        let replaceStart = elseInstr.start;
                        let replaceEnd = fiInstr.end;

                        // Update the response
                        response = response.slice(0, replaceStart) + response.slice(replaceEnd);

                        // Update all instructions that are after the FI
                        for (let j = fiIndex + 1; j < instructions.length; j++) {
                            let updatedInstruction = instructions[j];
                            if (!updatedInstruction) continue;
                            const textSizeDiff = replaceStart - replaceEnd;

                            // Check if the instruction was removed
                            if (updatedInstruction.start > replaceStart && updatedInstruction.start < replaceEnd) {
                                updatedInstruction = undefined;
                                continue;
                            }

                            // Only change the start if the instruction starts behind us
                            if (updatedInstruction.start > instruction.start) {
                                updatedInstruction.start += textSizeDiff;
                            }
                            updatedInstruction.end += textSizeDiff;
                            instructions[j] = updatedInstruction;
                        }

                        for (let j = elseIndex; j < fiIndex; j++) {
                            instructions[j] = undefined;
                        }
                    } else {
                        // Remove all instructions until the 'else'
                        // Remove the 'fi'
                        if (elseInstr) {
                            let replaceStart = instruction.end;
                            let replaceEnd = elseInstr.end;

                            // Update the response
                            response = response.slice(0, replaceStart) + response.slice(replaceEnd);

                            // Update all instructions that are after the FI
                            for (let j = i + 1; j < instructions.length; j++) {
                                let updatedInstruction = instructions[j];
                                if (!updatedInstruction) continue;
                                const textSizeDiff = replaceStart - replaceEnd;

                                // Check if the instruction was removed
                                if (updatedInstruction.start > replaceStart && updatedInstruction.start < replaceEnd) {
                                    updatedInstruction = undefined;
                                    continue;
                                }
                                // Only change the start if the instruction starts behind us
                                if (updatedInstruction.start > instruction.start)
                                    updatedInstruction.start += textSizeDiff;
                                updatedInstruction.end += textSizeDiff;
                                instructions[j] = updatedInstruction;
                            }

                            fiInstr = instructions[fiIndex]!
                            replaceStart = fiInstr.start;
                            replaceEnd = fiInstr.end;

                            // Update the response
                            response = response.slice(0, replaceStart) + response.slice(replaceEnd);

                            // Update all instructions that are after the FI
                            for (let j = fiIndex + 1; j < instructions.length; j++) {
                                let updatedInstruction = instructions[j];
                                if (!updatedInstruction) continue;
                                const textSizeDiff = replaceStart - replaceEnd;


                                // Check if the instruction was removed
                                if (updatedInstruction.start > replaceStart && updatedInstruction.start < replaceEnd) {
                                    updatedInstruction = undefined;
                                    continue;
                                }

                                // Only change the start if the instruction starts behind us
                                if (updatedInstruction.start > instruction.start)
                                    updatedInstruction.start += textSizeDiff;
                                updatedInstruction.end += textSizeDiff;
                                instructions[j] = updatedInstruction;
                            }
                        } else {
                            fiInstr = instructions[fiIndex]!
                            let replaceStart = instruction.end; // The IF-Statement itself gets replaced later
                            let replaceEnd = fiInstr.end;

                            // Update the response
                            response = response.slice(0, replaceStart) + response.slice(replaceEnd);

                            // Update all instructions that are after the FI
                            for (let j = fiIndex + 1; j < instructions.length; j++) {
                                let updatedInstruction = instructions[j];
                                if (!updatedInstruction) continue;
                                const textSizeDiff = replaceStart - replaceEnd;


                                // Check if the instruction was removed
                                if (updatedInstruction.start > replaceStart && updatedInstruction.start < replaceEnd) {
                                    updatedInstruction = undefined;
                                    continue;
                                }

                                // Only change the start if the instruction starts behind us
                                if (updatedInstruction.start > instruction.start)
                                    updatedInstruction.start += textSizeDiff;
                                updatedInstruction.end += textSizeDiff;
                                instructions[j] = updatedInstruction;
                            }
                        }
                    }
                    break;
                }
            case 'else':
                logger.warn(`Unhandled else? ${instruction.start} - ${instruction.end} in '${response}'`)
                break;
            case 'fi':
                logger.warn(`Unhandled fi? ${instruction.start} - ${instruction.end} in '${response}'`)
                break;
            case 'set':
                {
                    const variableName = instructionValues[0];
                    const variableValue = instructionValues[1];

                    context.variables[variableName] = variableValue;
                    break;
                }
            case 'random':
                {
                    const randomMin = parseInt(instructionValues[0]);
                    const randomMax = parseInt(instructionValues[1]);

                    const randomNumber = Math.floor(Math.random() * (randomMax - randomMin + 1)) + randomMin;
                    replacement = randomNumber.toString();
                    break;
                }
            case 'choose':
                {
                    const randomItem = instructionValues[Math.floor(Math.random() * instructionValues.length)];
                    replacement = randomItem;
                    break;
                }
            case 'require':
                {
                    const requirement = instructionValues[0];
                    evaluateRequirement(requirement, context);
                    break;
                }
            case 'not':
                {
                    const notRequirement = instructionValues[0];
                    try {
                        evaluateRequirement(notRequirement, context);
                        // If the evaluation doesn't throw, we passed, which means we should not continue
                        throw new Error('Requirement not met');
                    } catch (error) {
                        // If the evaluation throws, the requirement was not met, so we are good to continue
                        continue;
                    }
                    break;
                }
            case 'followup': {
                context.followUps.push(instructionValues.join(';'));
                break;
            }
            case 'webrequest':
                {
                    const outputVariable = instructionValues[0];
                    const url = instructionValues[1];
                    const method = instructionValues[2] || 'GET';
                    let body = null;
                    if (instructionValues.length > 3) {
                        // If the body is set, we should parse it as JSON. It could potentially start with '\{' and end with '\}', so we should replace those with '{' and '}'
                        body = instructionValues[3].replace(/\\\{/g, '{').replace(/\\}/g, '}').replace(/\\\[/g, '[').replace(/\\\]/g, ']');
                        body = JSON.parse(body);
                    }

                    logger.debug(`Custom command triggered web request to '${url}' with method '${method}' and body '${body}'. Output to variable '${outputVariable}'`);

                    const response = await fetch(url, {
                        method: method,
                        body: body,
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                    });

                    if (!response.ok) {
                        throw new Error(`Failed to fetch data from ${url}: ${response.statusText}`);
                    }

                    const data = await response.json();
                    context.variables[outputVariable] = data;
                    break;
                }
            case 'sticker': {
                const stickerNameOrId = instructionValues[0];
                const sticker = context.message.guild?.stickers.cache.find(sticker => sticker.name === stickerNameOrId || sticker.id === stickerNameOrId);
                if (!sticker) {
                    throw new Error(`Sticker with name or ID ${stickerNameOrId} not found`);
                }
                stickersToSend.push(sticker);
                break;
            }
            default: {
                // Variable replacement
                logger.debug(`Custom command triggered variable replacement for '${instructionType}'`);
                let variableValue = getVariableValue(instructionType, context);
                if (variableValue instanceof Error) {
                    // If we get an error, the variable was not found, this could mean that the user just forgot to escape the brackets
                    // So we should just return the original instruction text
                    replacement = instructionText;
                } else if (variableValue === undefined || variableValue === null) {
                    replacement = '';
                } else if (typeof variableValue === 'object') {
                    replacement = JSON.stringify(variableValue);
                } else {
                    replacement = String(variableValue);
                }
                break;
            }
        }

        response = response.slice(0, instruction.start) + replacement + response.slice(instruction.end);

        // Update all instructions that are after the current instruction
        for (let j = i + 1; j < instructions.length; j++) {
            const updatedInstruction = instructions[j];
            if (!updatedInstruction) continue;
            const textSizeDiff = replacement.length - instructionText.length;

            // Only change the start if the instruction starts behind us
            if (updatedInstruction.start > instruction.start)
                updatedInstruction.start += textSizeDiff;
            updatedInstruction.end += textSizeDiff;
            instructions[j] = updatedInstruction;
        }
    }

    return {
        content: response,
        stickers: stickersToSend,
    };
}

function getVariableValue(variablePath: string, context: ParseContext): any {
    if (variablePath.startsWith('{') && variablePath.endsWith('}')) {
        variablePath = variablePath.slice(1, -1);
    }

    const pathParts = variablePath.split('.');
    let value = context.variables;

    for (const part of pathParts) {
        if (value && typeof value === 'object' && part in value) {
            value = value[part];
            logger.debug(`Found part ${part} in value`);
            logger.debug(`Value: ${JSON.stringify(value, null, 2).substring(0, 50)}`);
        } else if (!(part in value)) {
            logger.debug(`Could not find part ${part} in value ${JSON.stringify(value, null, 2).substring(0, 50)}`);
            return new Error(`Could not find variable ${variablePath}`);
        } else {
            // If the part is an array, we should be able to use things like .length, .join(' '), etc.
            if (Array.isArray(value)) {
                if (part === 'length') {
                    return value.length;
                }
                if (part.startsWith('join(\'') && part.endsWith('\')') || part.startsWith("join('") && part.endsWith("')")) {
                    // Remove join(, any symbol used for string (i.e. ' or ") and )
                    const joinString = part.slice(6, -2);
                    return value.join(joinString);
                }
            }
        }
    }

    // If the final value is an array, we join it with a space
    // (This is specifically for things like "{args}")
    if (Array.isArray(value)) {
        return value.join(' ');
    }

    return value;
}

function evaluateRequirement(requirement: string, context: ParseContext): boolean {
    if (requirement.startsWith('#')) {
        // Check if the channel name matches
        const channelName = requirement.slice(1);
        const requiredChannel = context.message.guild?.channels.cache.find(channel => channel.name === channelName);

        // Check if we find the required channel, if not, return an error
        if (!requiredChannel || requiredChannel.type !== ChannelType.GuildText) {
            throw new Error(`The required channel for this custom command ('#${channelName}') was not found. Please contact a server administrator to fix this.`);
        }

        if (context.message.channel.id !== requiredChannel.id) {
            throw new Error(`This custom command can only be used in <#${requiredChannel.id}>.`);
        }
    } else if (requirement === 'serverMod') {
        // Check if the user has the 'Manage Guild' permission
        if (!context.message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            throw new Error(`You do not have permission to use this command.`);
        }
    } else {
        // The requirement is a role
        const requiredRole = context.message.guild?.roles.cache.find(role => role.name === requirement);
        if (!requiredRole) {
            throw new Error(`The required role for this custom command ('${requirement}') was not found. Please contact a server administrator to fix this.`);
        }

        if (!context.message.member?.roles.cache.has(requiredRole.id)) {
            throw new Error(`You do not have the required role to use this command.`);
        }
    }

    return true;
}

function getNextElseAndFiStatements(instructions: InstructionArray, response: string, currentIdx: number) {
    let ifCount = 0;
    // Loop through the rest of the instructions, and check for the corresponding `else` and `fi`

    let elseIndex = -1;
    let fiIndex = -1;

    instSearch: for (let j = currentIdx + 1; j < instructions.length; j++) {
        const inst = instructions[j];
        if (!inst) continue;
        const instText = response.slice(inst.start, inst.end).slice(1, -1).split(";")[0];

        switch (instText) {
            case 'if':
                ifCount++;
                break;
            case 'else':
                if (ifCount == 0) {
                    elseIndex = j;
                }
                break;
            case 'fi':
                if (ifCount == 0) {
                    fiIndex = j;
                    break instSearch;
                } else {
                    ifCount--;
                }
                break;
        }
    }

    return { fiIndex, elseIndex };
}