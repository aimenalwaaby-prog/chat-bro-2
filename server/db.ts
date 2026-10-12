import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, modelLibrary, modelSources, providerKeys, subscriptions, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let modelLibrarySchemaReady: Promise<void> | null = null;
let modelSourcesSchemaReady: Promise<void> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function getModelSourcesDb() {
  const db = await getDb();
  if (!db) return undefined;
  if (!modelSourcesSchemaReady) {
    modelSourcesSchemaReady = db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS model_sources (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      source VARCHAR(32) NOT NULL,
      reference VARCHAR(240) NOT NULL,
      url VARCHAR(512) NOT NULL,
      label VARCHAR(255) NOT NULL,
      status ENUM('added','syncing','synced','installing','installed','failed') NOT NULL DEFAULT 'added',
      metadataJson TEXT NULL,
      installMode VARCHAR(32) NULL,
      lastSyncedAt TIMESTAMP NULL,
      installedAt TIMESTAMP NULL,
      lastError TEXT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY model_sources_user_ref_unique (userId, source, reference),
      KEY model_sources_user_idx (userId),
      KEY model_sources_status_idx (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)).then(() => undefined).catch((error) => {
      modelSourcesSchemaReady = null;
      throw error;
    });
  }
  await modelSourcesSchemaReady;
  return db;
}

async function getModelLibraryDb() {
  const db = await getDb();
  if (!db) return undefined;
  if (!modelLibrarySchemaReady) {
    modelLibrarySchemaReady = db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS model_library (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      source VARCHAR(32) NOT NULL,
      modelId VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      url VARCHAR(512) NOT NULL,
      description TEXT NULL,
      task VARCHAR(96) NULL,
      license VARCHAR(120) NULL,
      downloads BIGINT NULL,
      likes INT NULL,
      sourceId BIGINT NULL,
      status ENUM('saved','downloading','downloaded','installed','failed') NOT NULL DEFAULT 'saved',
      metadataJson TEXT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY model_library_user_source_model_unique (userId, source, modelId),
      KEY model_library_user_updated (userId, updatedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)).then(() => undefined).catch((error) => {
      modelLibrarySchemaReady = null;
      throw error;
    });
  }
  await modelLibrarySchemaReady;
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.

export async function createConversation(userId: number, title = "محادثة جديدة", model?: string) {
  const db = await getDb();
  if (!db) return undefined;
  const { conversations } = await import("../drizzle/schema");
  const result = await db.insert(conversations).values({ userId, title, model: model ?? null });
  const id = Number(result[0].insertId);
  const rows = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return rows[0];
}

export async function listUserProviderKeys(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: providerKeys.id,
    userId: providerKeys.userId,
    name: providerKeys.name,
    kind: providerKeys.kind,
    provider: providerKeys.provider,
    baseUrl: providerKeys.baseUrl,
    modelPrefix: providerKeys.modelPrefix,
    createdAt: providerKeys.createdAt,
    updatedAt: providerKeys.updatedAt,
  }).from(providerKeys).where(eq(providerKeys.userId, userId)).orderBy(desc(providerKeys.updatedAt));
}

export async function createUserProviderKey(input: {
  userId: number;
  name: string;
  kind: "chat" | "image" | "both";
  provider: string;
  baseUrl: string;
  encryptedApiKey: string;
  modelPrefix?: string | null;
}) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(providerKeys).values(input);
  const id = Number(result[0].insertId);
  const rows = await listUserProviderKeys(input.userId);
  return rows.find((row) => row.id === id);
}

export async function getUserProviderKey(userId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(providerKeys).where(and(eq(providerKeys.userId, userId), eq(providerKeys.id, id))).limit(1);
  return rows[0];
}

export async function deleteUserProviderKey(userId: number, id: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.delete(providerKeys).where(and(eq(providerKeys.userId, userId), eq(providerKeys.id, id)));
  return Number(result[0].affectedRows ?? 0) > 0;
}

export async function recordUsage(input: {
  userId: number;
  model?: string | null;
  provider?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  requestKind?: string;
  outcome?: string;
  errorCode?: string | null;
  estimatedCostUsd?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  const { usageEvents } = await import("../drizzle/schema");
  await db.insert(usageEvents).values({
    userId: input.userId,
    model: input.model ?? null,
    provider: input.provider ?? null,
    promptTokens: input.promptTokens ?? null,
    completionTokens: input.completionTokens ?? null,
    requestKind: input.requestKind ?? "chat",
    outcome: input.outcome ?? "success",
    errorCode: input.errorCode ?? null,
    estimatedCostUsd: input.estimatedCostUsd ?? null,
  });
}

export async function getUserSubscription(userId: number) {
  const db = await getDb();
  if (!db) return { planKey: "free", status: "active" } as const;
  const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.updatedAt)).limit(1);
  return rows[0] ?? { planKey: "free", status: "active" } as const;
}

export async function ensureFreeSubscription(userId: number) {
  const db = await getDb();
  if (!db) return;
  const existing = await getUserSubscription(userId);
  if ("id" in existing) return;
  await db.insert(subscriptions).values({ userId, planKey: "free", status: "active" });
}

export async function saveMessage(input: { conversationId: number; role: "system" | "user" | "assistant" | "tool"; content: string; model?: string | null }) {
  const db = await getDb();
  if (!db) return undefined;
  const { messages } = await import("../drizzle/schema");
  const result = await db.insert(messages).values({ ...input, model: input.model ?? null });
  return Number(result[0].insertId);
}

export async function listUserConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const { conversations } = await import("../drizzle/schema");
  return db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.updatedAt));
}

