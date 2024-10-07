/*
  Warnings:

  - A unique constraint covering the columns `[messageId]` on the table `Reminder` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `Reminder_messageId_key` ON `Reminder`(`messageId`);
