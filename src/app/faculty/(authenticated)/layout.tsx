import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { FacultySidebar } from "@/components/premium/faculty-sidebar";

export default async function FacultyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // Guard: Must be logged in as Faculty or Super Admin
  if (!session) {
    redirect("/faculty/login");
  }

  if (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  const isSuperAdmin = session.role === "SUPER_ADMIN";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row relative overflow-x-hidden">
      {/* Decorative ambient glows */}
      <div className="absolute top-[-30%] left-[-15%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-25%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808006_1px,transparent_1px),linear-gradient(to_bottom,#80808006_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />

      {/* Sidebar Component */}
      <FacultySidebar session={session} isSuperAdmin={isSuperAdmin} />

      {/* Main content body — use min-h-0 on md so sidebar stays sticky */}
      <main className="flex-1 relative z-10 flex flex-col">
        <div className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10">
          <div className="max-w-6xl w-full mx-auto space-y-6 md:space-y-8">
            {children}
          </div>
        </div>
        
        {/* Footer */}
        <footer className="mt-8 md:mt-12 px-4 sm:px-6 md:px-8 py-4 md:py-6 border-t border-slate-200/50 dark:border-slate-800/50 text-center text-xs font-semibold text-slate-400 dark:text-slate-600">
          <p>© {new Date().getFullYear()} Electify. Administrative Control Room.</p>
        </footer>
      </main>
    </div>
  );
}
