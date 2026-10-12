import {
  bigint,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const subscriptions = mysqlTable("subscriptions", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  planKey: varchar("planKey", { length: 32 }).notNull().default("free"),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  provider: varchar("provider", { length: 48 }),
  providerSubscriptionId: varchar("providerSubscriptionId", { length: 255 }),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endsAt: timestamp("endsAt"),
  canceledAt: timestamp("canceledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull().default("محادثة جديدة"),
  model: varchar("model", { length: 160 }),
  providerKeyId: bigint("providerKeyId", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const providerKeys = mysqlTable("provider_keys", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  kind: mysqlEnum("kind", ["chat", "image", "both"]).notNull().default("both"),
  provider: varchar("provider", { length: 64 }).notNull(),
  baseUrl: varchar("baseUrl", { length: 512 }).notNull(),
  encryptedApiKey: text("encryptedApiKey").notNull(),
  modelPrefix: varchar("modelPrefix", { length: 80 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const modelSources = mysqlTable("model_sources", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  source: varchar("source", { length: 32 }).notNull(),
  reference: varchar("reference", { length: 240 }).notNull(),
  url: varchar("url", { length: 512 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["added", "syncing", "synced", "installing", "installed", "failed"]).notNull().default("added"),
  metadataJson: text("metadataJson"),
  installMode: varchar("installMode", { length: 32 }),
  lastSyncedAt: timestamp("lastSyncedAt"),
  installedAt: timestamp("installedAt"),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userSourceReferenceUnique: uniqueIndex("model_sources_user_ref_unique").on(table.userId, table.source, table.reference) }));

export const modelLibrary = mysqlTable("model_library", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  source: varchar("source", { length: 32 }).notNull(),
  modelId: varchar("modelId", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  url: varchar("url", { length: 512 }).notNull(),
  description: text("description"),
  task: varchar("task", { length: 96 }),
  license: varchar("license", { length: 120 }),
  downloads: bigint("downloads", { mode: "number" }),
  likes: int("likes"),
  sourceId: bigint("sourceId", { mode: "number" }),
  status: mysqlEnum("status", ["saved", "downloading", "downloaded", "installed", "failed"]).notNull().default("saved"),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userSourceModelUnique: uniqueIndex("model_library_user_source_model_unique").on(table.userId, table.source, table.modelId) }));

export const messages = mysqlTable("messages", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["system", "user", "assistant", "tool"]).notNull(),
  content: text("content").notNull(),
  model: varchar("model", { length: 160 }),
  promptTokens: int("promptTokens"),
  completionTokens: int("completionTokens"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const usageEvents = mysqlTable("usage_events", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  model: varchar("model", { length: 160 }),
  provider: varchar("provider", { length: 64 }),
  promptTokens: int("promptTokens"),
  completionTokens: int("completionTokens"),
  requestKind: varchar("requestKind", { length: 32 }).notNull().default("chat"),
  outcome: varchar("outcome", { length: 24 }).notNull().default("success"),
  errorCode: varchar("errorCode", { length: 64 }),
  estimatedCostUsd: varchar("estimatedCostUsd", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const attachments = mysqlTable("attachments", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  conversationId: int("conversationId"),
  messageId: bigint("messageId", { mode: "number" }),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 160 }),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  sizeBytes: bigint("sizeBytes", { mode: "number" }),
  status: mysqlEnum("status", ["uploaded", "processing", "ready", "failed"]).default("uploaded").notNull(),
  extractedText: text("extractedText"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
