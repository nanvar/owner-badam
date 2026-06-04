-- ============================================================
-- Phase 1: foundation schema for the next-gen owner panel.
-- Adds: managementOnly flag, expense receipts, property media +
-- history, service charge tracking, owner stay quota + booking
-- requests, owner activity feed, per-user preferences, Web Push
-- subscriptions.
-- ============================================================

-- Property: new flags
ALTER TABLE `Property`
  ADD COLUMN `managementOnly` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `coverPhotoUrl`  TEXT NULL;
CREATE INDEX `Property_managementOnly_idx` ON `Property`(`managementOnly`);

-- Expense: receipt media link
ALTER TABLE `Expense`
  ADD COLUMN `receiptMediaId` VARCHAR(191) NULL;

-- PropertyMedia
CREATE TABLE `PropertyMedia` (
  `id`                VARCHAR(191) NOT NULL,
  `propertyId`        VARCHAR(191) NOT NULL,
  `kind`              ENUM('PHOTO','DOCUMENT','RECEIPT','EVENT_PHOTO','SERVICE_CHARGE_PROOF','COVER') NOT NULL,
  `url`               TEXT NOT NULL,
  `fileName`          VARCHAR(255) NULL,
  `fileSize`          INT NULL,
  `mimeType`          VARCHAR(120) NULL,
  `title`             VARCHAR(255) NULL,
  `caption`           TEXT NULL,
  `takenAt`           DATETIME(3) NULL,
  `uploadedById`      VARCHAR(191) NULL,
  `eventId`           VARCHAR(191) NULL,
  `serviceInstanceId` VARCHAR(191) NULL,
  `createdAt`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`         DATETIME(3) NOT NULL,
  INDEX `PropertyMedia_propertyId_kind_idx`(`propertyId`, `kind`),
  INDEX `PropertyMedia_eventId_idx`(`eventId`),
  INDEX `PropertyMedia_serviceInstanceId_idx`(`serviceInstanceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- PropertyEvent
CREATE TABLE `PropertyEvent` (
  `id`          VARCHAR(191) NOT NULL,
  `propertyId`  VARCHAR(191) NOT NULL,
  `kind`        VARCHAR(40)  NOT NULL,
  `title`       VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `happenedAt`  DATETIME(3)  NOT NULL,
  `createdById` VARCHAR(191) NULL,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL,
  INDEX `PropertyEvent_propertyId_idx`(`propertyId`),
  INDEX `PropertyEvent_happenedAt_idx`(`happenedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ServiceChargeSchedule
CREATE TABLE `ServiceChargeSchedule` (
  `id`                 VARCHAR(191) NOT NULL,
  `propertyId`         VARCHAR(191) NOT NULL,
  `frequencyMonths`    INT          NOT NULL DEFAULT 3,
  `reminderDaysBefore` INT          NOT NULL DEFAULT 7,
  `firstDueDate`       DATETIME(3)  NOT NULL,
  `active`             BOOLEAN      NOT NULL DEFAULT true,
  `createdAt`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`          DATETIME(3)  NOT NULL,
  UNIQUE INDEX `ServiceChargeSchedule_propertyId_key`(`propertyId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ServiceChargeInstance
CREATE TABLE `ServiceChargeInstance` (
  `id`             VARCHAR(191) NOT NULL,
  `propertyId`     VARCHAR(191) NOT NULL,
  `dueDate`        DATETIME(3)  NOT NULL,
  `status`         ENUM('UPCOMING','REMINDING','PAID','SKIPPED') NOT NULL DEFAULT 'UPCOMING',
  `paidAt`         DATETIME(3)  NULL,
  `amount`         DOUBLE NULL,
  `notes`          TEXT NULL,
  `lastReminderAt` DATETIME(3)  NULL,
  `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`      DATETIME(3)  NOT NULL,
  UNIQUE INDEX `ServiceChargeInstance_propertyId_dueDate_key`(`propertyId`, `dueDate`),
  INDEX `ServiceChargeInstance_status_idx`(`status`),
  INDEX `ServiceChargeInstance_dueDate_idx`(`dueDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- OwnerStayQuota
CREATE TABLE `OwnerStayQuota` (
  `id`             VARCHAR(191) NOT NULL,
  `propertyId`     VARCHAR(191) NOT NULL,
  `daysPerYear`    INT          NOT NULL DEFAULT 0,
  `yearStartMonth` INT          NOT NULL DEFAULT 1,
  `yearStartDay`   INT          NOT NULL DEFAULT 1,
  `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`      DATETIME(3)  NOT NULL,
  UNIQUE INDEX `OwnerStayQuota_propertyId_key`(`propertyId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- OwnerReservationRequest
CREATE TABLE `OwnerReservationRequest` (
  `id`           VARCHAR(191) NOT NULL,
  `propertyId`   VARCHAR(191) NOT NULL,
  `ownerId`      VARCHAR(191) NOT NULL,
  `checkIn`      DATETIME(3)  NOT NULL,
  `checkOut`     DATETIME(3)  NOT NULL,
  `nights`       INT          NOT NULL,
  `notes`        TEXT NULL,
  `status`       ENUM('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `decidedAt`    DATETIME(3) NULL,
  `decidedById`  VARCHAR(191) NULL,
  `decisionNote` TEXT NULL,
  `createdAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`    DATETIME(3) NOT NULL,
  INDEX `OwnerReservationRequest_propertyId_idx`(`propertyId`),
  INDEX `OwnerReservationRequest_ownerId_idx`(`ownerId`),
  INDEX `OwnerReservationRequest_status_idx`(`status`),
  INDEX `OwnerReservationRequest_checkIn_idx`(`checkIn`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ActivityEvent
CREATE TABLE `ActivityEvent` (
  `id`        VARCHAR(191) NOT NULL,
  `ownerId`   VARCHAR(191) NOT NULL,
  `type`      VARCHAR(60)  NOT NULL,
  `title`     VARCHAR(255) NOT NULL,
  `body`      TEXT NULL,
  `data`      JSON NULL,
  `readAt`    DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ActivityEvent_ownerId_createdAt_idx`(`ownerId`, `createdAt`),
  INDEX `ActivityEvent_ownerId_readAt_idx`(`ownerId`, `readAt`),
  INDEX `ActivityEvent_type_idx`(`type`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- UserPreference
CREATE TABLE `UserPreference` (
  `id`                VARCHAR(191) NOT NULL,
  `userId`            VARCHAR(191) NOT NULL,
  `easyMode`          BOOLEAN      NOT NULL DEFAULT false,
  `notificationPrefs` JSON NULL,
  `ui`                JSON NULL,
  `createdAt`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`         DATETIME(3)  NOT NULL,
  UNIQUE INDEX `UserPreference_userId_key`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- WebPushSubscription
CREATE TABLE `WebPushSubscription` (
  `id`        VARCHAR(191) NOT NULL,
  `userId`    VARCHAR(191) NOT NULL,
  `endpoint`  VARCHAR(500) NOT NULL,
  `p256dh`    VARCHAR(255) NOT NULL,
  `auth`      VARCHAR(120) NOT NULL,
  `userAgent` VARCHAR(255) NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL,
  UNIQUE INDEX `WebPushSubscription_endpoint_key`(`endpoint`),
  INDEX `WebPushSubscription_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys
ALTER TABLE `Expense`
  ADD CONSTRAINT `Expense_receiptMediaId_fkey`
  FOREIGN KEY (`receiptMediaId`) REFERENCES `PropertyMedia`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `PropertyMedia`
  ADD CONSTRAINT `PropertyMedia_propertyId_fkey`
  FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PropertyMedia_uploadedById_fkey`
  FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `PropertyMedia_eventId_fkey`
  FOREIGN KEY (`eventId`) REFERENCES `PropertyEvent`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `PropertyMedia_serviceInstanceId_fkey`
  FOREIGN KEY (`serviceInstanceId`) REFERENCES `ServiceChargeInstance`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `PropertyEvent`
  ADD CONSTRAINT `PropertyEvent_propertyId_fkey`
  FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PropertyEvent_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ServiceChargeSchedule`
  ADD CONSTRAINT `ServiceChargeSchedule_propertyId_fkey`
  FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ServiceChargeInstance`
  ADD CONSTRAINT `ServiceChargeInstance_propertyId_fkey`
  FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `OwnerStayQuota`
  ADD CONSTRAINT `OwnerStayQuota_propertyId_fkey`
  FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `OwnerReservationRequest`
  ADD CONSTRAINT `OwnerReservationRequest_propertyId_fkey`
  FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `OwnerReservationRequest_ownerId_fkey`
  FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `OwnerReservationRequest_decidedById_fkey`
  FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ActivityEvent`
  ADD CONSTRAINT `ActivityEvent_ownerId_fkey`
  FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `UserPreference`
  ADD CONSTRAINT `UserPreference_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `WebPushSubscription`
  ADD CONSTRAINT `WebPushSubscription_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
