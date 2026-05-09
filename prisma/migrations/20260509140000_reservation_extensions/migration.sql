-- Restore the boolean `paid` flag on Reservation and drop paidAmount.
ALTER TABLE `Reservation` ADD COLUMN `paid` BOOLEAN NOT NULL DEFAULT false;

-- Backfill: rows whose paidAmount covered the totalPrice are paid.
UPDATE `Reservation`
   SET `paid` = 1
 WHERE `paidAmount` >= `totalPrice` AND `totalPrice` > 0;

-- CreateIndex
CREATE INDEX `Reservation_paid_idx` ON `Reservation`(`paid`);

-- AlterTable: paidAmount is replaced by per-row `paid` boolean +
-- ReservationExtension records.
ALTER TABLE `Reservation` DROP COLUMN `paidAmount`;

-- CreateTable
CREATE TABLE `ReservationExtension` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `checkIn` DATETIME(3) NOT NULL,
    `checkOut` DATETIME(3) NOT NULL,
    `nights` INTEGER NOT NULL,
    `totalPrice` DOUBLE NOT NULL DEFAULT 0,
    `agencyCommission` DOUBLE NOT NULL DEFAULT 0,
    `portalCommission` DOUBLE NOT NULL DEFAULT 0,
    `payout` DOUBLE NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'AED',
    `notes` TEXT NULL,
    `paid` BOOLEAN NOT NULL DEFAULT false,
    `monthKey` VARCHAR(7) NULL,
    `detailsFilled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReservationExtension_reservationId_idx`(`reservationId`),
    INDEX `ReservationExtension_monthKey_idx`(`monthKey`),
    INDEX `ReservationExtension_paid_idx`(`paid`),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ReservationExtension`
  ADD CONSTRAINT `ReservationExtension_reservationId_fkey`
  FOREIGN KEY (`reservationId`)
  REFERENCES `Reservation`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;
