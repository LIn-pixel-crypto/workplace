import { PaymentLink, InsertPaymentLink, User, InsertUser } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;

  // Payment link methods
  getPaymentLinks(userId: number): Promise<PaymentLink[]>;
  createPaymentLink(userId: number, link: InsertPaymentLink): Promise<PaymentLink>;
  deletePaymentLink(id: number, userId: number): Promise<void>;
  updatePaymentLinkStatus(
    id: number,
    status: string,
    errorCode?: string | null,
    transactionNo?: string | null,
    amountAED?: string | null
  ): Promise<PaymentLink>;
  updatePaymentLinkUrl(id: number, url: string): Promise<PaymentLink>;
  archivePaymentLink(id: number, userId: number): Promise<PaymentLink>;

  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private usersByUsername: Map<string, User>;
  private paymentLinks: Map<number, PaymentLink>;
  private currentUserId: number;
  private currentLinkId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.usersByUsername = new Map();
    this.paymentLinks = new Map();
    this.currentUserId = 1;
    this.currentLinkId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return this.usersByUsername.get(username) || null;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = {
      ...userData,
      id,
    };
    this.users.set(id, user);
    this.usersByUsername.set(userData.username, user);
    return user;
  }

  async getPaymentLinks(userId: number): Promise<PaymentLink[]> {
    return Array.from(this.paymentLinks.values()).filter(
      (link) => link.userId === userId,
    );
  }

  async createPaymentLink(userId: number, link: InsertPaymentLink): Promise<PaymentLink> {
    const id = this.currentLinkId++;
    const paymentLink: PaymentLink = {
      ...link,
      id,
      userId,
      status: "active",
      errorCode: null,
      lastChecked: new Date(),
      transactionNo: null,
      amountAED: null,
      archived: false,
    };
    this.paymentLinks.set(id, paymentLink);
    return paymentLink;
  }

  async deletePaymentLink(id: number, userId: number): Promise<void> {
    const link = this.paymentLinks.get(id);
    if (!link || link.userId !== userId) {
      throw new Error("Payment link not found or unauthorized");
    }
    this.paymentLinks.delete(id);
  }

  async updatePaymentLinkStatus(
    id: number,
    status: string,
    errorCode?: string | null,
    transactionNo?: string | null,
    amountAED?: string | null,
  ): Promise<PaymentLink> {
    const link = this.paymentLinks.get(id);
    if (!link) {
      throw new Error("Payment link not found");
    }

    const updated: PaymentLink = {
      ...link,
      status,
      errorCode: errorCode ?? null,
      lastChecked: new Date(),
      transactionNo: transactionNo ?? link.transactionNo,
      amountAED: amountAED ?? link.amountAED,
    };
    this.paymentLinks.set(id, updated);
    return updated;
  }

  async updatePaymentLinkUrl(id: number, url: string): Promise<PaymentLink> {
    const link = this.paymentLinks.get(id);
    if (!link) {
      throw new Error("Payment link not found");
    }

    const updated: PaymentLink = {
      ...link,
      url,
    };
    this.paymentLinks.set(id, updated);
    return updated;
  }

  async archivePaymentLink(id: number, userId: number): Promise<PaymentLink> {
    const link = this.paymentLinks.get(id);
    if (!link || link.userId !== userId) {
      throw new Error("Payment link not found or unauthorized");
    }

    const updated: PaymentLink = {
      ...link,
      archived: true,
    };
    this.paymentLinks.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();