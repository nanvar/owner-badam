-- DropIndex
DROP INDEX `Reservation_paid_idx` ON `Reservation`;

-- AlterTable: paid boolean is replaced by paidAmount.
ALTER TABLE `Reservation` DROP COLUMN `paid`;
