-- AlterTable: track partial payments instead of a boolean flag.
ALTER TABLE `Reservation` ADD COLUMN `paidAmount` DOUBLE NOT NULL DEFAULT 0;

-- Backfill: existing rows marked paid get full payment, others stay 0.
UPDATE `Reservation` SET `paidAmount` = `totalPrice` WHERE `paid` = 1;
