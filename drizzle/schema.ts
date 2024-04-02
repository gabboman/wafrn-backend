import { mysqlTable, mysqlSchema, AnyMySqlColumn, index, foreignKey, unique, text, datetime, char, varchar, tinyint, int } from "drizzle-orm/mysql-core"
import { sql, relations } from "drizzle-orm"

export const blocks = mysqlTable("blocks", {
	remoteBlockId: text("remoteBlockId").default('NULL'),
	reason: text("reason").default('NULL'),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	blockedId: char("blockedId", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	blockerId: char("blockerId", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => {
	return {
		blockerId: index("blocks_blocker_id").on(table.blockerId),
		blockedId: index("blocks_blocked_id").on(table.blockedId),
		blocksBlockedIdBlockerId: unique("blocks_blocked_id_blocker_id").on(table.blockedId, table.blockerId),
	}
});

export const emojiCollections = mysqlTable("emojiCollections", {
	id: char("id", { length: 36 }).notNull(),
	name: varchar("name", { length: 255 }).default('NULL'),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
});

export const emojiReactions = mysqlTable("emojiReactions", {
	id: char("id", { length: 36 }).notNull(),
	remoteId: text("remoteId").default('NULL'),
	content: text("content").default('NULL'),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	postId: char("postId", { length: 36 }).default('NULL').references(() => posts.id, { onDelete: "set null", onUpdate: "cascade" } ),
	userId: char("userId", { length: 36 }).default('NULL').references(() => users.id, { onDelete: "set null", onUpdate: "cascade" } ),
	emojiId: varchar("emojiId", { length: 255 }).default('NULL').references(() => emojis.id, { onDelete: "set null", onUpdate: "cascade" } ),
},
(table) => {
	return {
		postId: index("postId").on(table.postId),
		userId: index("userId").on(table.userId),
		emojiId: index("emojiId").on(table.emojiId),
	}
});

export const emojis = mysqlTable("emojis", {
	id: varchar("id", { length: 255 }).notNull(),
	name: varchar("name", { length: 255 }).default('NULL'),
	url: text("url").default('NULL'),
	external: tinyint("external").default('NULL'),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	emojiCollectionId: char("emojiCollectionId", { length: 36 }).default('NULL').references(() => emojiCollections.id, { onDelete: "set null", onUpdate: "cascade" } ),
},
(table) => {
	return {
		emojiCollectionId: index("emojiCollectionId").on(table.emojiCollectionId),
	}
});

export const federatedHosts = mysqlTable("federatedHosts", {
	id: char("id", { length: 36 }).notNull(),
	displayName: varchar("displayName", { length: 255 }).default('NULL'),
	publicInbox: text("publicInbox").default('NULL'),
	publicKey: text("publicKey").default('NULL'),
	detail: varchar("detail", { length: 255 }).default('NULL'),
	blocked: tinyint("blocked").default(0).notNull(),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	friendServer: tinyint("friendServer").default(0).notNull(),
},
(table) => {
	return {
		federatedHostsDisplayName: unique("federated_hosts_display_name").on(table.displayName),
	}
});

export const follows = mysqlTable("follows", {
	remoteFollowId: text("remoteFollowId").default('NULL'),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	followerId: char("followerId", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	followedId: char("followedId", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	accepted: tinyint("accepted").default(0),
},
(table) => {
	return {
		followedIdFollowerId: index("follows_followed_id_follower_id").on(table.followedId, table.followerId),
		followerId: index("follows_follower_id").on(table.followerId),
		followedId: index("follows_followed_id").on(table.followedId),
	}
});

export const medias = mysqlTable("medias", {
	id: char("id", { length: 36 }).notNull(),
	nsfw: tinyint("NSFW").default('NULL'),
	description: text("description").default('NULL'),
	url: text("url").default('NULL'),
	ipUpload: varchar("ipUpload", { length: 255 }).default('NULL'),
	adultContent: tinyint("adultContent").default('NULL'),
	external: tinyint("external").default(0).notNull(),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	userId: char("userId", { length: 36 }).default('NULL').references(() => users.id, { onDelete: "set null", onUpdate: "cascade" } ),
	order: int("order").default(0).notNull(),
},
(table) => {
	return {
		userId: index("userId").on(table.userId),
	}
});

export const mutes = mysqlTable("mutes", {
	reason: text("reason").default('NULL'),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	mutedId: char("mutedId", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	muterId: char("muterId", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => {
	return {
		muterId: index("muterId").on(table.muterId),
	}
});

export const postEmojiRelations = mysqlTable("postEmojiRelations", {
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	postId: char("postId", { length: 36 }).notNull().references(() => posts.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	emojiId: varchar("emojiId", { length: 255 }).notNull().references(() => emojis.id, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => {
	return {
		emojiId: index("emojiId").on(table.emojiId),
	}
});

export const postMediaRelations = mysqlTable("postMediaRelations", {
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	mediaId: char("mediaId", { length: 36 }).notNull().references(() => medias.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	postId: char("postId", { length: 36 }).notNull().references(() => posts.id, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => {
	return {
		postId: index("postId").on(table.postId),
	}
});

export const postMentionsUserRelations = mysqlTable("postMentionsUserRelations", {
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	userId: char("userId", { length: 36 }).default('NULL').references(() => users.id, { onDelete: "set null", onUpdate: "cascade" } ),
	postId: char("postId", { length: 36 }).default('NULL').references(() => posts.id, { onDelete: "set null", onUpdate: "cascade" } ),
},
(table) => {
	return {
		userId: index("userId").on(table.userId),
		postId: index("postId").on(table.postId),
		postMentionsUserRelationsPostId: index("post_mentions_user_relations_post_id").on(table.postId),
		postMentionsUserRelationsUserId: index("post_mentions_user_relations_user_id").on(table.userId),
	}
});

export const postReports = mysqlTable("postReports", {
	id: int("id").autoincrement().notNull(),
	resolved: tinyint("resolved").default('NULL'),
	severity: int("severity").default('NULL'),
	description: text("description").default('NULL'),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	userId: char("userId", { length: 36 }).default('NULL').references(() => users.id, { onDelete: "set null", onUpdate: "cascade" } ),
	postId: char("postId", { length: 36 }).default('NULL').references(() => posts.id, { onDelete: "set null", onUpdate: "cascade" } ),
},
(table) => {
	return {
		userId: index("userId").on(table.userId),
		postId: index("postId").on(table.postId),
	}
});

export const posts = mysqlTable("posts", {
	id: char("id", { length: 36 }).notNull(),
	contentWarning: varchar("content_warning", { length: 255 }).default('NULL'),
	content: text("content").default('NULL'),
	remotePostId: text("remotePostId").default('NULL'),
	privacy: int("privacy").default('NULL'),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	userId: char("userId", { length: 36 }).default('NULL').references(() => users.id, { onDelete: "set null", onUpdate: "cascade" } ),
	hierarchyLevel: int("hierarchyLevel").default('NULL'),
	parentId: char("parentId", { length: 36 }).default('NULL'),
	featured: tinyint("featured").default(0),
},
(table) => {
	return {
		userId: index("userId").on(table.userId),
		parentId: index("parentId").on(table.parentId),
		remotePostId: index("posts_remote_post_id").on(table.remotePostId),
		parentId: index("posts_parent_id").on(table.parentId),
		userId: index("posts_user_id").on(table.userId),
		createdAt: index("posts_created_at").on(table.createdAt),
		createdAtUserId: index("posts_created_at_user_id").on(table.createdAt, table.userId),
		createdAtIndex: index("createdAtIndex").on(table.createdAt),
		useridandcreationdate: index("useridandcreationdate").on(table.createdAt, table.userId),
		postsIbfk2: foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "posts_ibfk_2"
		}).onUpdate("cascade").onDelete("restrict"),
		postsId: unique("posts_id").on(table.id),
	}
});

export const postsancestors = mysqlTable("postsancestors", {
	postsId: char("postsId", { length: 36 }).notNull().references(() => posts.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	ancestorId: char("ancestorId", { length: 36 }).notNull().references(() => posts.id, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => {
	return {
		ancestorId: index("ancestorId").on(table.ancestorId),
		postsancestorsPostsIdAncestorIdUnique: unique("postsancestors_postsId_ancestorId_unique").on(table.postsId, table.ancestorId),
	}
});

export const postTags = mysqlTable("postTags", {
	id: int("id").autoincrement().notNull(),
	tagName: text("tagName").default('NULL'),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	postId: char("postId", { length: 36 }).default('NULL').references(() => posts.id, { onDelete: "set null", onUpdate: "cascade" } ),
},
(table) => {
	return {
		postId: index("postId").on(table.postId),
		postTagsTagNamePostId: index("post_tags_tag_name_post_id").on(table.tagName, table.postId),
	}
});

export const questionPollAnswers = mysqlTable("questionPollAnswers", {
	id: int("id").autoincrement().notNull(),
	remoteId: text("remoteId").default('NULL'),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	questionPollQuestionId: int("questionPollQuestionId").default('NULL').references(() => questionPollQuestions.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	userId: char("userId", { length: 36 }).default('NULL').references(() => users.id, { onDelete: "set null", onUpdate: "cascade" } ),
},
(table) => {
	return {
		questionPollQuestionId: index("questionPollQuestionId").on(table.questionPollQuestionId),
		userId: index("userId").on(table.userId),
	}
});

export const questionPollQuestions = mysqlTable("questionPollQuestions", {
	id: int("id").autoincrement().notNull(),
	questionText: text("questionText").default('NULL'),
	index: int("index").default('NULL'),
	remoteReplies: int("remoteReplies").default('NULL'),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	questionPollId: int("questionPollId").default('NULL').references(() => questionPolls.id, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => {
	return {
		questionPollId: index("questionPollId").on(table.questionPollId),
	}
});

export const questionPolls = mysqlTable("questionPolls", {
	id: int("id").autoincrement().notNull(),
	endDate: datetime("endDate", { mode: 'string'}).default('NULL'),
	multiChoice: tinyint("multiChoice").default('NULL'),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	postId: char("postId", { length: 36 }).default('NULL').references(() => posts.id, { onDelete: "set null", onUpdate: "cascade" } ),
},
(table) => {
	return {
		postId: index("postId").on(table.postId),
	}
});

export const serverBlocks = mysqlTable("serverBlocks", {
	id: int("id").autoincrement().notNull(),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	blockedServerId: char("blockedServerId", { length: 36 }).default('NULL').references(() => users.id, { onDelete: "set null", onUpdate: "cascade" } ),
	userBlockerId: char("userBlockerId", { length: 36 }).default('NULL').references(() => federatedHosts.id, { onDelete: "set null", onUpdate: "cascade" } ),
},
(table) => {
	return {
		blockedServerId: index("blockedServerId").on(table.blockedServerId),
		userBlockerId: index("userBlockerId").on(table.userBlockerId),
	}
});

export const silencedPosts = mysqlTable("silencedPosts", {
	id: int("id").autoincrement().notNull(),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	userId: char("userId", { length: 36 }).default('NULL').references(() => users.id, { onDelete: "set null", onUpdate: "cascade" } ),
	postId: char("postId", { length: 36 }).default('NULL').references(() => posts.id, { onDelete: "set null", onUpdate: "cascade" } ),
},
(table) => {
	return {
		userId: index("userId").on(table.userId),
		postId: index("postId").on(table.postId),
	}
});

export const userEmojiRelations = mysqlTable("userEmojiRelations", {
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	userId: char("userId", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	emojiId: varchar("emojiId", { length: 255 }).notNull().references(() => emojis.id, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => {
	return {
		emojiId: index("emojiId").on(table.emojiId),
	}
});

export const userLikesPostRelations = mysqlTable("userLikesPostRelations", {
	userId: char("userId", { length: 36 }).notNull().references(() => users.id, { onUpdate: "cascade" } ),
	postId: char("postId", { length: 36 }).notNull().references(() => posts.id, { onUpdate: "cascade" } ),
	remoteId: text("remoteId").default('NULL'),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
},
(table) => {
	return {
		postId: index("postId").on(table.postId),
		userLikesPostRelationsPostId: index("user_likes_post_relations_post_id").on(table.postId),
		userLikesPostRelationsRemoteId: unique("user_likes_post_relations_remote_id").on(table.remoteId),
	}
});

export const userOptions = mysqlTable("userOptions", {
	userId: char("userId", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	optionName: varchar("optionName", { length: 255 }).notNull(),
	optionValue: text("optionValue").default('NULL'),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
},
(table) => {
	return {
		userOptionsUserIdOptionName: unique("user_options_user_id_option_name").on(table.userId, table.optionName),
	}
});

export const userReports = mysqlTable("userReports", {
	id: int("id").notNull(),
	resolved: tinyint("resolved").default('NULL'),
	severity: int("severity").default('NULL'),
	description: text("description").default('NULL'),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	reporterId: char("ReporterId", { length: 36 }).default('NULL').references(() => users.id, { onDelete: "set null", onUpdate: "cascade" } ),
	reportedId: char("ReportedId", { length: 36 }).default('NULL').references(() => users.id, { onDelete: "set null", onUpdate: "cascade" } ),
},
(table) => {
	return {
		reporterId: index("ReporterId").on(table.reporterId),
		reportedId: index("ReportedId").on(table.reportedId),
	}
});

export const users = mysqlTable("users", {
	id: char("id", { length: 36 }).notNull(),
	email: varchar("email", { length: 255 }).default('NULL'),
	description: text("description").default('NULL'),
	url: varchar("url", { length: 255 }).default('NULL'),
	nsfw: tinyint("NSFW").default('NULL'),
	avatar: varchar("avatar", { length: 255 }).default('NULL'),
	password: varchar("password", { length: 255 }).default('NULL'),
	birthDate: datetime("birthDate", { mode: 'string'}).default('NULL'),
	activated: tinyint("activated").default('NULL'),
	requestedPasswordReset: datetime("requestedPasswordReset", { mode: 'string'}).default('NULL'),
	activationCode: varchar("activationCode", { length: 255 }).default('NULL'),
	registerIp: varchar("registerIp", { length: 255 }).default('NULL'),
	lastLoginIp: varchar("lastLoginIp", { length: 255 }).default('NULL'),
	lastTimeNotificationsCheck: datetime("lastTimeNotificationsCheck", { mode: 'string'}).default(''0000-00-00 00:00:00'').notNull(),
	privateKey: text("privateKey").default('NULL'),
	publicKey: text("publicKey").default('NULL'),
	federatedHostId: char("federatedHostId", { length: 36 }).default('NULL').references(() => federatedHosts.id, { onDelete: "set null", onUpdate: "cascade" } ),
	remoteInbox: text("remoteInbox").default('NULL'),
	remoteId: text("remoteId").default('NULL'),
	banned: tinyint("banned").default(0),
	createdAt: datetime("createdAt", { mode: 'string'}).notNull(),
	updatedAt: datetime("updatedAt", { mode: 'string'}).notNull(),
	role: int("role").default(0).notNull(),
	manuallyAcceptsFollows: tinyint("manuallyAcceptsFollows").default(0),
	name: text("name").default('NULL'),
	headerImage: text("headerImage").default('NULL'),
},
(table) => {
	return {
		federatedHostId: index("federatedHostId").on(table.federatedHostId),
		remoteInbox: index("users_remote_inbox").on(table.remoteInbox),
		usersRemoteId: unique("users_remote_id").on(table.remoteId),
		usersUrl: unique("users_url").on(table.url),
		usersEmail: unique("users_email").on(table.email),
	}
});