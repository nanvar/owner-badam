-- AlterTable
ALTER TABLE `CompanyExpense` ADD COLUMN `kind` ENUM('EXPENSE', 'PROFIT') NOT NULL DEFAULT 'EXPENSE',
    ADD COLUMN `propertyId` VARCHAR(191) NULL,
    MODIFY `category` ENUM('SALARY', 'RENT', 'MARKETING', 'SOFTWARE', 'TRAVEL', 'TAX', 'UTILITIES', 'OTHER') NULL;

-- CreateIndex
CREATE INDEX `CompanyExpense_kind_idx` ON `CompanyExpense`(`kind`);

-- CreateIndex
CREATE INDEX `CompanyExpense_propertyId_idx` ON `CompanyExpense`(`propertyId`);

-- AddForeignKey
ALTER TABLE `CompanyExpense` ADD CONSTRAINT `CompanyExpense_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
