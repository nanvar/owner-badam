-- CreateTable
CREATE TABLE `DirectBooking` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `guestName` VARCHAR(191) NOT NULL,
    `guestEmail` VARCHAR(191) NOT NULL,
    `guestPhone` VARCHAR(191) NULL,
    `numGuests` INTEGER NOT NULL,
    `checkIn` DATETIME(3) NOT NULL,
    `checkOut` DATETIME(3) NOT NULL,
    `nights` INTEGER NOT NULL,
    `pricePerNight` DOUBLE NOT NULL DEFAULT 0,
    `cleaningFee` DOUBLE NOT NULL DEFAULT 0,
    `totalPrice` DOUBLE NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'AED',
    `status` ENUM('PENDING', 'PAID', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `paymentRef` VARCHAR(191) NULL,
    `paymentProvider` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `paidAmount` DOUBLE NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DirectBooking_propertyId_idx`(`propertyId`),
    INDEX `DirectBooking_checkIn_idx`(`checkIn`),
    INDEX `DirectBooking_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DirectBooking` ADD CONSTRAINT `DirectBooking_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
