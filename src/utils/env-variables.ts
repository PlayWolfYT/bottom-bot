import Logger from "@utils/logger";
import { env } from "bun";

const logger = new Logger();

export function validateEnvVariables() {
  if (!env.BOT_TOKEN) {
    logger.error("BOT_TOKEN must be set in the environment variables.");
    process.exit(1);
  }
  if (!env.CLIENT_ID) {
    logger.error("CLIENT_ID must be set in the environment variables.");
    process.exit(1);
  }
}
