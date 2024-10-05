-- AlterTable
ALTER TABLE "GuildSettings" ALTER COLUMN "timezone" DROP NOT NULL,
ALTER COLUMN "prefix" DROP NOT NULL,
ALTER COLUMN "prefix" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserSettings" ALTER COLUMN "timezone" DROP NOT NULL;
