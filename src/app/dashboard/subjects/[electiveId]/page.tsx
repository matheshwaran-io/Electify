import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSubjectDetail } from "@/lib/subjects/queries";
import { SubjectDetailView } from "@/components/subjects/subject-views";
import { ContextBlocked, requireStudent, SubjectsHeader } from "../subject-page-guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Subject details" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SubjectDetailPage({ params }: { params: Promise<{ electiveId: string }> }) {
  const { electiveId } = await params;
  const studentId = await requireStudent();
  if (!UUID.test(electiveId)) notFound();

  const { ctx, subject } = await loadSubjectDetail(studentId, electiveId);
  if (ctx.status !== "OK") return <ContextBlocked status={ctx.status} />;
  if (!subject) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <SubjectsHeader />
      <SubjectDetailView
        subject={subject}
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
