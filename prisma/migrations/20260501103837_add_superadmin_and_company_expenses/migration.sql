-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('ADMIN', 'OWNER', 'SUPERADMIN') NOT NULL DEFAULT 'OWNER';

-- CreateTable
CREATE TABLE `CompanyExpense` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `category` ENUM('SALARY', 'RENT', 'MARKETING', 'SOFTWARE', 'TRAVEL', 'TAX', 'UTILITIES', 'OTHER') NOT NULL,
    `description` TEXT NOT NULL,
    `amount` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CompanyExpense_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
