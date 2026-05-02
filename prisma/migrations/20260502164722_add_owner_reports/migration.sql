-- AlterTable
ALTER TABLE `Expense` ADD COLUMN `reportId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Reservation` ADD COLUMN `reportId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `OwnerReport` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `totalIncome` DOUBLE NOT NULL DEFAULT 0,
    `totalExpenses` DOUBLE NOT NULL DEFAULT 0,
    `netPayout` DOUBLE NOT NULL DEFAULT 0,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OwnerReport_ownerId_idx`(`ownerId`),
    INDEX `OwnerReport_propertyId_idx`(`propertyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Expense_reportId_idx` ON `Expense`(`reportId`);

-- CreateIndex
CREATE INDEX `Reservation_reportId_idx` ON `Reservation`(`reportId`);

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `OwnerReport`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `OwnerReport`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OwnerReport` ADD CONSTRAINT `OwnerReport_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OwnerReport` ADD CONSTRAINT `OwnerReport_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OwnerReport` ADD CONSTRAINT `OwnerReport_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
