import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import { buttonVariants } from "@/components/ui/button";

export default function SubjectNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-5">
      <EmptyState
        icon={<SearchX />}
        title="This subject isn't available to you"
        description="It may belong to another batch's registration, or it was removed from your event."
        action={
          <Link href="/dashboard/subjects" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Browse all subjects
          </Link>
        }
      />
    </main>
  );
}
