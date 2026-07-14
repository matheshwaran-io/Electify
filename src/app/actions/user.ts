"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import * as bcrypt from "bcryptjs";

export async function updateProfile(data: { name: string; currentPassword?: string; newPassword?: string }) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) throw new Error("User not found");

  const updateData: any = { name: data.name };

  if (data.currentPassword && data.newPassword) {
    if (!user.passwordHash) {
      throw new Error("Password cannot be updated for this account type");
    }
    
    const isValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new Error("Incorrect current password");
    }

    if (data.newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters");
    }

    updateData.passwordHash = await bcrypt.hash(data.newPassword, 12);
  }

  await db.update(users).set(updateData).where(eq(users.id, session.userId));
  
  return { success: true };
}