export async function getUserConversation(userId: number, conversationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const { conversations } = await import("../drizzle/schema");
  const rows = await db.select().from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId))).limit(1);
  return rows[0];
}

export async function listConversationMessages(userId: number, conversationId: number) {
  const conversation = await getUserConversation(userId, conversationId);
  if (!conversation) return [];
  const db = await getDb();
  if (!db) return [];
  const { messages } = await import("../drizzle/schema");
  return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
}

export async function createAttachment(input: { userId: number; conversationId?: number; fileName: string; mimeType: string; storageKey: string; sizeBytes: number; status?: "uploaded" | "processing" | "ready" | "failed"; extractedText?: string | null }) {
  const db = await getDb();
  if (!db) return undefined;
  const { attachments } = await import("../drizzle/schema");
  const result = await db.insert(attachments).values({ ...input, conversationId: input.conversationId ?? null, status: input.status ?? "ready", extractedText: input.extractedText ?? null });
  return Number(result[0].insertId);
}

export async function listUserModelSources(userId: number) {
  const db = await getModelSourcesDb();
  if (!db) throw new Error("DATABASE_URL غير مهيأ على خادم Chat Bro؛ لا يمكن تحميل مستودعاتك.");
  return db.select().from(modelSources).where(eq(modelSources.userId, userId)).orderBy(desc(modelSources.updatedAt));
}

export async function addModelSource(input: { userId: number; source: string; reference: string; url: string; label: string; installMode?: string | null }) {
  const db = await getModelSourcesDb();
  if (!db) throw new Error("DATABASE_URL غير مهيأ على خادم Chat Bro؛ لم يُحفظ المستودع.");
  await db.insert(modelSources).values(input).onDuplicateKeyUpdate({ set: { url: input.url, label: input.label, installMode: input.installMode ?? null, updatedAt: new Date() } });
  const rows = await db.select().from(modelSources).where(and(eq(modelSources.userId, input.userId), eq(modelSources.source, input.source), eq(modelSources.reference, input.reference))).limit(1);
  return rows[0];
}

export async function getUserModelSource(userId: number, id: number) {
  const db = await getModelSourcesDb();
  if (!db) throw new Error("DATABASE_URL غير مهيأ على خادم Chat Bro؛ لا يمكن فتح المستودع.");
  const rows = await db.select().from(modelSources).where(and(eq(modelSources.userId, userId), eq(modelSources.id, id))).limit(1);
  return rows[0];
}

export async function updateModelSource(id: number, userId: number, patch: Partial<{ status: "added" | "syncing" | "synced" | "installing" | "installed" | "failed"; metadataJson: string | null; lastSyncedAt: Date | null; installedAt: Date | null; lastError: string | null; installMode: string | null }>) {
  const db = await getModelSourcesDb();
  if (!db) throw new Error("DATABASE_URL غير مهيأ على خادم Chat Bro؛ لم يُحدّث المستودع.");
  await db.update(modelSources).set({ ...patch, updatedAt: new Date() }).where(and(eq(modelSources.id, id), eq(modelSources.userId, userId)));
  return getUserModelSource(userId, id);
}

export async function deleteModelSource(userId: number, id: number) {
  const db = await getModelSourcesDb();
  if (!db) throw new Error("DATABASE_URL غير مهيأ على خادم Chat Bro؛ لم يُحذف المستودع.");
  const result = await db.delete(modelSources).where(and(eq(modelSources.userId, userId), eq(modelSources.id, id)));
  return Number(result[0].affectedRows ?? 0) > 0;
}

export async function listUserModelLibrary(userId: number) {
  const db = await getModelLibraryDb();
  if (!db) throw new Error("DATABASE_URL غير مهيأ على خادم Chat Bro؛ لا يمكن تحميل مكتبة النماذج.");
  return db.select().from(modelLibrary).where(eq(modelLibrary.userId, userId)).orderBy(desc(modelLibrary.updatedAt));
}

export async function saveUserModelToLibrary(input: {
  userId: number;
  source: string;
  modelId: string;
  name: string;
  url: string;
  description?: string | null;
  task?: string | null;
  license?: string | null;
  downloads?: number | null;
  likes?: number | null;
  sourceId?: number | null;
  metadataJson?: string | null;
}) {
  const db = await getModelLibraryDb();
  if (!db) throw new Error("DATABASE_URL غير مهيأ على خادم Chat Bro؛ لم يُحفظ النموذج.");
  await db.insert(modelLibrary).values({ ...input, description: input.description ?? null, task: input.task ?? null, license: input.license ?? null, downloads: input.downloads ?? null, likes: input.likes ?? null, sourceId: input.sourceId ?? null, metadataJson: input.metadataJson ?? null })
    .onDuplicateKeyUpdate({ set: { name: input.name, url: input.url, description: input.description ?? null, task: input.task ?? null, license: input.license ?? null, downloads: input.downloads ?? null, likes: input.likes ?? null, sourceId: input.sourceId ?? null, metadataJson: input.metadataJson ?? null, updatedAt: new Date() } });
  const rows = await db.select().from(modelLibrary).where(and(eq(modelLibrary.userId, input.userId), eq(modelLibrary.source, input.source), eq(modelLibrary.modelId, input.modelId))).limit(1);
  return rows[0];
}

export async function deleteUserModelFromLibrary(userId: number, id: number) {
  const db = await getModelLibraryDb();
  if (!db) throw new Error("DATABASE_URL غير مهيأ على خادم Chat Bro؛ لم يُحذف النموذج.");
  const result = await db.delete(modelLibrary).where(and(eq(modelLibrary.userId, userId), eq(modelLibrary.id, id)));
  return Number(result[0].affectedRows ?? 0) > 0;
}
