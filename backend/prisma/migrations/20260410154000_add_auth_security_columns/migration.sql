-- AlterTable
ALTER TABLE `User`
    ADD COLUMN `isEmailVerified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL,
    ADD COLUMN `emailVerificationToken` VARCHAR(255) NULL,
    ADD COLUMN `emailVerificationExp` DATETIME(3) NULL,
    ADD COLUMN `passwordResetToken` VARCHAR(255) NULL,
    ADD COLUMN `passwordResetExp` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `User_passwordResetToken_idx` ON `User`(`passwordResetToken`);

-- CreateIndex
CREATE INDEX `User_passwordResetExp_idx` ON `User`(`passwordResetExp`);
