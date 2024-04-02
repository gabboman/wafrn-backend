-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `blocks` (
	`remoteBlockId` text DEFAULT 'NULL',
	`reason` text DEFAULT 'NULL',
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`blockedId` char(36) NOT NULL,
	`blockerId` char(36) NOT NULL,
	CONSTRAINT `blocks_blocked_id_blocker_id` UNIQUE(`blockedId`,`blockerId`)
);
--> statement-breakpoint
CREATE TABLE `emojiCollections` (
	`id` char(36) NOT NULL,
	`name` varchar(255) DEFAULT 'NULL',
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL
);
--> statement-breakpoint
CREATE TABLE `emojiReactions` (
	`id` char(36) NOT NULL,
	`remoteId` text DEFAULT 'NULL',
	`content` text DEFAULT 'NULL',
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`postId` char(36) DEFAULT 'NULL',
	`userId` char(36) DEFAULT 'NULL',
	`emojiId` varchar(255) DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `emojis` (
	`id` varchar(255) NOT NULL,
	`name` varchar(255) DEFAULT 'NULL',
	`url` text DEFAULT 'NULL',
	`external` tinyint DEFAULT 'NULL',
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`emojiCollectionId` char(36) DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `federatedHosts` (
	`id` char(36) NOT NULL,
	`displayName` varchar(255) DEFAULT 'NULL',
	`publicInbox` text DEFAULT 'NULL',
	`publicKey` text DEFAULT 'NULL',
	`detail` varchar(255) DEFAULT 'NULL',
	`blocked` tinyint NOT NULL DEFAULT 0,
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`friendServer` tinyint NOT NULL DEFAULT 0,
	CONSTRAINT `federated_hosts_display_name` UNIQUE(`displayName`)
);
--> statement-breakpoint
CREATE TABLE `follows` (
	`remoteFollowId` text DEFAULT 'NULL',
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`followerId` char(36) NOT NULL,
	`followedId` char(36) NOT NULL,
	`accepted` tinyint DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `medias` (
	`id` char(36) NOT NULL,
	`NSFW` tinyint DEFAULT 'NULL',
	`description` text DEFAULT 'NULL',
	`url` text DEFAULT 'NULL',
	`ipUpload` varchar(255) DEFAULT 'NULL',
	`adultContent` tinyint DEFAULT 'NULL',
	`external` tinyint NOT NULL DEFAULT 0,
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`userId` char(36) DEFAULT 'NULL',
	`order` int(32) NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `mutes` (
	`reason` text DEFAULT 'NULL',
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`mutedId` char(36) NOT NULL,
	`muterId` char(36) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `postEmojiRelations` (
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`postId` char(36) NOT NULL,
	`emojiId` varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `postMediaRelations` (
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`mediaId` char(36) NOT NULL,
	`postId` char(36) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `postMentionsUserRelations` (
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`userId` char(36) DEFAULT 'NULL',
	`postId` char(36) DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `postReports` (
	`id` int(11) AUTO_INCREMENT NOT NULL,
	`resolved` tinyint DEFAULT 'NULL',
	`severity` int(11) DEFAULT 'NULL',
	`description` text DEFAULT 'NULL',
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`userId` char(36) DEFAULT 'NULL',
	`postId` char(36) DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` char(36) NOT NULL,
	`content_warning` varchar(255) DEFAULT 'NULL',
	`content` text DEFAULT 'NULL',
	`remotePostId` text DEFAULT 'NULL',
	`privacy` int(11) DEFAULT 'NULL',
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`userId` char(36) DEFAULT 'NULL',
	`hierarchyLevel` int(10) unsigned DEFAULT 'NULL',
	`parentId` char(36) DEFAULT 'NULL',
	`featured` tinyint DEFAULT 0,
	CONSTRAINT `posts_id` UNIQUE(`id`)
);
--> statement-breakpoint
CREATE TABLE `postsancestors` (
	`postsId` char(36) NOT NULL,
	`ancestorId` char(36) NOT NULL,
	CONSTRAINT `postsancestors_postsId_ancestorId_unique` UNIQUE(`postsId`,`ancestorId`)
);
--> statement-breakpoint
CREATE TABLE `postTags` (
	`id` int(11) AUTO_INCREMENT NOT NULL,
	`tagName` text DEFAULT 'NULL',
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`postId` char(36) DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `questionPollAnswers` (
	`id` int(11) AUTO_INCREMENT NOT NULL,
	`remoteId` text DEFAULT 'NULL',
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`questionPollQuestionId` int(11) DEFAULT 'NULL',
	`userId` char(36) DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `questionPollQuestions` (
	`id` int(11) AUTO_INCREMENT NOT NULL,
	`questionText` text DEFAULT 'NULL',
	`index` int(11) DEFAULT 'NULL',
	`remoteReplies` int(11) DEFAULT 'NULL',
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`questionPollId` int(11) DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `questionPolls` (
	`id` int(11) AUTO_INCREMENT NOT NULL,
	`endDate` datetime DEFAULT 'NULL',
	`multiChoice` tinyint DEFAULT 'NULL',
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`postId` char(36) DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `serverBlocks` (
	`id` int(11) AUTO_INCREMENT NOT NULL,
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`blockedServerId` char(36) DEFAULT 'NULL',
	`userBlockerId` char(36) DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `silencedPosts` (
	`id` int(11) AUTO_INCREMENT NOT NULL,
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`userId` char(36) DEFAULT 'NULL',
	`postId` char(36) DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `userEmojiRelations` (
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`userId` char(36) NOT NULL,
	`emojiId` varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `userLikesPostRelations` (
	`userId` char(36) NOT NULL,
	`postId` char(36) NOT NULL,
	`remoteId` text DEFAULT 'NULL',
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	CONSTRAINT `user_likes_post_relations_remote_id` UNIQUE(`remoteId`)
);
--> statement-breakpoint
CREATE TABLE `userOptions` (
	`userId` char(36) NOT NULL,
	`optionName` varchar(255) NOT NULL,
	`optionValue` text DEFAULT 'NULL',
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	CONSTRAINT `user_options_user_id_option_name` UNIQUE(`userId`,`optionName`)
);
--> statement-breakpoint
CREATE TABLE `userReports` (
	`id` int(11) NOT NULL,
	`resolved` tinyint DEFAULT 'NULL',
	`severity` int(11) DEFAULT 'NULL',
	`description` text DEFAULT 'NULL',
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`ReporterId` char(36) DEFAULT 'NULL',
	`ReportedId` char(36) DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`email` varchar(255) DEFAULT 'NULL',
	`description` text DEFAULT 'NULL',
	`url` varchar(255) DEFAULT 'NULL',
	`NSFW` tinyint DEFAULT 'NULL',
	`avatar` varchar(255) DEFAULT 'NULL',
	`password` varchar(255) DEFAULT 'NULL',
	`birthDate` datetime DEFAULT 'NULL',
	`activated` tinyint DEFAULT 'NULL',
	`requestedPasswordReset` datetime DEFAULT 'NULL',
	`activationCode` varchar(255) DEFAULT 'NULL',
	`registerIp` varchar(255) DEFAULT 'NULL',
	`lastLoginIp` varchar(255) DEFAULT 'NULL',
	`lastTimeNotificationsCheck` datetime NOT NULL DEFAULT ''0000-00-00 00:00:00'',
	`privateKey` text DEFAULT 'NULL',
	`publicKey` text DEFAULT 'NULL',
	`federatedHostId` char(36) DEFAULT 'NULL',
	`remoteInbox` text DEFAULT 'NULL',
	`remoteId` text DEFAULT 'NULL',
	`banned` tinyint DEFAULT 0,
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	`role` int(11) NOT NULL DEFAULT 0,
	`manuallyAcceptsFollows` tinyint DEFAULT 0,
	`name` text DEFAULT 'NULL',
	`headerImage` text DEFAULT 'NULL',
	CONSTRAINT `users_remote_id` UNIQUE(`remoteId`),
	CONSTRAINT `users_url` UNIQUE(`url`),
	CONSTRAINT `users_email` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `blocks_blocker_id` ON `blocks` (`blockerId`);--> statement-breakpoint
CREATE INDEX `blocks_blocked_id` ON `blocks` (`blockedId`);--> statement-breakpoint
CREATE INDEX `postId` ON `emojiReactions` (`postId`);--> statement-breakpoint
CREATE INDEX `userId` ON `emojiReactions` (`userId`);--> statement-breakpoint
CREATE INDEX `emojiId` ON `emojiReactions` (`emojiId`);--> statement-breakpoint
CREATE INDEX `emojiCollectionId` ON `emojis` (`emojiCollectionId`);--> statement-breakpoint
CREATE INDEX `follows_followed_id_follower_id` ON `follows` (`followedId`,`followerId`);--> statement-breakpoint
CREATE INDEX `follows_follower_id` ON `follows` (`followerId`);--> statement-breakpoint
CREATE INDEX `follows_followed_id` ON `follows` (`followedId`);--> statement-breakpoint
CREATE INDEX `userId` ON `medias` (`userId`);--> statement-breakpoint
CREATE INDEX `muterId` ON `mutes` (`muterId`);--> statement-breakpoint
CREATE INDEX `emojiId` ON `postEmojiRelations` (`emojiId`);--> statement-breakpoint
CREATE INDEX `postId` ON `postMediaRelations` (`postId`);--> statement-breakpoint
CREATE INDEX `userId` ON `postMentionsUserRelations` (`userId`);--> statement-breakpoint
CREATE INDEX `postId` ON `postMentionsUserRelations` (`postId`);--> statement-breakpoint
CREATE INDEX `post_mentions_user_relations_post_id` ON `postMentionsUserRelations` (`postId`);--> statement-breakpoint
CREATE INDEX `post_mentions_user_relations_user_id` ON `postMentionsUserRelations` (`userId`);--> statement-breakpoint
CREATE INDEX `userId` ON `postReports` (`userId`);--> statement-breakpoint
CREATE INDEX `postId` ON `postReports` (`postId`);--> statement-breakpoint
CREATE INDEX `userId` ON `posts` (`userId`);--> statement-breakpoint
CREATE INDEX `parentId` ON `posts` (`parentId`);--> statement-breakpoint
CREATE INDEX `posts_remote_post_id` ON `posts` (`remotePostId`);--> statement-breakpoint
CREATE INDEX `posts_parent_id` ON `posts` (`parentId`);--> statement-breakpoint
CREATE INDEX `posts_user_id` ON `posts` (`userId`);--> statement-breakpoint
CREATE INDEX `posts_created_at` ON `posts` (`createdAt`);--> statement-breakpoint
CREATE INDEX `posts_created_at_user_id` ON `posts` (`createdAt`,`userId`);--> statement-breakpoint
CREATE INDEX `createdAtIndex` ON `posts` (`createdAt`);--> statement-breakpoint
CREATE INDEX `useridandcreationdate` ON `posts` (`createdAt`,`userId`);--> statement-breakpoint
CREATE INDEX `ancestorId` ON `postsancestors` (`ancestorId`);--> statement-breakpoint
CREATE INDEX `postId` ON `postTags` (`postId`);--> statement-breakpoint
CREATE INDEX `post_tags_tag_name_post_id` ON `postTags` (`tagName`,`postId`);--> statement-breakpoint
CREATE INDEX `questionPollQuestionId` ON `questionPollAnswers` (`questionPollQuestionId`);--> statement-breakpoint
CREATE INDEX `userId` ON `questionPollAnswers` (`userId`);--> statement-breakpoint
CREATE INDEX `questionPollId` ON `questionPollQuestions` (`questionPollId`);--> statement-breakpoint
CREATE INDEX `postId` ON `questionPolls` (`postId`);--> statement-breakpoint
CREATE INDEX `blockedServerId` ON `serverBlocks` (`blockedServerId`);--> statement-breakpoint
CREATE INDEX `userBlockerId` ON `serverBlocks` (`userBlockerId`);--> statement-breakpoint
CREATE INDEX `userId` ON `silencedPosts` (`userId`);--> statement-breakpoint
CREATE INDEX `postId` ON `silencedPosts` (`postId`);--> statement-breakpoint
CREATE INDEX `emojiId` ON `userEmojiRelations` (`emojiId`);--> statement-breakpoint
CREATE INDEX `postId` ON `userLikesPostRelations` (`postId`);--> statement-breakpoint
CREATE INDEX `user_likes_post_relations_post_id` ON `userLikesPostRelations` (`postId`);--> statement-breakpoint
CREATE INDEX `ReporterId` ON `userReports` (`ReporterId`);--> statement-breakpoint
CREATE INDEX `ReportedId` ON `userReports` (`ReportedId`);--> statement-breakpoint
CREATE INDEX `federatedHostId` ON `users` (`federatedHostId`);--> statement-breakpoint
CREATE INDEX `users_remote_inbox` ON `users` (`remoteInbox`);--> statement-breakpoint
ALTER TABLE `blocks` ADD CONSTRAINT `blocks_ibfk_1` FOREIGN KEY (`blockedId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `blocks` ADD CONSTRAINT `blocks_ibfk_2` FOREIGN KEY (`blockerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `emojiReactions` ADD CONSTRAINT `emojiReactions_ibfk_1` FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `emojiReactions` ADD CONSTRAINT `emojiReactions_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `emojiReactions` ADD CONSTRAINT `emojiReactions_ibfk_3` FOREIGN KEY (`emojiId`) REFERENCES `emojis`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `emojis` ADD CONSTRAINT `emojis_ibfk_1` FOREIGN KEY (`emojiCollectionId`) REFERENCES `emojiCollections`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `follows` ADD CONSTRAINT `follows_ibfk_1` FOREIGN KEY (`followerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `follows` ADD CONSTRAINT `follows_ibfk_2` FOREIGN KEY (`followedId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `medias` ADD CONSTRAINT `medias_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `mutes` ADD CONSTRAINT `mutes_ibfk_1` FOREIGN KEY (`mutedId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `mutes` ADD CONSTRAINT `mutes_ibfk_2` FOREIGN KEY (`muterId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `postEmojiRelations` ADD CONSTRAINT `postEmojiRelations_ibfk_1` FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `postEmojiRelations` ADD CONSTRAINT `postEmojiRelations_ibfk_2` FOREIGN KEY (`emojiId`) REFERENCES `emojis`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `postMediaRelations` ADD CONSTRAINT `postMediaRelations_ibfk_1` FOREIGN KEY (`mediaId`) REFERENCES `medias`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `postMediaRelations` ADD CONSTRAINT `postMediaRelations_ibfk_2` FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `postMentionsUserRelations` ADD CONSTRAINT `postMentionsUserRelations_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `postMentionsUserRelations` ADD CONSTRAINT `postMentionsUserRelations_ibfk_2` FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `postReports` ADD CONSTRAINT `postReports_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `postReports` ADD CONSTRAINT `postReports_ibfk_2` FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_ibfk_2` FOREIGN KEY (`parentId`) REFERENCES `posts`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `postsancestors` ADD CONSTRAINT `postsancestors_ibfk_1` FOREIGN KEY (`postsId`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `postsancestors` ADD CONSTRAINT `postsancestors_ibfk_2` FOREIGN KEY (`ancestorId`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `postTags` ADD CONSTRAINT `postTags_ibfk_1` FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `questionPollAnswers` ADD CONSTRAINT `questionPollAnswers_ibfk_1` FOREIGN KEY (`questionPollQuestionId`) REFERENCES `questionPollQuestions`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `questionPollAnswers` ADD CONSTRAINT `questionPollAnswers_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `questionPollQuestions` ADD CONSTRAINT `questionPollQuestions_ibfk_1` FOREIGN KEY (`questionPollId`) REFERENCES `questionPolls`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `questionPolls` ADD CONSTRAINT `questionPolls_ibfk_1` FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `serverBlocks` ADD CONSTRAINT `serverBlocks_ibfk_1` FOREIGN KEY (`blockedServerId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `serverBlocks` ADD CONSTRAINT `serverBlocks_ibfk_2` FOREIGN KEY (`userBlockerId`) REFERENCES `federatedHosts`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `silencedPosts` ADD CONSTRAINT `silencedPosts_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `silencedPosts` ADD CONSTRAINT `silencedPosts_ibfk_2` FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `userEmojiRelations` ADD CONSTRAINT `userEmojiRelations_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `userEmojiRelations` ADD CONSTRAINT `userEmojiRelations_ibfk_2` FOREIGN KEY (`emojiId`) REFERENCES `emojis`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `userLikesPostRelations` ADD CONSTRAINT `userLikesPostRelations_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `userLikesPostRelations` ADD CONSTRAINT `userLikesPostRelations_ibfk_2` FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `userOptions` ADD CONSTRAINT `userOptions_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `userReports` ADD CONSTRAINT `userReports_ibfk_1` FOREIGN KEY (`ReporterId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `userReports` ADD CONSTRAINT `userReports_ibfk_2` FOREIGN KEY (`ReportedId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`federatedHostId`) REFERENCES `federatedHosts`(`id`) ON DELETE set null ON UPDATE cascade;
*/