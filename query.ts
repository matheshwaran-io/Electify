import { db } from "./src/lib/db";
import { users } from "./src/lib/db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const [u] = await db.select().from(users).where(eq(users.name, 'Sabenabanu'));
  console.log(u);
}
run();
