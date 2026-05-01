-- CreateTable
CREATE TABLE `OwnerPayment` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `method` VARCHAR(191) NULL,
    `reference` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `recordedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OwnerPayment_ownerId_idx`(`ownerId`),
    INDEX `OwnerPayment_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OwnerPayment` ADD CONSTRAINT `OwnerPayment_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OwnerPayment` ADD CONSTRAINT `OwnerPayment_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
