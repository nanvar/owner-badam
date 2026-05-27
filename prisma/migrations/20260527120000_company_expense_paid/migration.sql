-- AlterTable: add `paid` flag for company entries. Defaults to true
-- so all historic rows count as paid; only PROFIT entries expose the
-- toggle in the UI.
ALTER TABLE `CompanyExpense` ADD COLUMN `paid` BOOLEAN NOT NULL DEFAULT true;
