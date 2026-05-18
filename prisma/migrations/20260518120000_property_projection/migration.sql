-- CreateTable
CREATE TABLE `PropertyProjection` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `area` VARCHAR(191) NOT NULL DEFAULT '',
    `buildingName` VARCHAR(191) NOT NULL DEFAULT '',
    `avgMonthlyNet` DOUBLE NOT NULL DEFAULT 0,
    `duMonthly` DOUBLE NOT NULL DEFAULT 380,
    `dewaChillerMonthly` DOUBLE NOT NULL DEFAULT 650,
    `propertyInsuranceYearly` DOUBLE NOT NULL DEFAULT 1200,
    `maintenanceMonthly` DOUBLE NOT NULL DEFAULT 125,
    `dtcmPermitYearly` DOUBLE NOT NULL DEFAULT 370,
    `managementFeePct` DOUBLE NOT NULL DEFAULT 20,
    `vatPct` DOUBLE NOT NULL DEFAULT 5,
    `portalFeePct` DOUBLE NOT NULL DEFAULT 10.5,
    `pessimisticOccupancy` DOUBLE NOT NULL DEFAULT 75,
    `realisticOccupancy` DOUBLE NOT NULL DEFAULT 80,
    `optimisticOccupancy` DOUBLE NOT NULL DEFAULT 85,
    `pessimisticGross` DOUBLE NOT NULL DEFAULT 0,
    `realisticGross` DOUBLE NOT NULL DEFAULT 0,
    `optimisticGross` DOUBLE NOT NULL DEFAULT 0,
    `listingMgmtBullets` TEXT NULL,
    `guestMgmtBullets` TEXT NULL,
    `propertyMgmtBullets` TEXT NULL,
    `aboutText` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PropertyProjection_propertyId_key`(`propertyId`),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PropertyProjection`
  ADD CONSTRAINT `PropertyProjection_propertyId_fkey`
  FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
