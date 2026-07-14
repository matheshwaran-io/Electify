import { config } from "dotenv";
config({ path: ".env" });
import { db } from "./src/lib/db";
import { users } from "./src/lib/db/schema";
import { eq } from "drizzle-orm";
import * as bcrypt from "bcryptjs";

async function main() {
  console.log("Fetching students...");
  const students = await db.select().from(users).where(eq(users.role, "STUDENT"));
  console.log(`Found ${students.length} students. Updating passwords...`);

  for (const student of students) {
    if (student.registerNumber) {
      const hashed = await bcrypt.hash(student.registerNumber.toUpperCase().trim(), 12);
      await db.update(users).set({ passwordHash: hashed }).where(eq(users.id, student.id));
      console.log(`Updated password for ${student.registerNumber}`);
    }
  }
  
  console.log("Finished updating passwords.");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
