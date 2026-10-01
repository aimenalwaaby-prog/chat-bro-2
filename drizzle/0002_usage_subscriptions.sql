CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `planKey` varchar(32) NOT NULL DEFAULT 'free',
  `status` varchar(32) NOT NULL DEFAULT 'active',
  `provider` varchar(48),
  `providerSubscriptionId` varchar(255),
  `startedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `endsAt` timestamp NULL,
  `canceledAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `subscriptions_user_idx` (`userId`),
  INDEX `subscriptions_provider_idx` (`providerSubscriptionId`)
);

ALTER TABLE `usage_events` ADD COLUMN `provider` varchar(64) NULL AFTER `model`;
ALTER TABLE `usage_events` ADD COLUMN `outcome` varchar(24) NOT NULL DEFAULT 'success' AFTER `requestKind`;
ALTER TABLE `usage_events` ADD COLUMN `errorCode` varchar(64) NULL AFTER `outcome`;
ALTER TABLE `usage_events` ADD COLUMN `estimatedCostUsd` varchar(32) NULL AFTER `errorCode`;
CREATE INDEX `usage_provider_created_idx` ON `usage_events` (`provider`, `createdAt`);
