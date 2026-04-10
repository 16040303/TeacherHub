/*
  Warnings:

  - Added the required column `updatedAt` to the `WalletTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `wallettransaction` ADD COLUMN `metadata` JSON NULL,
    ADD COLUMN `payoutAccountId` INTEGER NULL,
    ADD COLUMN `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'COMPLETED',
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- CreateTable
CREATE TABLE `PayoutAccount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `targetType` ENUM('BANK', 'MOMO', 'PAYPAL') NOT NULL,
    `providerName` VARCHAR(120) NOT NULL,
    `accountIdentifier` VARCHAR(191) NOT NULL,
    `accountOwnerName` VARCHAR(191) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `verificationStatus` ENUM('PENDING', 'SUCCESS', 'ERROR') NOT NULL DEFAULT 'PENDING',
    `verificationMessage` TEXT NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PayoutAccount_userId_idx`(`userId`),
    INDEX `PayoutAccount_userId_targetType_isDefault_idx`(`userId`, `targetType`, `isDefault`),
    UNIQUE INDEX `PayoutAccount_userId_targetType_accountIdentifier_key`(`userId`, `targetType`, `accountIdentifier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `WalletTransaction_status_idx` ON `WalletTransaction`(`status`);

-- CreateIndex
CREATE INDEX `WalletTransaction_payoutAccountId_idx` ON `WalletTransaction`(`payoutAccountId`);

-- AddForeignKey
ALTER TABLE `WalletTransaction` ADD CONSTRAINT `WalletTransaction_payoutAccountId_fkey` FOREIGN KEY (`payoutAccountId`) REFERENCES `PayoutAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayoutAccount` ADD CONSTRAINT `PayoutAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
