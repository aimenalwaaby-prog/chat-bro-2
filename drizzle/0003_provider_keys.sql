ALTER TABLE `conversations` ADD COLUMN `providerKeyId` bigint NULL;
CREATE INDEX `conversations_provider_key_idx` ON `conversations` (`providerKeyId`);

CREATE TABLE IF NOT EXISTS `provider_keys` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `name` varchar(120) NOT NULL,
  `kind` enum('chat','image','both') NOT NULL DEFAULT 'both',
  `provider` varchar(64) NOT NULL,
  `baseUrl` varchar(512) NOT NULL,
  `encryptedApiKey` text NOT NULL,
  `modelPrefix` varchar(80),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `provider_keys_user_idx` (`userId`),
  INDEX `provider_keys_kind_idx` (`kind`)
);
