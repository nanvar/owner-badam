-- AlterTable
ALTER TABLE `Property` ADD COLUMN `airbnbUrl` TEXT NULL,
    ADD COLUMN `amenities` JSON NULL,
    ADD COLUMN `bathrooms` DOUBLE NULL,
    ADD COLUMN `bedrooms` INTEGER NULL,
    ADD COLUMN `beds` INTEGER NULL,
    ADD COLUMN `crawlPayload` JSON NULL,
    ADD COLUMN `crawledAt` DATETIME(3) NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `maxGuests` INTEGER NULL,
    ADD COLUMN `photos` JSON NULL;
