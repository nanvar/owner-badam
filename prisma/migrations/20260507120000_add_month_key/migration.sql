-- AlterTable
ALTER TABLE `Reservation` ADD COLUMN `monthKey` VARCHAR(7) NULL;

-- CreateIndex
CREATE INDEX `Reservation_monthKey_idx` ON `Reservation`(`monthKey`);

-- AlterTable
ALTER TABLE `Expense` ADD COLUMN `monthKey` VARCHAR(7) NULL;

-- CreateIndex
CREATE INDEX `Expense_monthKey_idx` ON `Expense`(`monthKey`);

-- AlterTable
ALTER TABLE `CompanyExpense` ADD COLUMN `monthKey` VARCHAR(7) NULL;

-- CreateIndex
CREATE INDEX `CompanyExpense_monthKey_idx` ON `CompanyExpense`(`monthKey`);
