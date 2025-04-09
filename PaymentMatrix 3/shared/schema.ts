import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const paymentLinks = pgTable("payment_links", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  url: text("url").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("active"),
  errorCode: text("error_code"),
  lastChecked: timestamp("last_checked").notNull().defaultNow(),
  transactionNo: text("transaction_no"),
  amountAED: text("amount_aed"),
  archived: boolean("archived").notNull().default(false),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertPaymentLinkSchema = createInsertSchema(paymentLinks).pick({
  url: true,
  amount: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type PaymentLink = typeof paymentLinks.$inferSelect;
export type InsertPaymentLink = z.infer<typeof insertPaymentLinkSchema>;