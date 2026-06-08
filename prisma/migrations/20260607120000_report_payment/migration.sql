-- Settlement flags on the OwnerReport itself + back-link from the
-- corresponding OwnerPayment row so the reports list can render
-- paid state and the payment trail without an extra join.

ALTER TABLE `OwnerReport`
  ADD COLUMN `paidAt`        DATETIME(3)   NULL,
  ADD COLUMN `paidMethod`    VARCHAR(32)   NULL,
  ADD COLUMN `paidReference` VARCHAR(120)  NULL;

CREATE INDEX `OwnerReport_paidAt_idx` ON `OwnerReport`(`paidAt`);

ALTER TABLE `OwnerPayment`
  ADD COLUMN `reportId` VARCHAR(191) NULL;

CREATE INDEX `OwnerPayment_reportId_idx` ON `OwnerPayment`(`reportId`);

ALTER TABLE `OwnerPayment`
  ADD CONSTRAINT `OwnerPayment_reportId_fkey`
  FOREIGN KEY (`reportId`) REFERENCES `OwnerReport`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
