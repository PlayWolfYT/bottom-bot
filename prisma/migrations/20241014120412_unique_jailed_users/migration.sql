/*
  Warnings:

  - A unique constraint covering the columns `[guildId,userId]` on the table `JailedUser` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `JailedUser` MODIFY `reason` TEXT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `JailedUser_guildId_userId_key` ON `JailedUser`(`guildId`, `userId`);
