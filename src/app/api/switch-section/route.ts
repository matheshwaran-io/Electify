import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { tutorSections } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "CLASS_TUTOR" && session.role !== "COURSE_COORDINATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sectionId } = await request.json();
    if (!sectionId) {
      return NextResponse.json({ error: "Missing sectionId" }, { status: 400 });
    }

    // Verify the tutor has access to this section
    const [assignment] = await db
      .select()
      .from(tutorSections)
      .where(and(eq(tutorSections.tutorId, session.userId), eq(tutorSections.sectionId, sectionId)))
      .limit(1);

    if (!assignment) {
      return NextResponse.json({ error: "You are not assigned to this section." }, { status: 403 });
    }

    const response = NextResponse.json({ success: true, newSectionId: sectionId });
    response.cookies.set("electify_active_section", sectionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7200,
    });

    return response;
  } catch (error: any) {
    console.error("Switch section error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
