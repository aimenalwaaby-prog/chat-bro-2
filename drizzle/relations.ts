import { relations } from "drizzle-orm";
import { attachments, conversations, messages, users, usageEvents } from "./schema";

export const userRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
  usageEvents: many(usageEvents),
  attachments: many(attachments),
}));

export const conversationRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
}));
