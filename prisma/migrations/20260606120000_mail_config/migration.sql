-- Single-row SMTP config table. `key` is unique so the upsert in the
-- settings action enforces a singleton.
CREATE TABLE `MailConfig` (
  `id`          VARCHAR(191) NOT NULL,
  `key`         VARCHAR(40)  NOT NULL,
  `host`        VARCHAR(255) NOT NULL,
  `port`        INT          NOT NULL DEFAULT 587,
  `secure`      BOOLEAN      NOT NULL DEFAULT false,
  `username`    VARCHAR(255) NULL,
  `password`    VARCHAR(255) NULL,
  `fromEmail`   VARCHAR(255) NOT NULL,
  `fromName`    VARCHAR(120) NULL,
  `replyTo`     VARCHAR(255) NULL,
  `enabled`     BOOLEAN      NOT NULL DEFAULT true,
  `lastTestAt`  DATETIME(3)  NULL,
  `lastTestOk`  BOOLEAN      NULL,
  `lastTestErr` TEXT         NULL,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL,

  UNIQUE INDEX `MailConfig_key_key`(`key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
