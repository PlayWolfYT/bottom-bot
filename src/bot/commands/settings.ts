import type { Command } from "@commands/Command";
import { prisma } from "@db";
import { getTimezone, GMT_TO_TIMEZONE, TIMEZONES } from "@utils/Timezones";
import { SlashCommandBuilder } from "discord.js";

export default {
    name: "settings",
    description: "Manage your or your guild's settings",
    executeMessage: async (_client, message, _args) => {
        message.reply("Please use slash commands to manage your and your guild's settings. (/settings)");
    },
    executeSlash: async (_client, interaction) => {
        const subcommandGroup = interaction.options.getSubcommandGroup(true);
        const subcommand = interaction.options.getSubcommand(true);

        let response;
        let ephemeral = false;

        if (subcommandGroup === "guild") {
            switch (subcommand) {
                case "prefix":
                    const prefix = interaction.options.getString("prefix", true);

                    await prisma.guildSettings.upsert({
                        where: {
                            guildId: interaction.guildId!,
                        },
                        update: {
                            prefix,
                        },
                        create: {
                            guildId: interaction.guildId!,
                            prefix,
                        },
                    });
                    response = `Successfully set the prefix to ${prefix}`;
                    ephemeral = true;
                    break;
                case "timezone":
                    const timezoneString = interaction.options.getString("timezone", true).toUpperCase();

                    switch (timezoneString) {
                        case 'DEFAULT':
                            await prisma.guildSettings.upsert({
                                where: {
                                    guildId: interaction.guildId!,
                                },
                                update: {
                                    timezone: null,
                                },
                                create: {
                                    guildId: interaction.guildId!,
                                    timezone: null,
                                },
                            });
                            response = "Successfully reset the timezone.";
                            ephemeral = true;
                            break;
                        case 'LIST':
                            response = "Here are all valid timezones:\n\n`" + TIMEZONES.join("`, `") + "`\n\nNote that you may also use `GMT+X` or `GMT-X`, or use `DEFAULT` to reset your timezone.";
                            ephemeral = true;
                            break;
                        default:
                            const timezone = getTimezone(timezoneString);
                            if (!timezone) {
                                response = "That is not a valid timezone.";
                                ephemeral = true;
                                return;
                            }

                            await prisma.guildSettings.upsert({
                                where: {
                                    guildId: interaction.guildId!,
                                },
                                update: {
                                    timezone,
                                },
                                create: {
                                    guildId: interaction.guildId!,
                                    timezone,
                                },
                            });
                            response = `Successfully set the guild timezone to ${timezoneString}.`;
                            ephemeral = true;
                            break;
                    }
                    break;
                case "jail-role":
                    const role = interaction.options.getRole("role", true);

                    await prisma.guildSettings.upsert({
                        where: {
                            guildId: interaction.guildId!,
                        },
                        update: {
                            jailRoleId: role.id,
                        },
                        create: {
                            guildId: interaction.guildId!,
                            jailRoleId: role.id,
                        },
                    });
                    response = `Successfully set the jail role to ${role.name}.`;
                    ephemeral = true;
                    break;
                default:
                    throw new Error(`Unsupported subcommand: ${subcommand}`);
            }
        } else if (subcommandGroup === "user") {
            switch (subcommand) {
                case "timezone":
                    const timezoneString = interaction.options.getString("timezone", true).toUpperCase();

                    switch (timezoneString) {
                        case 'DEFAULT':
                            await prisma.userSettings.upsert({
                                where: {
                                    userId: interaction.user.id,
                                },
                                update: {
                                    timezone: null,
                                },
                                create: {
                                    userId: interaction.user.id,
                                    timezone: null,
                                },
                            });
                            response = "Successfully reset the timezone.";
                            ephemeral = true;
                            break;
                        case 'LIST':
                            response = "Here are all valid timezones:\n\n`" + TIMEZONES.join("`, `") + "`\n\nNote that you may also use `GMT+X` or `GMT-X`, or use `DEFAULT` to reset your timezone.";
                            ephemeral = true;
                            break;
                        default:
                            const timezone = getTimezone(timezoneString);
                            if (!timezone) {
                                response = "That is not a valid timezone.";
                                ephemeral = true;
                                return;
                            }

                            await prisma.userSettings.upsert({
                                where: {
                                    userId: interaction.user.id,
                                },
                                update: {
                                    timezone,
                                },
                                create: {
                                    userId: interaction.user.id,
                                    timezone,
                                },
                            });
                            response = `Successfully set your personal timezone to ${timezoneString}.`;
                            ephemeral = true;
                            break;
                    }

                    break;
                default:
                    throw new Error(`Unsupported subcommand: ${subcommand}`);
            }
        } else throw new Error(`Unsupported subcommand group: ${subcommandGroup}`);

        await interaction.reply({
            content: response,
            ephemeral,
        });
    },
    async autoComplete(_client, interaction, _guildSettings) {
        const subcommand = interaction.options.getSubcommand(true);

        if (subcommand === "timezone") {
            const input = interaction.options.getFocused(true).value.toUpperCase();
            const timezones = [...TIMEZONES.map(name => ({ name, value: name })), ...Object.entries(GMT_TO_TIMEZONE).map(([name, value]) => ({ name, value }))]
            const filtered = timezones.filter(name => name.name.startsWith(input));
            await interaction.respond(filtered.slice(0, 25));
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
                .addSubcommand((subcommand) =>
                    subcommand.setName("jail-role").setDescription("Manage your guild's jail role")
                        .addRoleOption((option) =>
                            option.setName("role").setDescription("The role to set as the jail role")
                                .setRequired(true)
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