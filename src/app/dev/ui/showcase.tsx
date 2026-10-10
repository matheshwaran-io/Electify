"use client"

import * as React from "react"
import { toast } from "sonner"
import { BookOpen, Download, GraduationCap, LayoutDashboard, Plus, Settings, Trash2, Users } from "lucide-react"
import { Wordmark } from "@/components/brand"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/ui/status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { CommandPalette, type Command } from "@/components/ui/command-palette"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { AnimatedNumber, LiveIndicator, Meter, OccupancyRing, StatCard, seatState } from "@/components/ui/data-display"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Callout, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback"
import { Field, Input } from "@/components/ui/input"
import { Magnetic } from "@/components/ui/interactions"
import { Kbd, Shortcut } from "@/components/ui/kbd"
import { Avatar, PageHeader } from "@/components/ui/layout"
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Combobox, Select } from "@/components/ui/select"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip } from "@/components/ui/tooltip"

// Sample rows exist only on this dev page to exercise the components.
type Row = { id: string; name: string; reg: string; status: string; seats: number }
const SAMPLE: Row[] = Array.from({ length: 27 }, (_, i) => ({
  id: String(i),
  name: ["Aarav Menon", "Diya Krishnan", "Kabir Iyer", "Meera Pillai", "Rohan Das", "Sana Qureshi"][i % 6],
  reg: `RA25322410100${String(i + 10).padStart(2, "0")}`,
  status: i % 4 === 0 ? "NOT_REGISTERED" : "CONFIRMED",
  seats: (i * 7) % 40,
}))

const columns: Column<Row>[] = [
  { id: "name", header: "Student", cell: (r) => r.name, sortValue: (r) => r.name, searchValue: (r) => r.name, mobile: "title" },
  { id: "reg", header: "Register no.", cell: (r) => <span className="font-mono text-xs">{r.reg}</span>, searchValue: (r) => r.reg, mobile: "subtitle" },
  { id: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} size="sm" />, sortValue: (r) => r.status },
  { id: "seats", header: "Seats", align: "right", cell: (r) => r.seats, sortValue: (r) => r.seats },
]

function Panel({ dark, children }: { dark?: boolean; children: React.ReactNode }) {
  return (
    <div className={dark ? "dark" : undefined}>
      <div className="space-y-8 rounded-panel border border-border bg-canvas p-5 text-fg sm:p-6">{children}</div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium text-fg-subtle">{title}</h2>
      {children}
    </section>
  )
}

function Specimens() {
  const [seats, setSeats] = React.useState(31)
  const [sw, setSw] = React.useState(true)
  const [sel, setSel] = React.useState<string | null>("a")
  const [combo, setCombo] = React.useState<string | null>(null)
  const options = [
    { value: "a", label: "Section A", description: "MCA 2025" },
    { value: "b", label: "Section B", description: "MCA 2025" },
    { value: "c", label: "Section C", description: "MCA 2025" },
  ]
  return (
    <>
      <Group title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="brand">Confirm registration</Button>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">
            <Trash2 /> Delete
          </Button>
          <Button variant="destructive-soft">Reset</Button>
          <Button loading loadingText="Saving">
            Save
          </Button>
          <Tooltip content="Add elective" shortcut={<Kbd>N</Kbd>}>
            <Button variant="secondary" size="icon" aria-label="Add elective">
              <Plus />
            </Button>
          </Tooltip>
          <Magnetic>
            <Button variant="brand" size="lg">
              Magnetic CTA
            </Button>
          </Magnetic>
        </div>
      </Group>

      <Group title="Badges">
        <div className="flex flex-wrap gap-2">
          {["OPEN", "PUBLISHED", "DRAFT", "CLOSED", "VERIFICATION", "FINALIZED", "REVOKED", "CLASS_TUTOR"].map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
          <Badge tone="live" dot>
            Live
          </Badge>
        </div>
      </Group>

      <Group title="Form controls">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Register number" description="As printed on your ID card.">
            <Input placeholder="RA2532241010001" className="font-mono" />
          </Field>
          <Field label="SRM email" error="Use your @srmist.edu.in address.">
            <Input defaultValue="student@gmail.com" />
          </Field>
          <Field label="Section">
            <Select value={sel} onValueChange={setSel} options={options} />
          </Field>
          <Field label="Find a section">
            <Combobox value={combo} onValueChange={setCombo} options={options} placeholder="Type to filter" />
          </Field>
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox defaultChecked /> Eligible
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={sw} onCheckedChange={setSw} /> Maintenance mode
          </label>
        </div>
      </Group>

      <Group title="Tabs">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="subjects">Subjects</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="pt-3 text-sm text-fg-muted">
            Overview panel
          </TabsContent>
          <TabsContent value="students" className="pt-3 text-sm text-fg-muted">
            Students panel
          </TabsContent>
          <TabsContent value="subjects" className="pt-3 text-sm text-fg-muted">
            Subjects panel
          </TabsContent>
        </Tabs>
        <Tabs defaultValue="all">
          <TabsList variant="pill" className="w-fit">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
          </TabsList>
        </Tabs>
      </Group>

      <Group title="Data display">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Registered" value={58} suffix="/ 70" meter={{ value: 58, max: 70 }} />
          <StatCard label="Seats allocated" value={116} hint="of 140 seats" />
          <StatCard label="Full electives" value={2} />
        </div>
        <Card padded spotlight className="flex items-center gap-4">
          <OccupancyRing filled={40 - seats} total={40} state={seatState(seats, 40)} size={52}>
            <span className="font-mono text-xs font-semibold tabular-nums">
              <AnimatedNumber value={seats} tabular />
            </span>
          </OccupancyRing>
          <div className="flex-1">
            <p className="text-sm font-medium">Seats left update in place</p>
            <Meter className="mt-2" value={40 - seats} max={40} label="Seats filled" tone={seatState(seats, 40) === "low" ? "warning" : "primary"} />
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" onClick={() => setSeats((s) => Math.max(0, s - 5))}>
              Take 5
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSeats(31)}>
              Reset
            </Button>
          </div>
        </Card>
        <div className="flex flex-wrap gap-4">
          <LiveIndicator state="live" />
          <LiveIndicator state="connecting" />
          <LiveIndicator state="offline" />
          <Shortcut keys={["mod", "K"]} />
          <Avatar name="Meera Pillai" />
        </div>
      </Group>

      <Group title="Feedback">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Professional Elective I</CardTitle>
              <CardDescription>Pick exactly one.</CardDescription>
            </div>
            <Badge>3 credits</Badge>
          </CardHeader>
          <CardContent className="text-sm text-fg-muted">Card body content.</CardContent>
        </Card>
        <Callout tone="warning" title="Registration closes in 12 minutes">
          Students still pending will need manual registration after the window closes.
        </Callout>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <EmptyState compact icon={<BookOpen />} title="No electives yet" description="Add a group, then add electives to it." action={<Button size="sm">Add group</Button>} />
          </Card>
          <Card>
            <ErrorState onRetry={() => toast("Retrying")} />
          </Card>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Group>
    </>
  )
}

