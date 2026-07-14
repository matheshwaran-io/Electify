import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { FacultyLayoutClient } from "@/components/layout/faculty-layout-client";

export default async function FacultyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Double check that students don't access this layout
  if (session.role === "STUDENT") {
    redirect("/dashboard");
  }

  return <FacultyLayoutClient session={session}>{children}</FacultyLayoutClient>;
}
