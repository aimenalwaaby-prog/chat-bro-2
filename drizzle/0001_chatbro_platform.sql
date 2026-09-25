CREATE TABLE IF NOT EXISTS `conversations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `title` varchar(255) NOT NULL DEFAULT 'محادثة جديدة',
  `model` varchar(160),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `conversations_user_idx` (`userId`)
);

CREATE TABLE IF NOT EXISTS `messages` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `conversationId` int NOT NULL,
  `role` enum('system','user','assistant','tool') NOT NULL,
  `content` text NOT NULL,
  `model` varchar(160),
  `promptTokens` int,
  `completionTokens` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `messages_conversation_idx` (`conversationId`)
);

CREATE TABLE IF NOT EXISTS `usage_events` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `model` varchar(160),
  `promptTokens` int,
  `completionTokens` int,
  `requestKind` varchar(32) NOT NULL DEFAULT 'chat',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `usage_user_created_idx` (`userId`, `createdAt`)
);

CREATE TABLE IF NOT EXISTS `attachments` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `messageId` bigint,
  `fileName` varchar(255) NOT NULL,
  `mimeType` varchar(160),
  `storageKey` varchar(512) NOT NULL,
  `sizeBytes` bigint,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `attachments_user_idx` (`userId`)
);
