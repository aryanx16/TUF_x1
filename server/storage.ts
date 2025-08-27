import {
  users,
  dsaConfidence,
  type User,
  type UpsertUser,
  type DsaConfidence,
  type InsertDsaConfidence,
  type UpdateDsaConfidence,
} from "../shared/schema.js";
import { db } from "./db.js";
import { eq, and } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // DSA Confidence operations
  getUserConfidenceData(userId: string): Promise<DsaConfidence[]>;
  saveConfidenceData(userId: string, confidenceData: Array<{
    problemId: string;
    confidenceLevel: string;
    sheetName?: string;
    problemTitle?: string;
  }>): Promise<void>;
  updateConfidence(userId: string, problemId: string, confidenceLevel: string): Promise<DsaConfidence>;
  getConfidenceByProblem(userId: string, problemId: string): Promise<DsaConfidence | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // DSA Confidence operations
  async getUserConfidenceData(userId: string): Promise<DsaConfidence[]> {
    return await db
      .select()
      .from(dsaConfidence)
      .where(eq(dsaConfidence.userId, userId));
  }

  async saveConfidenceData(userId: string, confidenceData: Array<{
    problemId: string;
    confidenceLevel: string;
    sheetName?: string;
    problemTitle?: string;
  }>): Promise<void> {
    for (const data of confidenceData) {
      await db
        .insert(dsaConfidence)
        .values({
          userId,
          problemId: data.problemId,
          confidenceLevel: data.confidenceLevel,
          sheetName: data.sheetName,
          problemTitle: data.problemTitle,
        })
        .onConflictDoUpdate({
          target: [dsaConfidence.userId, dsaConfidence.problemId],
          set: {
            confidenceLevel: data.confidenceLevel,
            sheetName: data.sheetName,
            problemTitle: data.problemTitle,
            updatedAt: new Date(),
          },
        });
    }
  }

  async updateConfidence(userId: string, problemId: string, confidenceLevel: string): Promise<DsaConfidence> {
    const [updated] = await db
      .insert(dsaConfidence)
      .values({
        userId,
        problemId,
        confidenceLevel,
      })
      .onConflictDoUpdate({
        target: [dsaConfidence.userId, dsaConfidence.problemId],
        set: {
          confidenceLevel,
          updatedAt: new Date(),
        },
      })
      .returning();
    return updated;
  }

  async getConfidenceByProblem(userId: string, problemId: string): Promise<DsaConfidence | undefined> {
    const [confidence] = await db
      .select()
      .from(dsaConfidence)
      .where(and(
        eq(dsaConfidence.userId, userId),
        eq(dsaConfidence.problemId, problemId)
      ));
    return confidence;
  }
}

export const storage = new DatabaseStorage();