import { db } from "./src/lib/db";
import { users, sections } from "./src/lib/db/schema";
import { eq, isNull } from "drizzle-orm";

async function run() {
  const allUsers = await db.select().from(users).where(eq(users.role, 'CLASS_TUTOR'));
  console.log("Class Tutors:", allUsers.map(u => ({ name: u.name, sectionId: u.sectionId })));
  
  const [s] = await db.select().from(sections).limit(1);
  if (s) {
    const res = await db.update(users).set({ sectionId: s.id }).where(eq(users.role, 'CLASS_TUTOR')).where(isNull(users.sectionId)).returning();
    console.log('Fixed tutors without section:', res.length);
  }
}
run();
