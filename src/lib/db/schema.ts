import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ────────────────────────────────────────────────────────────────────
// MASTER DATA
// ────────────────────────────────────────────────────────────────────

export const faculties = pgTable("faculties", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  facultyId: uuid("faculty_id")
    .notNull()
    .references(() => faculties.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const programmes = pgTable("programmes", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  degreeType: text("degree_type"), // "UG" | "PG"
  departmentId: uuid("department_id")
    .notNull()
    .references(() => departments.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const academicBatches = pgTable(
  "academic_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    year: text("year").notNull(), // e.g. "2025", "2026"
    programmeId: uuid("programme_id")
      .notNull()
      .references(() => programmes.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [unique("academic_batches_year_programme_unique").on(table.year, table.programmeId)]
);

export const sections = pgTable(
  "sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    label: text("label").notNull(), // e.g. "A", "B"
    academicBatchId: uuid("academic_batch_id")
      .notNull()
      .references(() => academicBatches.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique("sections_label_batch_unique").on(table.label, table.academicBatchId)]
);

// ────────────────────────────────────────────────────────────────────
// USERS (Single table, all 4 roles)
// ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(), // SYSTEM_ADMIN | COURSE_COORDINATOR | CLASS_TUTOR | STUDENT
  employeeId: text("employee_id").unique(), // staff only
  registerNumber: text("register_number").unique(), // students only
  phone: text("phone"),
  facultyId: uuid("faculty_id").references(() => faculties.id),
  departmentId: uuid("department_id").references(() => departments.id),
  programmeId: uuid("programme_id").references(() => programmes.id),
  academicBatchId: uuid("academic_batch_id").references(() => academicBatches.id),
  sectionId: uuid("section_id").references(() => sections.id),
  isActive: boolean("is_active").default(true).notNull(),
  isEligible: boolean("is_eligible").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ────────────────────────────────────────────────────────────────────
// INVITE SYSTEM
// ────────────────────────────────────────────────────────────────────

export const inviteCodes = pgTable("invite_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  role: text("role").notNull(), // COURSE_COORDINATOR | CLASS_TUTOR
  facultyId: uuid("faculty_id").references(() => faculties.id),
  departmentId: uuid("department_id").references(() => departments.id),
  programmeId: uuid("programme_id").references(() => programmes.id),
  academicBatchId: uuid("academic_batch_id").references(() => academicBatches.id),
  sectionId: uuid("section_id").references(() => sections.id),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  maxUses: integer("max_uses").default(1).notNull(),
  usedCount: integer("used_count").default(0).notNull(),
  status: text("status").default("ACTIVE").notNull(), // ACTIVE | USED | EXPIRED | REVOKED
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ────────────────────────────────────────────────────────────────────
// REGISTRATION EVENTS (Center of the system)
// ────────────────────────────────────────────────────────────────────

export const registrationEvents = pgTable("registration_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  academicYear: text("academic_year"), // e.g. "2026-2027" for the event period
  academicBatchId: uuid("academic_batch_id")
    .notNull()
    .references(() => academicBatches.id),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id),
  openDate: timestamp("open_date"),
  closeDate: timestamp("close_date"),
  status: text("status").default("DRAFT").notNull(),
  // DRAFT | PUBLISHED | OPEN | CLOSED | VERIFICATION | FINALIZED | ARCHIVED
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const eventSections = pgTable(
  "event_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => registrationEvents.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id),
  },
  (table) => [unique("event_sections_unique").on(table.eventId, table.sectionId)]
);

export const eventStudents = pgTable(
  "event_students",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => registrationEvents.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
  },
  (table) => [unique("event_students_unique").on(table.eventId, table.studentId)]
);

// ────────────────────────────────────────────────────────────────────
// ELECTIVE GROUPS & ELECTIVES
// ────────────────────────────────────────────────────────────────────

export const electiveGroups = pgTable("elective_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => registrationEvents.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "Professional Electives", "Open Electives", etc.
  minChoices: integer("min_choices").default(1).notNull(),
  maxChoices: integer("max_choices").default(1).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const electives = pgTable("electives", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => electiveGroups.id, { onDelete: "cascade" }),
  courseCode: text("course_code"),
  name: text("name").notNull(),
  credits: integer("credits").default(3).notNull(),
  description: text("description"),
  maxSeats: integer("max_seats").notNull(),
  availableSeats: integer("available_seats").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isFull: boolean("is_full").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ────────────────────────────────────────────────────────────────────
// STUDENT REGISTRATIONS
// ────────────────────────────────────────────────────────────────────

export const studentRegistrations = pgTable(
  "student_registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => registrationEvents.id),
    groupId: uuid("group_id")
      .notNull()
      .references(() => electiveGroups.id),
    electiveId: uuid("elective_id")
      .notNull()
      .references(() => electives.id),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("student_registrations_unique").on(table.studentId, table.eventId, table.groupId),
  ]
);

// ────────────────────────────────────────────────────────────────────
// EVENT TEMPLATES
// ────────────────────────────────────────────────────────────────────

export const eventTemplates = pgTable("event_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  programmeId: uuid("programme_id")
    .notNull()
    .references(() => programmes.id),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const templateGroups = pgTable("template_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => eventTemplates.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  minChoices: integer("min_choices").default(1).notNull(),
  maxChoices: integer("max_choices").default(1).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const templateElectives = pgTable("template_electives", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => templateGroups.id, { onDelete: "cascade" }),
  courseCode: text("course_code"),
  name: text("name").notNull(),
  credits: integer("credits").default(3).notNull(),
  description: text("description"),
  defaultMaxSeats: integer("default_max_seats").default(40).notNull(),
});

// ────────────────────────────────────────────────────────────────────
// AUDIT & SECURITY
// ────────────────────────────────────────────────────────────────────

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: text("action").notNull(),
  userId: uuid("user_id"),
  userEmail: text("user_email"),
  userRole: text("user_role"),
  ipAddress: text("ip_address"),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const loginAttempts = pgTable("login_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  identifier: text("identifier").notNull().unique(),
  ip: text("ip").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  lockoutUntil: timestamp("lockout_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ────────────────────────────────────────────────────────────────────
// SYSTEM SETTINGS
// ────────────────────────────────────────────────────────────────────

export const systemSettings = pgTable("system_settings", {
  id: text("id").primaryKey().default("system"),
  maintenanceMode: boolean("maintenance_mode").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ────────────────────────────────────────────────────────────────────
// RELATIONS (for Drizzle relational queries)
// ────────────────────────────────────────────────────────────────────

export const facultiesRelations = relations(faculties, ({ many }) => ({
  departments: many(departments),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  faculty: one(faculties, {
    fields: [departments.facultyId],
    references: [faculties.id],
  }),
  programmes: many(programmes),
}));

export const programmesRelations = relations(programmes, ({ one, many }) => ({
  department: one(departments, {
    fields: [programmes.departmentId],
    references: [departments.id],
  }),
  sections: many(sections),
  registrationEvents: many(registrationEvents),
  eventTemplates: many(eventTemplates),
}));

export const academicBatchesRelations = relations(academicBatches, ({ one, many }) => ({
  programme: one(programmes, {
    fields: [academicBatches.programmeId],
    references: [programmes.id],
  }),
  sections: many(sections),
}));

export const sectionsRelations = relations(sections, ({ one }) => ({
  academicBatch: one(academicBatches, {
    fields: [sections.academicBatchId],
    references: [academicBatches.id],
  }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  faculty: one(faculties, {
    fields: [users.facultyId],
    references: [faculties.id],
  }),
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  programme: one(programmes, {
    fields: [users.programmeId],
    references: [programmes.id],
  }),
  academicBatch: one(academicBatches, {
    fields: [users.academicBatchId],
    references: [academicBatches.id],
  }),
  section: one(sections, {
    fields: [users.sectionId],
    references: [sections.id],
  }),
}));

export const registrationEventsRelations = relations(registrationEvents, ({ one, many }) => ({
  academicBatch: one(academicBatches, {
    fields: [registrationEvents.academicBatchId],
    references: [academicBatches.id],
  }),
  createdBy: one(users, {
    fields: [registrationEvents.createdById],
    references: [users.id],
  }),
  eventSections: many(eventSections),
  eventStudents: many(eventStudents),
  electiveGroups: many(electiveGroups),
  studentRegistrations: many(studentRegistrations),
}));

export const eventSectionsRelations = relations(eventSections, ({ one }) => ({
  event: one(registrationEvents, {
    fields: [eventSections.eventId],
    references: [registrationEvents.id],
  }),
  section: one(sections, {
    fields: [eventSections.sectionId],
    references: [sections.id],
  }),
}));

export const eventStudentsRelations = relations(eventStudents, ({ one }) => ({
  event: one(registrationEvents, {
    fields: [eventStudents.eventId],
    references: [registrationEvents.id],
  }),
  student: one(users, {
    fields: [eventStudents.studentId],
    references: [users.id],
  }),
}));

export const electiveGroupsRelations = relations(electiveGroups, ({ one, many }) => ({
  event: one(registrationEvents, {
    fields: [electiveGroups.eventId],
    references: [registrationEvents.id],
  }),
  electives: many(electives),
}));

export const electivesRelations = relations(electives, ({ one }) => ({
  group: one(electiveGroups, {
    fields: [electives.groupId],
    references: [electiveGroups.id],
  }),
}));

export const studentRegistrationsRelations = relations(studentRegistrations, ({ one }) => ({
  student: one(users, {
    fields: [studentRegistrations.studentId],
    references: [users.id],
  }),
  event: one(registrationEvents, {
    fields: [studentRegistrations.eventId],
    references: [registrationEvents.id],
  }),
  group: one(electiveGroups, {
    fields: [studentRegistrations.groupId],
    references: [electiveGroups.id],
  }),
  elective: one(electives, {
    fields: [studentRegistrations.electiveId],
    references: [electives.id],
  }),
}));

export const eventTemplatesRelations = relations(eventTemplates, ({ one, many }) => ({
  programme: one(programmes, {
    fields: [eventTemplates.programmeId],
    references: [programmes.id],
  }),
  createdBy: one(users, {
    fields: [eventTemplates.createdById],
    references: [users.id],
  }),
  groups: many(templateGroups),
}));

export const templateGroupsRelations = relations(templateGroups, ({ one, many }) => ({
  template: one(eventTemplates, {
    fields: [templateGroups.templateId],
    references: [eventTemplates.id],
  }),
  electives: many(templateElectives),
}));

export const templateElectivesRelations = relations(templateElectives, ({ one }) => ({
  group: one(templateGroups, {
    fields: [templateElectives.groupId],
    references: [templateGroups.id],
  }),
}));

export const inviteCodesRelations = relations(inviteCodes, ({ one }) => ({
  faculty: one(faculties, {
    fields: [inviteCodes.facultyId],
    references: [faculties.id],
  }),
  department: one(departments, {
    fields: [inviteCodes.departmentId],
    references: [departments.id],
  }),
  programme: one(programmes, {
    fields: [inviteCodes.programmeId],
    references: [programmes.id],
  }),
  section: one(sections, {
    fields: [inviteCodes.sectionId],
    references: [sections.id],
  }),
  createdBy: one(users, {
    fields: [inviteCodes.createdById],
    references: [users.id],
  }),
}));
