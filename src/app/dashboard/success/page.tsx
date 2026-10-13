import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { withEvent } from "@/lib/student-events";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registration receipt · Electify" };

export default async function RegistrationSuccessPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "STUDENT") {
    redirect("/faculty/dashboard");
  }

  const { event } = await searchParams;
  redirect(withEvent("/dashboard/my-registration", event));
}
