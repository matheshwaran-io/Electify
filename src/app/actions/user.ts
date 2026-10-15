"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import * as bcrypt from "bcryptjs";
import { cleanDisplayName } from "@/lib/format";
import { passwordProblem } from "@/lib/password-policy";

export interface UpdateProfileInput {
  name: string;
  currentPassword?: string;
  newPassword?: string;
}

export async function updateProfile(data: UpdateProfileInput): Promise<{ success: boolean }> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const trimmedName = data.name.trim();
  if (!trimmedName) throw new Error("Name cannot be empty");

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) throw new Error("User not found");

  const updateData: Partial<typeof users.$inferInsert> = {
    name: cleanDisplayName(trimmedName),
  };

  if (data.currentPassword && data.newPassword) {
    if (!user.passwordHash) {
      throw new Error("Password cannot be updated for this account type");
    }

    const isValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new Error("Incorrect current password");
    }

    const problem = passwordProblem(data.newPassword, { registerNumber: user.registerNumber ?? undefined });
    if (problem) {
      throw new Error(problem);
    }

    updateData.passwordHash = await bcrypt.hash(data.newPassword, 12);
  }

  await db.update(users).set(updateData).where(eq(users.id, session.userId));

  return { success: true };
}
