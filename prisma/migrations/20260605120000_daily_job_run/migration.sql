-- Idempotency log for cron + on-demand admin-login daily jobs.
-- (jobKey, runDate) is unique so concurrent triggers race to claim
-- the slot and only one wins.
CREATE TABLE `DailyJobRun` (
  `id`         VARCHAR(191) NOT NULL,
  `jobKey`     VARCHAR(60)  NOT NULL,
  `runDate`    VARCHAR(10)  NOT NULL,
  `trigger`    VARCHAR(20)  NOT NULL,
  `startedAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finishedAt` DATETIME(3)  NULL,
  `result`     JSON         NULL,
  `error`      TEXT         NULL,
  UNIQUE INDEX `DailyJobRun_jobKey_runDate_key`(`jobKey`, `runDate`),
  INDEX `DailyJobRun_runDate_idx`(`runDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
