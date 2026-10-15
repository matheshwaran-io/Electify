"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  GraduationCap,
  KeyRound,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import {
  assignTutorSections,
  createUser,
  updateUser,
  toggleUserActive,
  toggleStudentEligibility,
  adminResetPassword,
  deleteUser,
} from "@/app/actions/admin";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Avatar, PageHeader } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge, statusLabel } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type Column, type FilterDef } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeId: string | null;
  phone?: string | null;
  isActive: boolean;
  createdAt: Date;
  managedSectionIds?: string[];
};

export type StudentUser = {
  id: string;
  name: string;
  email: string;
  registerNumber: string | null;
  phone?: string | null;
  programmeId?: string | null;
  academicBatchId?: string | null;
  sectionId?: string | null;
  isActive: boolean;
  isEligible: boolean;
  createdAt: Date;
  programmeName: string | null;
};

const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const STAFF_ROLES = [
  { value: "SYSTEM_ADMIN", label: "System Admin" },
  { value: "COURSE_COORDINATOR", label: "Course Coordinator" },
  { value: "CLASS_TUTOR", label: "Class Tutor" },
];

function NameCell({ name, sub }: { name: string; sub?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={name} />
      <span className="min-w-0">
        <span className="block truncate font-medium text-fg">{name}</span>
        {sub ? <span className="block truncate text-xs font-normal text-fg-muted">{sub}</span> : null}
      </span>
    </span>
  );
}

