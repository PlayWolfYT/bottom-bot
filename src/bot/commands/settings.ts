import type { Command } from "@commands/Command";
import { prisma } from "@db";
import Logger from "@utils/logger";
import type { ReplyFunction } from "@/types";
import { getTimezone, TIMEZONES } from "@utils/Timezones";
import { env } from "bun";
import { ApplicationCommandOptionType, type Channel, Attachment, Role, SlashCommandBuilder, User, ChannelType, type APIRole, type InteractionReplyOptions, type MessageReplyOptions } from "discord.js";

const logger = new Logger();

type MappedOptionType = {
    [ApplicationCommandOptionType.String]: string,
    [ApplicationCommandOptionType.Integer]: number,
    [ApplicationCommandOptionType.Boolean]: boolean,
    [ApplicationCommandOptionType.User]: User,
    [ApplicationCommandOptionType.Channel]: Channel,
    [ApplicationCommandOptionType.Role]: Role | APIRole,
    [ApplicationCommandOptionType.Number]: number,
    [ApplicationCommandOptionType.Attachment]: Attachment,
}

export default {
    name: "settings",
    description: "Manage your or your guild's settings",
    executeMessage: async (_client, message, args) => {
        try {
            if (args.length === 0) {
                message.reply("Usage: !settings [guild|user] [setting] [value]");
                return;
            }

            const guildOrUser = args[0].toLowerCase();
            const setting = args[1].toLowerCase();
            const value = args.slice(2).join(" ");

            try {
                if (guildOrUser === "guild") {
                    await handleGuildCommand(setting, value, message.guildId!, (options) => message.reply(options as MessageReplyOptions));
                } else if (guildOrUser === "user") {
                    await handleUserCommand(setting, value, message.author.id, (options) => message.reply(options as MessageReplyOptions));
                } else {
                    message.reply("Usage: !settings [guild|user] [setting] [value]");
                }
            } catch (error) {
                logger.error(`Error executing settings command: ${error} for ${message.author.displayName}`);
                message.reply("There was an error executing that command.");
            }
        } catch (error) {
            logger.error(`Error executing settings command: ${error} for ${message.author.displayName}`);
            message.reply("There was an error executing that command.");
        }
    },
    executeSlash: async (_client, interaction) => {
        const subcommandGroup = interaction.options.getSubcommandGroup(true);
        const subcommand = interaction.options.getSubcommand(true);
        const opt = interaction.options.data[0].options![0];
        const setting = opt.name;
        // Check the type of the option
        const type = opt.type;
        let value: MappedOptionType[keyof MappedOptionType];
        switch (type) {
            case ApplicationCommandOptionType.String:
                value = interaction.options.getString(setting, true);
                break;
            case ApplicationCommandOptionType.Integer:
                value = interaction.options.getInteger(setting, true);
                break;
            case ApplicationCommandOptionType.Boolean:
                value = interaction.options.getBoolean(setting, true);
                break;
            case ApplicationCommandOptionType.User:
                value = interaction.options.getUser(setting, true);
                break;
            case ApplicationCommandOptionType.Channel:
                value = interaction.options.getChannel(setting, true, [ChannelType.GuildText, ChannelType.PublicThread, ChannelType.AnnouncementThread, ChannelType.GuildCategory, ChannelType.GuildVoice, ChannelType.GuildForum, ChannelType.GuildStageVoice, ChannelType.GuildDirectory, ChannelType.GuildMedia]);
                break;
            case ApplicationCommandOptionType.Role:
                value = interaction.options.getRole(setting, true);
                break;
            case ApplicationCommandOptionType.Number:
                value = interaction.options.getNumber(setting, true);
                break;
            case ApplicationCommandOptionType.Attachment:
                value = interaction.options.getAttachment(setting, true);
                break;
            default:
                throw new Error(`Unsupported option type: ${type}`);
        }

        try {
            if (subcommandGroup === "guild") {
                await handleGuildCommand(setting, value, interaction.guildId!, (options) => interaction.reply(options as InteractionReplyOptions));
            } else if (subcommandGroup === "user") {
                await handleUserCommand(setting, value, interaction.user.id, (options) => interaction.reply(options as InteractionReplyOptions));
            }
        } catch (error) {
            logger.error(`Error executing settings command: ${error} for ${interaction.user.displayName}`);
            interaction.reply({ content: "There was an error executing that command." });
        }
    },
    slashCommandData: new SlashCommandBuilder()
        .setName("settings")
        .setDescription("Manage your or your guild's settings")
        .addSubcommandGroup((group) =>
            group.setName("guild").setDescription("Manage your guild's settings")
                .addSubcommand((subcommand) =>
                    subcommand.setName("prefix").setDescription("Manage your guild's prefix")
                        .addStringOption((option) =>
                            option.setName("prefix").setDescription("The prefix to set")
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand.setName("timezone").setDescription("Manage your guild's default timezone")
                        .addStringOption((option) =>
                            option
                                .setName("timezone")
                                .setDescription("The timezone to set")
                                .setRequired(true)
                                .setAutocomplete(true)
                        )
                )
        )
        .addSubcommandGroup((group) =>
            group.setName("user").setDescription("Manage your settings")
                .addSubcommand((subcommand) =>
                    subcommand.setName("timezone").setDescription("Manage your timezone")
                        .addStringOption((option) =>
                            option.setName("timezone").setDescription("The timezone to set")
                                .setRequired(true)
                                .setAutocomplete(true)
                        )
                )
        )
} satisfies Command

async function handleGuildCommand(setting: string, value: MappedOptionType[keyof MappedOptionType] | null, guildId: string, replyFunction: ReplyFunction) {
    switch (setting) {
        case "prefix":
            value = (value as string).trim();
            if (value.length === 0) {
                const guildSettings = await prisma.guildSettings.findUnique({
                    where: {
                        guildId: guildId,
                    },
                });
                if (guildSettings) {
                    replyFunction({ content: "Your guild's prefix is currently set to `" + guildSettings.prefix + "`." });
                } else {
                    replyFunction({ content: "Your guild has no prefix set at the moment. The default prefix is `" + (env.BOT_PREFIX ?? "!") + "`." });
                }
                return;
            }

            await prisma.guildSettings.upsert({
                where: {
                    guildId: guildId,
                },
                update: {
                    prefix: value as string,
                },
                create: {
                    guildId: guildId,
                    prefix: value as string,
                },
            })
            replyFunction({ content: "Your guild's prefix has been set to `" + value + "`" });
            break;
        case "timezone":
            value = (value as string).toUpperCase();

            // Make sure the timezone is valid
            if (!getTimezone(value) && value !== "DEFAULT" && value !== "LIST") {
                replyFunction({ content: "That is not a valid timezone." });
                return;
            } else if (value === "LIST") {
                replyFunction({ content: "Here are the valid timezones: `" + TIMEZONES.join("`, `") + "`" });
                return;
            } else if (value === "DEFAULT") {
                value = null;
            } else if (value.trim().length === 0) {
                const timezone = await prisma.guildSettings.findUnique({
                    where: {
                        guildId: guildId,
                    },
                });
                if (timezone) {
                    replyFunction({ content: "Your guild's timezone is currently set to `" + timezone.timezone + "`." });
                } else {
                    replyFunction({ content: "Your guild has no timezone set at the moment. The default bot timezone is `CET`." });
                }
                return;
            }

            value = getTimezone(value as string);

            await prisma.guildSettings.upsert({
                where: {
                    guildId: guildId,
                },
                update: {
                    timezone: value as string,
                },
                create: {
                    guildId: guildId,
                    timezone: value as string,
                },
            })
            replyFunction({ content: "Your guild's timezone has been set to `" + value + "`" });
            break;
        default:
            throw new Error(`Unsupported setting: ${setting}`);
    }
}

async function handleUserCommand(setting: string, value: MappedOptionType[keyof MappedOptionType] | null, userId: string, replyFunction: ReplyFunction) {
    switch (setting) {
        case "timezone":

            value = (value as string).toUpperCase();

            // Make sure the timezone is valid
            if (!getTimezone(value) && value !== "DEFAULT" && value !== "LIST") {
                replyFunction({ content: "That is not a valid timezone." });
                return;
            } else if (value === "LIST") {
                replyFunction({ content: "Here are the valid timezones: `" + TIMEZONES.join("`, `") + "`" });
                return;
            } else if (value === "DEFAULT") {
                value = null;
            } else if (value.trim().length === 0) {
                const timezone = await prisma.userSettings.findUnique({
                    where: {
                        userId: userId,
                    },
                });
                if (timezone) {
                    replyFunction({ content: "Your timezone is currently set to `" + timezone.timezone + "`." });
                } else {
                    replyFunction({ content: "You have no timezone set at the moment. The default timezone for the bot is `CET`. To check your guild's timezone, use `/settings guild timezone`." });
                }
                return;
            }

            value = getTimezone(value as string) as string;

            await prisma.userSettings.upsert({
                create: {
                    userId: userId,
                    timezone: value,
                },
                update: {
                    timezone: value,
                },
                where: {
                    userId: userId,
                },
            })
            replyFunction({ content: "Your timezone has been set to `" + (value === null ? "Default" : value) + "`" });
            break;
        default:
            throw new Error(`Unsupported setting: ${setting}`);
    }
}
