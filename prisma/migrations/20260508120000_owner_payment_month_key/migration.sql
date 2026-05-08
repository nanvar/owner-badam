-- AlterTable
ALTER TABLE `OwnerPayment` ADD COLUMN `monthKey` VARCHAR(7) NULL;

-- CreateIndex
CREATE INDEX `OwnerPayment_monthKey_idx` ON `OwnerPayment`(`monthKey`);