export function UsersClient({
  staff,
  students,
  hierarchy,
  currentUserId,
}: {
  staff: StaffUser[];
  students: StudentUser[];
  hierarchy: any[];
  currentUserId?: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("staff");

  // Manage sections modal state
  const [managingTutor, setManagingTutor] = useState<StaffUser | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  // Add User Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<"STAFF" | "STUDENT">("STAFF");
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createRole, setCreateRole] = useState<"SYSTEM_ADMIN" | "COURSE_COORDINATOR" | "CLASS_TUTOR">("CLASS_TUTOR");
  const [createEmployeeId, setCreateEmployeeId] = useState("");
  const [createRegisterNumber, setCreateRegisterNumber] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createProgrammeId, setCreateProgrammeId] = useState("");
  const [createEligible, setCreateEligible] = useState(true);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<(StaffUser | StudentUser) & { isStudent?: boolean } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [editRegisterNumber, setEditRegisterNumber] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editEligible, setEditEligible] = useState(true);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Reset Password Modal State
  const [resettingUser, setResettingUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Delete User Dialog State
  const [deletingUser, setDeletingUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [isPending, startTransition] = useTransition();

  // Extract programmes from hierarchy
  const programmesList: { value: string; label: string }[] = [];
  hierarchy.forEach((f: any) =>
    f.departments?.forEach((d: any) =>
      d.programmes?.forEach((p: any) => {
        programmesList.push({ value: p.id, label: `${p.name} (${p.code})` });
      })
    )
  );

  const handleToggleActive = (user: { id: string; name: string; isActive: boolean }) => {
    if (user.id === currentUserId) {
      toast.error("You cannot deactivate your own account.");
      return;
    }
    startTransition(async () => {
      try {
        await toggleUserActive(user.id, !user.isActive);
        toast.success(`Account for "${user.name}" ${!user.isActive ? "activated" : "deactivated"}.`);
        router.refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to toggle status";
        toast.error(msg);
      }
    });
  };

  const handleToggleEligibility = (student: StudentUser, nextEligible: boolean) => {
    startTransition(async () => {
      try {
        await toggleStudentEligibility(student.id, nextEligible);
        toast.success(`Student "${student.name}" marked as ${nextEligible ? "eligible" : "ineligible"}.`);
        router.refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to toggle eligibility";
        toast.error(msg);
      }
    });
  };

  const openCreateModal = (type: "STAFF" | "STUDENT" = "STAFF") => {
    setCreateType(type);
    setCreateName("");
    setCreateEmail("");
    setCreateRole("CLASS_TUTOR");
    setCreateEmployeeId("");
    setCreateRegisterNumber("");
    setCreatePhone("");
    setCreatePassword("");
    setCreateProgrammeId(programmesList.length > 0 ? programmesList[0].value : "");
    setCreateEligible(true);
    setCreateErrors({});
    setCreateOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!createName.trim()) errors.name = "Name is required.";
    if (!createEmail.trim()) errors.email = "Email is required.";

    if (createType === "STUDENT" && !createRegisterNumber.trim()) {
      errors.registerNumber = "Register number is required.";
    }

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    startTransition(async () => {
      try {
        await createUser({
          name: createName,
          email: createEmail,
          password: createPassword || undefined,
          role: createType === "STAFF" ? createRole : "STUDENT",
          employeeId: createType === "STAFF" ? createEmployeeId : undefined,
          registerNumber: createType === "STUDENT" ? createRegisterNumber : undefined,
          phone: createPhone || undefined,
          programmeId: createType === "STUDENT" ? createProgrammeId || undefined : undefined,
          isEligible: createType === "STUDENT" ? createEligible : true,
        });

        toast.success(`User "${createName}" created successfully.`);
        setCreateOpen(false);
        router.refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to create user";
        toast.error(msg);
      }
    });
  };

  const openEditModal = (u: StaffUser | StudentUser) => {
    const isStudent = "registerNumber" in u;
    setEditingUser({ ...u, isStudent });
    setEditName(u.name);
    setEditEmail(u.email);
    setEditEmployeeId("employeeId" in u ? u.employeeId || "" : "");
    setEditRegisterNumber("registerNumber" in u ? u.registerNumber || "" : "");
    setEditPhone(u.phone || "");
    setEditRole("role" in u ? (u as StaffUser).role : "STUDENT");
    setEditActive(u.isActive);
    setEditEligible("isEligible" in u ? (u as StudentUser).isEligible : true);
    setEditErrors({});
    setEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const errors: Record<string, string> = {};
    if (!editName.trim()) errors.name = "Name cannot be empty.";
    if (!editEmail.trim()) errors.email = "Email cannot be empty.";

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    startTransition(async () => {
      try {
        await updateUser(editingUser.id, {
          name: editName,
          email: editEmail,
          employeeId: editingUser.isStudent ? undefined : editEmployeeId,
          registerNumber: editingUser.isStudent ? editRegisterNumber : undefined,
          phone: editPhone,
          role: editingUser.isStudent ? undefined : editRole,
          isActive: editActive,
          isEligible: editingUser.isStudent ? editEligible : undefined,
        });

        toast.success(`User "${editName}" updated successfully.`);
        setEditOpen(false);
        router.refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to update user";
        toast.error(msg);
      }
    });
  };

  const openResetPasswordModal = (u: { id: string; name: string; email: string }) => {
    setResettingUser(u);
    setNewPassword("");
    setResetPasswordOpen(true);
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;
    if (newPassword.trim().length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    startTransition(async () => {
      try {
        await adminResetPassword(resettingUser.id, newPassword);
        toast.success(`Password updated for "${resettingUser.name}".`);
        setResetPasswordOpen(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to reset password";
        toast.error(msg);
      }
    });
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      await deleteUser(deletingUser.id);
      toast.success(`User "${deletingUser.name}" deleted.`);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete user";
      toast.error(msg);
      throw err;
    }
  };

  const staffColumns: Column<StaffUser>[] = [
    {
      id: "name",
      header: "Name",
      mobile: "title",
      hideable: false,
      cell: (u) => <NameCell name={u.name} sub={u.phone ?? undefined} />,
      sortValue: (u) => u.name,
      searchValue: (u) => `${u.name} ${u.phone ?? ""}`,
    },
    {
      id: "email",
      header: "Email",
      mobile: "subtitle",
      cell: (u) => <span className="text-fg-muted">{u.email}</span>,
      sortValue: (u) => u.email,
      searchValue: (u) => u.email,
    },
    {
      id: "employee",
      header: "Employee ID",
      cell: (u) => <span className="font-mono text-xs text-fg-muted">{u.employeeId ?? "—"}</span>,
      sortValue: (u) => u.employeeId,
      searchValue: (u) => u.employeeId,
    },
    {
      id: "role",
      header: "Role",
      mobileWide: true,
      cell: (u) => {
        const isRoot = u.email === "electify@srmist.edu.in" || u.email === "admin@electify.edu";
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusBadge status={u.role} size="sm" />
            {isRoot && (
              <Badge size="sm" tone="primary" className="font-semibold tracking-wide">
                Root Admin
              </Badge>
            )}
          </div>
        );
      },
      sortValue: (u) => u.role,
    },
    {
      id: "status",
      header: "Status",
      cell: (u) => (
        <Badge size="sm" tone={u.isActive ? "success" : "danger"} dot>
          {u.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
      sortValue: (u) => (u.isActive ? 1 : 0),
    },
    {
      id: "joined",
      header: "Joined",
      cell: (u) => <span className="whitespace-nowrap text-fg-muted">{formatDate(u.createdAt)}</span>,
      sortValue: (u) => new Date(u.createdAt).getTime(),
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      mobile: "actions",
      hideable: false,
      cell: (u) => {
        const isRoot = u.email === "electify@srmist.edu.in" || u.email === "admin@electify.edu";
        return (
          <div className="flex items-center justify-end gap-1.5">
            {u.role === "CLASS_TUTOR" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setManagingTutor(u);
                  setManageOpen(true);
                }}
                aria-label={`Manage sections for ${u.name}`}
              >
                <Layers className="size-3.5" /> Sections
              </Button>
            ) : null}

            <Button
              size="sm"
              variant="secondary"
              onClick={() => openEditModal(u)}
              aria-label={`Edit ${u.name}`}
            >
              <Pencil className="size-3.5" /> Edit
            </Button>

            <Menu>
              <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More actions for ${u.name}`} />}>
                <MoreHorizontal className="size-4" />
              </MenuTrigger>
              <MenuContent align="end">
                <MenuLabel>Account Controls</MenuLabel>
                {!isRoot ? (
                  <MenuItem onClick={() => handleToggleActive(u)}>
                    {u.isActive ? (
                      <>
                        <UserX className="size-4 text-warning" /> Deactivate account
                      </>
                    ) : (
                      <>
                        <UserCheck className="size-4 text-success" /> Activate account
                      </>
                    )}
                  </MenuItem>
                ) : null}
                <MenuItem onClick={() => openResetPasswordModal(u)}>
                  <KeyRound className="size-4" /> Reset password
                </MenuItem>
                {u.role === "CLASS_TUTOR" ? (
                  <MenuItem
                    onClick={() => {
                      setManagingTutor(u);
                      setManageOpen(true);
                    }}
                  >
                    <Layers className="size-4" /> Manage assigned sections
                  </MenuItem>
                ) : null}

                {u.id !== currentUserId && !isRoot ? (
                  <>
                    <MenuLabel>Danger Zone</MenuLabel>
                    <MenuItem
                      tone="danger"
                      onClick={() => {
                        setDeletingUser({ id: u.id, name: u.name, email: u.email, role: u.role });
                        setDeleteConfirmOpen(true);
                      }}
                    >
                      <Trash2 className="size-4" /> Delete account
                    </MenuItem>
                  </>
                ) : null}
              </MenuContent>
            </Menu>
          </div>
        );
      },
    },
  ];

  const studentColumns: Column<StudentUser>[] = [
    {
      id: "name",
      header: "Name",
      mobile: "title",
      hideable: false,
      cell: (u) => <NameCell name={u.name} sub={u.email} />,
      sortValue: (u) => u.name,
      searchValue: (u) => u.name,
    },
    {
      id: "reg",
      header: "Register no.",
      cell: (u) => <span className="font-mono text-xs text-fg-muted">{u.registerNumber ?? "—"}</span>,
      sortValue: (u) => u.registerNumber,
      searchValue: (u) => u.registerNumber,
    },
    {
      id: "programme",
      header: "Programme",
      cell: (u) => <span className="text-fg-muted">{u.programmeName ?? "—"}</span>,
      sortValue: (u) => u.programmeName,
      searchValue: (u) => u.programmeName,
    },
    {
      id: "active",
      header: "Account",
      cell: (u) => (
        <Badge size="sm" tone={u.isActive ? "success" : "danger"} dot>
          {u.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
      sortValue: (u) => (u.isActive ? 1 : 0),
    },
    {
      id: "eligible",
      header: "Eligible",
      cell: (u) => (
        <Badge size="sm" tone={u.isEligible ? "success" : "warning"}>
          {u.isEligible ? "Eligible" : "Not eligible"}
        </Badge>
      ),
      sortValue: (u) => (u.isEligible ? 1 : 0),
    },
    {
      id: "joined",
      header: "Joined",
      cell: (u) => <span className="whitespace-nowrap text-fg-muted">{formatDate(u.createdAt)}</span>,
      sortValue: (u) => new Date(u.createdAt).getTime(),
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      mobile: "actions",
      hideable: false,
      cell: (u) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => openEditModal(u)}
            aria-label={`Edit ${u.name}`}
          >
            <Pencil className="size-3.5" /> Edit
          </Button>

          <Menu>
            <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More actions for ${u.name}`} />}>
              <MoreHorizontal className="size-4" />
            </MenuTrigger>
            <MenuContent align="end">
              <MenuLabel>Student Status</MenuLabel>
              <MenuItem onClick={() => handleToggleEligibility(u, !u.isEligible)}>
                {u.isEligible ? (
                  <>
                    <ShieldAlert className="size-4 text-warning" /> Mark ineligible
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4 text-success" /> Mark eligible
                  </>
                )}
              </MenuItem>
              <MenuItem onClick={() => handleToggleActive(u)}>
                {u.isActive ? (
                  <>
                    <UserX className="size-4 text-warning" /> Deactivate account
                  </>
                ) : (
                  <>
                    <UserCheck className="size-4 text-success" /> Activate account
                  </>
                )}
              </MenuItem>
              <MenuItem onClick={() => openResetPasswordModal(u)}>
                <KeyRound className="size-4" /> Reset password
              </MenuItem>
              <MenuLabel>Danger Zone</MenuLabel>
              <MenuItem
                tone="danger"
                onClick={() => {
                  setDeletingUser({ id: u.id, name: u.name, email: u.email, role: "STUDENT" });
                  setDeleteConfirmOpen(true);
                }}
              >
                <Trash2 className="size-4" /> Delete student
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      ),
    },
  ];

  const roles = [...new Set(staff.map((u) => u.role))];
  const staffFilters: FilterDef<StaffUser>[] =
    roles.length > 1
      ? [{ id: "role", label: "Role", options: roles.map((r) => ({ value: r, label: statusLabel(r) })), predicate: (u, v) => u.role === v }]
      : [];

  const studentFilters: FilterDef<StudentUser>[] = [
    { id: "eligible", label: "Eligible", options: yesNo, predicate: (u, v) => u.isEligible === (v === "yes") },
    { id: "active", label: "Active", options: yesNo, predicate: (u, v) => u.isActive === (v === "yes") },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        description="Every staff and student account in the system."
        actions={
          <Button variant="primary" size="sm" onClick={() => openCreateModal(activeTab === "students" ? "STUDENT" : "STAFF")}>
            <Plus className="size-3.5" /> Add user
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="pill" className="mb-4 w-fit max-w-full">
          <TabsTrigger value="staff">
            <Users /> Staff <span className="font-mono text-xs tabular-nums text-fg-subtle">{staff.length}</span>
          </TabsTrigger>
          <TabsTrigger value="students">
            <GraduationCap /> Students <span className="font-mono text-xs tabular-nums text-fg-subtle">{students.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          <DataTable
            data={staff}
            columns={staffColumns}
            getRowId={(u) => u.id}
            caption="Staff accounts"
            searchPlaceholder="Search by name or email"
            filters={staffFilters}
            empty={
              <EmptyState
                compact
                icon={<Users />}
                title="No staff found"
                action={
                  <Button size="sm" onClick={() => openCreateModal("STAFF")}>
                    <Plus className="size-3.5" /> Add staff member
                  </Button>
                }
              />
            }
          />
        </TabsContent>

        <TabsContent value="students">
          <DataTable
            data={students}
            columns={studentColumns}
            getRowId={(u) => u.id}
            caption="Student accounts"
            searchPlaceholder="Search by name or register number"
            filters={studentFilters}
            pageSize={25}
            empty={
              <EmptyState
                compact
                icon={<GraduationCap />}
                title="No students found"
                action={
                  <Button size="sm" onClick={() => openCreateModal("STUDENT")}>
                    <Plus className="size-3.5" /> Add student
                  </Button>
                }
              />
            }
          />
        </TabsContent>
      </Tabs>

      {/* Add User Modal */}
      <Dialog open={createOpen} onOpenChange={(o) => !isPending && setCreateOpen(o)}>
        <DialogContent size="md" showClose={!isPending}>
          <DialogHeader>
            <DialogTitle>Add new user</DialogTitle>
            <DialogDescription>Create a new staff administrator, coordinator, tutor, or student.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit}>
            <DialogBody className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-fg">Account Type</legend>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateType("STAFF")}
                    className={cn(
                      "flex h-10 items-center justify-center gap-2 rounded-control border text-sm font-medium transition-colors",
                      createType === "STAFF"
                        ? "border-primary bg-primary text-primary-fg"
                        : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg"
                    )}
                  >
                    <Users className="size-4" /> Staff Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateType("STUDENT")}
                    className={cn(
                      "flex h-10 items-center justify-center gap-2 rounded-control border text-sm font-medium transition-colors",
                      createType === "STUDENT"
                        ? "border-primary bg-primary text-primary-fg"
                        : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg"
                    )}
                  >
                    <GraduationCap className="size-4" /> Student Account
                  </button>
                </div>
              </fieldset>

              <Field label="Full name" error={createErrors.name}>
                <Input
                  placeholder="e.g. Dr. Priya Sharma"
                  value={createName}
                  onChange={(e) => {
                    setCreateName(e.target.value);
                    if (createErrors.name) setCreateErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  disabled={isPending}
                  autoFocus
                />
              </Field>

              <Field label="Email address" error={createErrors.email}>
                <Input
                  type="email"
                  placeholder="name@university.edu"
                  value={createEmail}
                  onChange={(e) => {
                    setCreateEmail(e.target.value);
                    if (createErrors.email) setCreateErrors((prev) => ({ ...prev, email: "" }));
                  }}
                  disabled={isPending}
                />
              </Field>

              {createType === "STAFF" ? (
                <>
                  <Field label="System role">
                    <Select
                      value={createRole}
                      onValueChange={(val) => setCreateRole(val as any)}
                      options={STAFF_ROLES}
                      disabled={isPending}
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Employee ID" description="Optional staff identifier">
                      <Input
                        placeholder="e.g. EMP1042"
                        value={createEmployeeId}
                        onChange={(e) => setCreateEmployeeId(e.target.value)}
                        disabled={isPending}
                      />
                    </Field>

                    <Field label="Phone number" description="Optional contact">
                      <Input
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={createPhone}
                        onChange={(e) => setCreatePhone(e.target.value)}
                        disabled={isPending}
                      />
                    </Field>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Register number" description="Official student ID" error={createErrors.registerNumber}>
                      <Input
                        placeholder="RA2311003010001"
                        value={createRegisterNumber}
                        onChange={(e) => {
                          setCreateRegisterNumber(e.target.value.toUpperCase());
                          if (createErrors.registerNumber) setCreateErrors((prev) => ({ ...prev, registerNumber: "" }));
                        }}
                        disabled={isPending}
                      />
                    </Field>

                    <Field label="Phone number" description="Optional">
                      <Input
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={createPhone}
                        onChange={(e) => setCreatePhone(e.target.value)}
                        disabled={isPending}
                      />
                    </Field>
                  </div>

                  {programmesList.length > 0 ? (
                    <Field label="Programme" description="Enrolled degree programme">
                      <Select
                        value={createProgrammeId || null}
                        onValueChange={setCreateProgrammeId}
                        options={programmesList}
                        disabled={isPending}
                      />
                    </Field>
                  ) : null}

                  <div className="flex items-center justify-between rounded-control border border-border bg-surface-2/70 p-3">
                    <span className="text-sm font-medium text-fg">Registration Eligibility</span>
                    <Switch checked={createEligible} onCheckedChange={setCreateEligible} disabled={isPending} />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Field
                  label="Initial password"
                  description="Set a custom password or leave blank to use the default shown below."
                >
                  <Input
                    type="password"
                    placeholder="Enter custom password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    disabled={isPending}
                  />
                </Field>
                <div className="flex items-center gap-2 rounded-control border border-border bg-surface-2/70 px-3 py-2">
                  <KeyRound className="size-3.5 shrink-0 text-fg-subtle" />
                  <span className="text-xs text-fg-muted">
                    Default password:{" "}
                    <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs font-semibold text-fg">
                      {createType === "STAFF" ? "Welcome@123" : createRegisterNumber.trim() || "<Register Number>"}
                    </code>
                    {createType === "STAFF" ? null : " Students must choose their own password the first time they sign in."}
                  </span>
                </div>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" loading={isPending} loadingText="Creating...">
                Create user
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={editOpen} onOpenChange={(o) => !isPending && setEditOpen(o)}>
        <DialogContent size="md" showClose={!isPending}>
          <DialogHeader>
            <DialogTitle>Edit user details</DialogTitle>
            <DialogDescription>Update profile details, contact information, or status.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit}>
            <DialogBody className="space-y-4">
              <Field label="Full name" error={editErrors.name}>
                <Input
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    if (editErrors.name) setEditErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  disabled={isPending}
                  autoFocus
                />
              </Field>

              <Field label="Email address" error={editErrors.email}>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => {
                    setEditEmail(e.target.value);
                    if (editErrors.email) setEditErrors((prev) => ({ ...prev, email: "" }));
                  }}
                  disabled={isPending}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                {editingUser?.isStudent ? (
                  <Field label="Register number">
                    <Input
                      value={editRegisterNumber}
                      onChange={(e) => setEditRegisterNumber(e.target.value.toUpperCase())}
                      disabled={isPending}
                    />
                  </Field>
                ) : (
                  <Field label="Employee ID">
                    <Input
                      value={editEmployeeId}
                      onChange={(e) => setEditEmployeeId(e.target.value)}
                      disabled={isPending}
                    />
                  </Field>
                )}

                <Field label="Phone number">
                  <Input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    disabled={isPending}
                  />
                </Field>
              </div>

              {!editingUser?.isStudent ? (
                <Field label="Role">
                  <Select
                    value={editRole}
                    onValueChange={setEditRole}
                    options={STAFF_ROLES}
                    disabled={isPending || editingUser?.id === currentUserId}
                  />
                </Field>
              ) : null}

              <div className="space-y-2 rounded-control border border-border bg-surface-2/70 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-fg">Account Active</span>
                  <Switch
                    checked={editActive}
                    onCheckedChange={setEditActive}
                    disabled={isPending || editingUser?.id === currentUserId}
                  />
                </div>
                {editingUser?.isStudent ? (
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="text-sm font-medium text-fg">Eligible for Elective Registration</span>
                    <Switch checked={editEligible} onCheckedChange={setEditEligible} disabled={isPending} />
                  </div>
                ) : null}
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" loading={isPending} loadingText="Saving...">
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={resetPasswordOpen} onOpenChange={(o) => !isPending && setResetPasswordOpen(o)}>
        <DialogContent size="sm" showClose={!isPending}>
          <DialogHeader>
            <DialogTitle>Reset user password</DialogTitle>
            <DialogDescription>
              Set a new secure password for {resettingUser?.name} ({resettingUser?.email}).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPasswordSubmit}>
            <DialogBody className="space-y-4">
              <Field label="New password" description="Must be at least 6 characters">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isPending}
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={generatePassword}
                    title="Generate secure password"
                  >
                    Generate
                  </Button>
                </div>
              </Field>

              {newPassword ? (
                <div className="flex items-center justify-between rounded-control border border-border bg-surface-2 p-2.5">
                  <span className="font-mono text-xs font-semibold text-fg">{newPassword}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(newPassword);
                      toast.success("Password copied to clipboard");
                    }}
                  >
                    <Copy className="size-3" /> Copy
                  </Button>
                </div>
              ) : null}
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setResetPasswordOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" loading={isPending} loadingText="Updating...">
                Update password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        tone="danger"
        title="Delete user account?"
        description="Permanently delete this user from the system. Any active section assignments or registration records will be cleaned up. This cannot be undone."
        impact={
          deletingUser
            ? [
                { label: "User", value: deletingUser.name },
                { label: "Email", value: deletingUser.email },
                { label: "Role", value: statusLabel(deletingUser.role) },
                { label: "Account", value: "Permanently deleted", tone: "danger" },
              ]
            : undefined
        }
        requireText="DELETE"
        confirmLabel="Delete user permanently"
        onConfirm={handleDeleteUser}
      />

      {/* Tutor Sections Dialog */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent size="lg">
          {managingTutor ? (
            <ManageTutorSections
              key={managingTutor.id}
              tutor={managingTutor}
              hierarchy={hierarchy}
              onClose={() => setManageOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ManageTutorSections({ tutor, hierarchy, onClose }: { tutor: StaffUser; hierarchy: any[]; onClose: () => void }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>(tutor.managedSectionIds || []);
  const [isSaving, setIsSaving] = useState(false);

  const toggleSection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await assignTutorSections(tutor.id, selectedIds);
      toast.success("Sections updated successfully");
      router.refresh();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update sections";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const allSections: { id: string; label: string; programme: string; batch: string }[] = [];
  hierarchy.forEach((f) =>
    f.departments?.forEach((d: any) =>
      d.programmes?.forEach((p: any) =>
        p.batches?.forEach((b: any) =>
          b.sections?.forEach((s: any) => {
            allSections.push({ id: s.id, label: s.label, programme: p.name, batch: b.year });
          })
        )
      )
    )
  );

  const grouped = allSections.reduce((acc, sec) => {
    const key = `${sec.programme} · ${sec.batch}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(sec);
    return acc;
  }, {} as Record<string, typeof allSections>);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Manage sections</DialogTitle>
        <DialogDescription>Choose the classes {tutor.name} looks after.</DialogDescription>
      </DialogHeader>

      <DialogBody className="max-h-[55dvh] space-y-6 overflow-y-auto scrollbar-thin">
        {Object.entries(grouped).map(([groupName, secs]) => (
          <fieldset key={groupName} className="space-y-3">
            <legend className="text-xs font-medium text-fg-muted">{groupName}</legend>
            <div className="flex flex-wrap gap-2">
              {secs.map((sec) => {
                const isSelected = selectedIds.includes(sec.id);
                return (
                  <button
                    key={sec.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleSection(sec.id)}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                      isSelected
                        ? "border-primary bg-primary text-primary-fg"
                        : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg"
                    )}
                  >
                    {isSelected ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
                    Section {sec.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        {Object.keys(grouped).length === 0 ? (
          <EmptyState compact icon={<Layers />} title="No sections yet" description="Create departments and classes first." />
        ) : null}
      </DialogBody>

      <DialogFooter className="flex-col items-stretch sm:justify-between">
        <span className="text-sm text-fg-muted" aria-live="polite">
          <span className="font-mono tabular-nums text-fg">{selectedIds.length}</span> selected
        </span>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isSaving} loadingText="Saving">
            Save assignments
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
