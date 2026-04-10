/*
  Warnings:

  - The values [REFUNDED,EXPIRED] on the enum `Order_status` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `provider` on the `payment` table. All the data in the column will be lost.
  - You are about to drop the column `providerRef` on the `payment` table. All the data in the column will be lost.
  - The values [SUCCEEDED,REFUNDED] on the enum `Payment_status` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[reference]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `Payment_providerRef_key` ON `payment`;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `entitlementGrantedAt` DATETIME(3) NULL,
    ADD COLUMN `entitlementSource` VARCHAR(64) NULL,
    ADD COLUMN `failedAt` DATETIME(3) NULL,
    ADD COLUMN `paidAt` DATETIME(3) NULL,
    MODIFY `status` ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `payment` DROP COLUMN `provider`,
    DROP COLUMN `providerRef`,
    ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `failedAt` DATETIME(3) NULL,
    ADD COLUMN `method` VARCHAR(64) NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN `reference` VARCHAR(191) NULL,
    MODIFY `status` ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE UNIQUE INDEX `Payment_reference_key` ON `Payment`(`reference`);
