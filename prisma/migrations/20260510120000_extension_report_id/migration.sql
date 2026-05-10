-- AlterTable: extensions can now be bundled into an owner report.
ALTER TABLE `ReservationExtension` ADD COLUMN `reportId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `ReservationExtension_reportId_idx` ON `ReservationExtension`(`reportId`);

-- AddForeignKey
ALTER TABLE `ReservationExtension`
  ADD CONSTRAINT `ReservationExtension_reportId_fkey`
  FOREIGN KEY (`reportId`)
  REFERENCES `OwnerReport`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
