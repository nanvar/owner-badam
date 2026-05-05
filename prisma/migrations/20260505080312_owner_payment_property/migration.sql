-- AlterTable
ALTER TABLE `OwnerPayment` ADD COLUMN `propertyId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `OwnerPayment_propertyId_idx` ON `OwnerPayment`(`propertyId`);

-- AddForeignKey
ALTER TABLE `OwnerPayment` ADD CONSTRAINT `OwnerPayment_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
