import * as React from "react";
import type { Metadata } from "next";
import { loadSubjectCatalog } from "@/lib/subjects/queries";
import { SubjectCatalogView } from "@/components/subjects/subject-views";
import { ContextBlocked, requireStudent, SubjectsHeader } from "./subject-page-guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Explore subjects" };

export default async function SubjectCatalogPage() {
  const studentId = await requireStudent();
  const { ctx, subjects } = await loadSubjectCatalog(studentId);

  if (ctx.status !== "OK") return <ContextBlocked status={ctx.status} />;

  return (
    <div className="flex min-h-dvh flex-col">
      <SubjectsHeader />
      <SubjectCatalogView
        eventName={ctx.event.name}
        subjects={subjects}
        banner={{
          state: ctx.window.state,
          opensAt: ctx.window.opensAt?.toISOString() ?? null,
          closesAt: ctx.window.closesAt?.toISOString() ?? null,
          serverNow: ctx.serverNow,
          registrationStatus: ctx.registrationStatus,
          eligible: ctx.student.isEligible && ctx.student.isActive,
        }}
      />
    </div>
  );
}