export function Showcase() {
  const [confirm, setConfirm] = React.useState(false)
  const [palette, setPalette] = React.useState(false)

  const commands: Command[] = [
    { id: "d", group: "Navigate", label: "Dashboard", icon: <LayoutDashboard />, shortcut: ["G", "D"], perform: () => toast("Dashboard") },
    { id: "s", group: "Navigate", label: "Students & sections", icon: <GraduationCap />, perform: () => toast("Students") },
    { id: "u", group: "Navigate", label: "User access", icon: <Users />, perform: () => toast("Users") },
    { id: "t", group: "Actions", label: "Open settings", icon: <Settings />, perform: () => toast("Settings") },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <PageHeader
        title="Component system"
        description="Every primitive in both themes. Development only."
        meta={<Wordmark size="sm" />}
        actions={
          <>
            <ThemeToggle />
            <Button variant="secondary" onClick={() => setPalette(true)}>
              Command palette <Shortcut keys={["mod", "K"]} />
            </Button>
            <Dialog>
              <DialogTrigger render={<Button variant="secondary" />}>Dialog</DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add elective</DialogTitle>
                  <DialogDescription>Seats can be raised later but not below the number already booked.</DialogDescription>
                </DialogHeader>
                <DialogBody className="space-y-4">
                  <Field label="Course name">
                    <Input placeholder="Applied Machine Learning" />
                  </Field>
                </DialogBody>
                <DialogFooter>
                  <Button variant="secondary">Cancel</Button>
                  <Button>Add elective</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Sheet swipeDirection="right">
              <SheetTrigger render={<Button variant="secondary" />}>Sheet</SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Elective details</SheetTitle>
                  <SheetDescription>Swipe right or press Escape to close.</SheetDescription>
                </SheetHeader>
                <SheetBody className="text-sm text-fg-muted">Detail content</SheetBody>
              </SheetContent>
            </Sheet>
            <Button variant="destructive-soft" onClick={() => setConfirm(true)}>
              Confirm dialog
            </Button>
            <Menu>
              <MenuTrigger render={<Button variant="secondary" />}>Menu</MenuTrigger>
              <MenuContent>
                <MenuItem>
                  <Download /> Export CSV
                </MenuItem>
                <MenuItem>
                  <Download /> Export PDF
                </MenuItem>
                <MenuSeparator />
                <MenuItem tone="danger">
                  <Trash2 /> Delete
                </MenuItem>
              </MenuContent>
            </Menu>
            <Popover>
              <PopoverTrigger render={<Button variant="secondary" />}>Popover</PopoverTrigger>
              <PopoverContent className="w-64 p-3 text-sm">Popover content</PopoverContent>
            </Popover>
            <Button variant="secondary" onClick={() => toast.success("Registration window extended by 15 minutes")}>
              Toast
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <Specimens />
        </Panel>
        <Panel dark>
          <Specimens />
        </Panel>
      </div>

      <DataTable
        caption="Sample students"
        data={SAMPLE}
        columns={columns}
        getRowId={(r) => r.id}
        selectable
        searchPlaceholder="Search name or register number"
        filters={[
          {
            id: "status",
            label: "Status",
            options: [
              { value: "CONFIRMED", label: "Confirmed" },
              { value: "NOT_REGISTERED", label: "Pending" },
            ],
            predicate: (r, v) => r.status === v,
          },
        ]}
        bulkActions={(rows, clear) => (
          <Button size="sm" variant="destructive-soft" onClick={() => (toast(`${rows.length} selected`), clear())}>
            Delete
          </Button>
        )}
        renderExpanded={(r) => <p className="text-sm text-fg-muted">Expanded details for {r.name}</p>}
        pageSize={10}
        urlKey="demo"
      />

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        tone="danger"
        title="Reset section registrations?"
        description="Every student in Section A goes back to pending and their seats are released."
        impact={[
          { label: "Registrations cleared", value: 58, tone: "danger" },
          { label: "Seats released", value: 116 },
        ]}
        requireText="RESET"
        confirmLabel="Reset registrations"
        onConfirm={() => new Promise((r) => setTimeout(r, 900))}
      />
      <CommandPalette open={palette} onOpenChange={setPalette} commands={commands} />
    </div>
  )
}
