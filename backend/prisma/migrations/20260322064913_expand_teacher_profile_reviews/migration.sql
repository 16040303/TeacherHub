/*
  Warnings:

  - A unique constraint covering the columns `[reviewerId,lessonId]` on the table `Review` will be added. If there are existing duplicate values, this will fail.
  - Made the column `comment` on table `review` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `review` MODIFY `comment` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `teacherprofile` ADD COLUMN `avatarUrl` VARCHAR(191) NULL,
    ADD COLUMN `expertise` TEXT NULL,
    ADD COLUMN `location` VARCHAR(191) NULL,
    ADD COLUMN `socialLinks` TEXT NULL,
    ADD COLUMN `yearsExperience` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Review_teacherId_createdAt_idx` ON `Review`(`teacherId`, `createdAt`);

-- CreateIndex
CREATE INDEX `Review_lessonId_createdAt_idx` ON `Review`(`lessonId`, `createdAt`);

-- CreateIndex
CREATE UNIQUE INDEX `Review_reviewerId_lessonId_key` ON `Review`(`reviewerId`, `lessonId`);

-- CreateIndex
CREATE INDEX `TeacherProfile_yearsExperience_idx` ON `TeacherProfile`(`yearsExperience`);
