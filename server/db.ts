import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, modelSources, providerKeys, subscriptions, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

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
  const db = await getDb();
  if (!db) return [];
  return db.select().from(modelSources).where(eq(modelSources.userId, userId)).orderBy(desc(modelSources.updatedAt));
}

export async function addModelSource(input: { userId: number; source: string; reference: string; url: string; label: string; installMode?: string | null }) {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(modelSources).values(input).onDuplicateKeyUpdate({ set: { url: input.url, label: input.label, installMode: input.installMode ?? null, updatedAt: new Date() } });
  const rows = await db.select().from(modelSources).where(and(eq(modelSources.userId, input.userId), eq(modelSources.source, input.source), eq(modelSources.reference, input.reference))).limit(1);
  return rows[0];
}

export async function getUserModelSource(userId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(modelSources).where(and(eq(modelSources.userId, userId), eq(modelSources.id, id))).limit(1);
  return rows[0];
}

export async function updateModelSource(id: number, userId: number, patch: Partial<{ status: "added" | "syncing" | "synced" | "installing" | "installed" | "failed"; metadataJson: string | null; lastSyncedAt: Date | null; installedAt: Date | null; lastError: string | null; installMode: string | null }>) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(modelSources).set({ ...patch, updatedAt: new Date() }).where(and(eq(modelSources.id, id), eq(modelSources.userId, userId)));
  return getUserModelSource(userId, id);
}

export async function deleteModelSource(userId: number, id: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.delete(modelSources).where(and(eq(modelSources.userId, userId), eq(modelSources.id, id)));
  return Number(result[0].affectedRows ?? 0) > 0;
}
