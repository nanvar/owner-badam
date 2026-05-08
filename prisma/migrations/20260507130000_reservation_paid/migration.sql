-- AlterTable
ALTER TABLE `Reservation` ADD COLUMN `paid` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `Reservation_paid_idx` ON `Reservation`(`paid`);
