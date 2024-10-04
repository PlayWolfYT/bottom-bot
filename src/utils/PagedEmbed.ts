import { ButtonBuilder, ButtonInteraction, ButtonStyle, Message, ActionRowBuilder, EmbedBuilder } from "discord.js";
import type { InteractionReplyOptions, MessageCreateOptions, MessageEditOptions } from "discord.js";
import Logger from "@/logger";
import { createErrorEmbed } from "@/utils/ErrorEmbed";
import type { ReplyFunction } from "@/types";
import crypto from "crypto";

const logger = new Logger();

export class PagedEmbed<T> {
    private fetchItems: (page: number, itemsPerPage: number) => Promise<{ items: T[], totalPages?: number }>;
    private embedGenerator: (displayedItems: T[], currentPage: number, totalPages?: number) => EmbedBuilder;
    private userId: string;
    private message: Message | null;
    private itemsPerPage: number;
    private buttonPrefix: string;
    private buttonTimeout: number;
    private replyFunction: ReplyFunction;

    constructor(
        fetchItems: (page: number, itemsPerPage: number) => Promise<{ items: T[], totalPages?: number }>,
        embedGenerator: (displayedItems: T[], currentPage: number, totalPages?: number) => EmbedBuilder,
        userId: string,
        replyFunction: ReplyFunction,
        itemsPerPage: number = 9,
        buttonPrefix: string = crypto.randomBytes(6).toString('hex'),
        buttonTimeout: number = 10_000,
    ) {
        this.fetchItems = fetchItems;
        this.embedGenerator = embedGenerator;
        this.userId = userId;
        this.itemsPerPage = itemsPerPage;
        this.buttonPrefix = buttonPrefix;
        this.buttonTimeout = buttonTimeout;
        this.replyFunction = replyFunction;
        this.message = null;
    }

    private async generatePage(page: number): Promise<{ embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> }> {
        const { items, totalPages } = await this.fetchItems(page, this.itemsPerPage);

        const embed = this.embedGenerator(items, page, totalPages);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`${this.buttonPrefix}PrevPage_${page}`)
                    .setLabel('Previous Page')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 1),
                new ButtonBuilder()
                    .setCustomId(`${this.buttonPrefix}NextPage_${page}`)
                    .setLabel('Next Page')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(/* Check if we have a next page */ page === totalPages)
            );

        return { embed, row };
    }

    private async handlePage(page: number): Promise<void> {
        try {
            const { embed, row } = await this.generatePage(page);

            const replyOptions: MessageCreateOptions | InteractionReplyOptions = { embeds: [embed], components: [row] };

            if (!this.message) {
                this.message = await this.replyFunction(replyOptions);
                logger.debug(`Paged embed created with message id: ${this.message!.id}`);
            } else if (this.message.editable) {
                await this.message.edit(replyOptions as MessageEditOptions);
            }

            const collector = this.message?.createMessageComponentCollector({
                filter: (i) => i.customId.startsWith(`${this.buttonPrefix}PrevPage_`) || i.customId.startsWith(`${this.buttonPrefix}NextPage_`),
                time: this.buttonTimeout,
            });

            collector?.on("collect", async (interaction: ButtonInteraction) => {
                if (interaction.user.id !== this.userId) {
                    await interaction.reply({ content: "You can't interact with this message!", ephemeral: true });
                    return;
                }
                const newPage = interaction.customId.startsWith(`${this.buttonPrefix}PrevPage_`) ? page - 1 : page + 1;
                collector.stop();
                interaction.deferUpdate();
                await this.handlePage(newPage);
            });

            collector?.on("end", (_, reason) => {
                if (reason !== "user" && this.message) {
                    this.message.edit({ components: [] }).catch((error) => {
                        logger.error(`Failed to remove buttons after timeout: ${error}`);
                    });
                }
            });
        } catch (error) {
            logger.error(`Error creating paged embed: ${error}`);
            const embed = createErrorEmbed(`There was an error generating the embed for this action.\n-# Failed to fetch items for page ${page}`, error as Error);
            if (this.message) {
                await this.message.edit({ content: "An error occured", embeds: [embed], components: [] });
            } else {
                await this.replyFunction({ content: "An error occured", embeds: [embed], components: [] });
            }
        }
    }

    public async createPagedEmbed(): Promise<void> {
        await this.handlePage(1);
    }
}