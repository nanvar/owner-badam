-- Expense: new flag indicating the company covered this expense out
-- of invested capital. Triggers Investment SPEND + OwnerDebt rows on
-- the application side. Defaults to false so existing rows behave
-- the same way they always have.
ALTER TABLE `Expense` ADD COLUMN `paidFromCompanyInvest` BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX `Expense_paidFromCompanyInvest_idx` ON `Expense`(`paidFromCompanyInvest`);

-- Investment: split the ledger into INCOME / SPEND rows and add the
-- optional links back to a property / source expense so SPEND rows
-- can be reconciled with the property expense that triggered them.
ALTER TABLE `Investment` ADD COLUMN `kind` ENUM('INCOME', 'SPEND') NOT NULL DEFAULT 'INCOME';
ALTER TABLE `Investment` ADD COLUMN `propertyId` VARCHAR(191) NULL;
ALTER TABLE `Investment` ADD COLUMN `expenseId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Investment_expenseId_key` ON `Investment`(`expenseId`);
CREATE INDEX `Investment_kind_idx` ON `Investment`(`kind`);
CREATE INDEX `Investment_propertyId_idx` ON `Investment`(`propertyId`);

ALTER TABLE `Investment`
  ADD CONSTRAINT `Investment_propertyId_fkey`
  FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Investment`
  ADD CONSTRAINT `Investment_expenseId_fkey`
  FOREIGN KEY (`expenseId`) REFERENCES `Expense`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- OwnerDebt: pending/paid IOUs that owners have toward the company.
CREATE TABLE `OwnerDebt` (
  `id`          VARCHAR(191) NOT NULL,
  `ownerId`     VARCHAR(191) NOT NULL,
  `propertyId`  VARCHAR(191) NULL,
  `expenseId`   VARCHAR(191) NULL,
  `amount`      DOUBLE NOT NULL,
  `description` TEXT NULL,
  `status`      ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PENDING',
  `paidAt`      DATETIME(3) NULL,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3) NOT NULL,

  UNIQUE INDEX `OwnerDebt_expenseId_key`(`expenseId`),
  INDEX `OwnerDebt_ownerId_idx`(`ownerId`),
  INDEX `OwnerDebt_status_idx`(`status`),
  INDEX `OwnerDebt_propertyId_idx`(`propertyId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OwnerDebt`
  ADD CONSTRAINT `OwnerDebt_ownerId_fkey`
  FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `OwnerDebt`
  ADD CONSTRAINT `OwnerDebt_propertyId_fkey`
  FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `OwnerDebt`
  ADD CONSTRAINT `OwnerDebt_expenseId_fkey`
  FOREIGN KEY (`expenseId`) REFERENCES `Expense`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
