-- AlterTable
ALTER TABLE `post` ADD COLUMN `category` VARCHAR(100) NOT NULL DEFAULT 'General',
    ADD COLUMN `imageUrl` VARCHAR(191) NULL,
    ADD COLUMN `tags` TEXT NULL;

-- AlterTable
ALTER TABLE `report` ADD COLUMN `category` VARCHAR(100) NOT NULL DEFAULT 'Other';

-- CreateTable
CREATE TABLE `PostReaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `postId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `type` ENUM('LIKE', 'SAVE') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PostReaction_userId_idx`(`userId`),
    INDEX `PostReaction_type_idx`(`type`),
    INDEX `PostReaction_postId_type_idx`(`postId`, `type`),
    UNIQUE INDEX `PostReaction_postId_userId_type_key`(`postId`, `userId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Post_category_idx` ON `Post`(`category`);

-- AddForeignKey
ALTER TABLE `PostReaction` ADD CONSTRAINT `PostReaction_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostReaction` ADD CONSTRAINT `PostReaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
