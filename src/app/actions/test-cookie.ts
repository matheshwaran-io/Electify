"use server";
import { cookies } from "next/headers";
export async function testCookie() {
  const cookieStore = await cookies();
  cookieStore.set("test_cookie", "test_value", { path: "/" });
  return "success";
}
