import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registration receipt · Electify" };

export default async function RegistrationSuccessPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "STUDENT") {
    redirect("/faculty/dashboard");
  }

  redirect("/dashboard/my-registration");
}
