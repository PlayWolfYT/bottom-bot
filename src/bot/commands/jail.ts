import { Client, GuildMember, Role, SlashCommandBuilder } from "discord.js";
import type { Command } from "./Command";
import type { GuildSettings } from "@prisma/client";
import Logger from "@utils/logger";
import { prisma } from "@/database";

const logger = new Logger();

export default {
    name: "jail",
    description: "Command to jail users",
    async executeMessage(_client, _message, args, guildSettings) {
        if (true === true) {
            throw new Error("This command is not yet implemented correctly.");
        }

        const { jailRole } = await verifyGuildSettings(guildSettings, _client);

        const user = args[0];

        logger.debug(`Jailing user '${user}' with role '${jailRole}'`);
    },
    async executeSlash(client, interaction, guildSettings) {
        if (true === true) {
            throw new Error("This command is not yet implemented correctly.");
        }

        const { jailRole } = await verifyGuildSettings(guildSettings, client);

        const user = interaction.options.getMember('user');

        if (!user) {
            await interaction.reply({ content: 'Please specify a user to jail.', ephemeral: true });
            return;
        }

        if (user instanceof GuildMember) {
            const res = await jailUser(user, jailRole);

            if (res === true) {
                await interaction.reply({ content: `User ${user} has been jailed successfully.`, ephemeral: true });
            } else {
                await interaction.reply({ content: res, ephemeral: true });
            }
        } else {
            logger.error('User is not a GuildMember');
        }
    },
    slashCommandData: new SlashCommandBuilder()
        .setName('jail')
        .setDescription('Command to manage jail')
        .addUserOption(opt => opt.setName('user').setDescription('The user to send to jail'))
} as Command;

async function verifyGuildSettings(settings: GuildSettings | undefined, client: Client): Promise<{ jailRole: Role }> {
    if (!settings) {
        throw new Error('No jail settings were found for this guild. Please set them up using `/settings`');
    }

    const guild = await client.guilds.fetch(settings.guildId);

    if (!settings.jailRoleId) {
        throw new Error('Jail role not set');
    }

    const jailRole = await guild.roles.fetch(settings.jailRoleId);

    if (!jailRole) {
        throw new Error('Jail role not found');
    }

    return {
        jailRole,
    }
}

async function jailUser(user: GuildMember, jailRole: Role): Promise<true | string> {
    // Make sure the user is not already jailed
    const jailedUser = await prisma.jailedUser.findUnique({
        where: {
            guildId_userId: {
                guildId: user.guild.id,
                userId: user.id,
            },
        },
    });

    if (jailedUser) {
        return "User is already jailed.";
    }

    const currentRoles = user.roles.cache.map(role => role.id);

    await prisma.jailedUser.create({
        data: {
            guildId: user.guild.id,
            userId: user.id,
            roles: currentRoles,
        },
    });

    // Remove all roles from the user
    await user.roles.remove(currentRoles);

    // Add the jail role to the user
    await user.roles.add(jailRole);

    return true;
}