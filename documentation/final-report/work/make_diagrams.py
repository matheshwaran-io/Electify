"""Diagrams for the Electify mini-project report (matplotlib, 300 dpi PNG).

Every element drawn here corresponds to code in the repository; see the
captions in build_report.py for the files each diagram summarises.
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import FancyBboxPatch, Polygon, FancyArrowPatch

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "figures")
os.makedirs(OUT, exist_ok=True)

for f in ("Arial.ttf", "Arial Bold.ttf", "Arial Italic.ttf"):
    p = "/System/Library/Fonts/Supplemental/" + f
    if os.path.exists(p):
        font_manager.fontManager.addfont(p)
plt.rcParams.update({"font.family": "Arial", "font.size": 9, "svg.fonttype": "none"})

NAVY = "#1F3864"
INK = "#2B2B2B"
LINE = "#44546A"
MUTED = "#6B7280"
FILL = {
    "blue": ("#EAF0FA", "#2F5597"),
    "green": ("#EAF5EC", "#3A7D44"),
    "amber": ("#FFF4E0", "#B7791F"),
    "purple": ("#F1ECF9", "#6B4FA0"),
    "grey": ("#F3F4F6", "#6B7280"),
    "red": ("#FCEDEC", "#B4413A"),
    "navy": (NAVY, NAVY),
    "white": ("#FFFFFF", "#44546A"),
}


def canvas(w, h, title=None):
    fig = plt.figure(figsize=(w, h))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, w * 10)
    ax.set_ylim(0, h * 10)
    ax.axis("off")
    if title:
        ax.text(w * 5, h * 10 - 3, title, ha="center", va="top", fontsize=12, fontweight="bold", color=NAVY)
    return fig, ax


def box(ax, x, y, w, h, text, color="blue", size=8.5, bold=False, sub=None, align="center", radius=1.2, lw=1.1, ls="-"):
    """Rounded box centred at (x, y)."""
    face, edge = FILL[color]
    ax.add_patch(FancyBboxPatch((x - w / 2, y - h / 2), w, h, boxstyle=f"round,pad=0,rounding_size={radius}",
                                fc=face, ec=edge, lw=lw, ls=ls, zorder=2))
    tc = "white" if color == "navy" else INK
    if sub:
        ax.text(x, y + 1.3, text, ha="center", va="center", fontsize=size, fontweight="bold", color=tc, zorder=3)
        ax.text(x, y - 1.6, sub, ha="center", va="center", fontsize=size - 1.3, color=tc if color == "navy" else MUTED, zorder=3, linespacing=1.25)
    else:
        ha = {"center": "center", "left": "left"}[align]
        tx = x if align == "center" else x - w / 2 + 1.5
        ax.text(tx, y, text, ha=ha, va="center", fontsize=size, fontweight="bold" if bold else "normal", color=tc, zorder=3, linespacing=1.3)


def diamond(ax, x, y, w, h, text, size=8):
    face, edge = FILL["amber"]
    ax.add_patch(Polygon([(x, y + h / 2), (x + w / 2, y), (x, y - h / 2), (x - w / 2, y)], closed=True, fc=face, ec=edge, lw=1.1, zorder=2))
    ax.text(x, y, text, ha="center", va="center", fontsize=size, color=INK, zorder=3, linespacing=1.2)


def terminal(ax, x, y, w, h, text, color="navy", size=8.5):
    face, edge = FILL[color]
    ax.add_patch(FancyBboxPatch((x - w / 2, y - h / 2), w, h, boxstyle=f"round,pad=0,rounding_size={h / 2}", fc=face, ec=edge, lw=1.1, zorder=2))
    ax.text(x, y, text, ha="center", va="center", fontsize=size, fontweight="bold", color="white" if color == "navy" else INK, zorder=3)


def store(ax, x, y, w, h, text, size=8):
    """Open-ended data store (DFD notation)."""
    face, edge = FILL["grey"]
    ax.add_patch(FancyBboxPatch((x - w / 2, y - h / 2), w, h, boxstyle="square,pad=0", fc=face, ec="none", zorder=2))
    ax.plot([x - w / 2, x + w / 2], [y + h / 2, y + h / 2], color=edge, lw=1.1, zorder=3)
    ax.plot([x - w / 2, x + w / 2], [y - h / 2, y - h / 2], color=edge, lw=1.1, zorder=3)
    ax.plot([x - w / 2, x - w / 2], [y - h / 2, y + h / 2], color=edge, lw=1.1, zorder=3)
    ax.text(x, y, text, ha="center", va="center", fontsize=size, color=INK, zorder=4)


def arrow(ax, pts, label=None, lpos=None, color=LINE, ls="-", lw=1.0, both=False, lsize=7.3, lha="center"):
    """Polyline arrow through pts; arrowhead at the last point."""
    xs, ys = zip(*pts)
    if len(pts) > 2:
        ax.plot(xs[:-1], ys[:-1], color=color, lw=lw, ls=ls, zorder=1, solid_capstyle="butt")
    style = "<|-|>" if both else "-|>"
    ax.add_patch(FancyArrowPatch(pts[-2], pts[-1], arrowstyle=style, mutation_scale=9, color=color, lw=lw, ls=ls, zorder=1, shrinkA=0, shrinkB=0))
    if label:
        if lpos is None:
            (x1, y1), (x2, y2) = pts[len(pts) // 2 - 1], pts[len(pts) // 2]
            lpos = ((x1 + x2) / 2, (y1 + y2) / 2)
        ax.text(lpos[0], lpos[1], label, ha=lha, va="center", fontsize=lsize, color=MUTED, zorder=5,
                bbox=dict(boxstyle="round,pad=0.18", fc="white", ec="none"))


def band(ax, x, y, w, h, label, color="#F8FAFD"):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=1.5", fc=color, ec="#D5DCE8", lw=0.9, zorder=0))
    ax.text(x + 1.5, y + h - 1.6, label, ha="left", va="top", fontsize=7.6, fontweight="bold", color=NAVY, zorder=1)


def save(fig, name):
    fig.savefig(os.path.join(OUT, name + ".png"), dpi=300, facecolor="white")
    plt.close(fig)
    print("wrote", name)


# ────────────────────────────────────────────────────────────── 4.1 Architecture
def architecture():
    fig, ax = canvas(10, 7.4)
    band(ax, 2, 60, 74, 12, "CLIENT TIER (browser)")
    box(ax, 18, 65, 26, 6.2, "Student portal", sub="login · join class · subjects · picker · receipt")
    box(ax, 55, 65, 34, 6.2, "Staff portal", sub="Year Server selection · class tools · monitor · reports · admin")
    band(ax, 2, 47.5, 74, 10.5, "EDGE")
    box(ax, 40, 51.8, 62, 4.6, "src/proxy.ts  —  verifies the electify_session JWT, applies role route guards, forwards the pathname", color="white", size=7.8)
    band(ax, 2, 18, 74, 27.5, "APPLICATION TIER")
    box(ax, 15, 37.5, 22, 6, "Server Components", sub="Next.js App Router pages")
    box(ax, 39.5, 37.5, 22, 6, "Server Actions", sub="src/app/actions/*.ts")
    box(ax, 64, 37.5, 21, 6, "Route handlers", sub="/api/health · /api/switch-section")
    box(ax, 39.5, 26.5, 68, 9.5, "", color="purple")
    ax.text(39.5, 29.6, "Domain modules (src/lib)", ha="center", va="center", fontsize=8.5, fontweight="bold", color=INK, zorder=3)
    mods = ["auth.ts\nJWT · single session", "workspace.ts\nstaff scope", "student-events.ts\neligibility", "registration-window.ts\nopen / closed rule", "seat-ops.ts\ntakeSeat · releaseSeat", "password-policy.ts\nbcrypt rules"]
    for i, m in enumerate(mods):
        box(ax, 11 + i * 11.4, 25, 10.6, 4.6, m, color="white", size=6.4, radius=0.8)
    for x in (15, 39.5, 64):
        arrow(ax, [(x, 34.5), (x, 31.3)])
    arrow(ax, [(24, 40.5), (24, 49.5)], both=True)
    arrow(ax, [(39.5, 40.5), (39.5, 49.5)], both=True)
    band(ax, 2, 2, 74, 14, "DATA TIER")
    box(ax, 20, 8.5, 30, 7, "Drizzle ORM + node-postgres pool", sub="typed queries · db.transaction()", color="green")
    box(ax, 56, 8.5, 34, 7, "PostgreSQL", sub="FK / CHECK / UNIQUE constraints · SELECT … FOR UPDATE", color="green")
    arrow(ax, [(35, 8.5), (39, 8.5)])
    arrow(ax, [(39.5, 21.7), (39.5, 17), (20, 17), (20, 12)], label="SQL in transactions", lpos=(30, 17))
    for x in (18, 55):
        arrow(ax, [(x, 61.9), (x, 54.1)], both=True)
    ax.text(19.5, 58.9, "HTTPS · httpOnly session cookie", fontsize=7, color=MUTED, ha="left", va="center")
    box(ax, 88.5, 37, 19, 14, "", color="amber")
    ax.text(88.5, 41.3, "Supabase Realtime", ha="center", va="center", fontsize=8.5, fontweight="bold", color=INK, zorder=3)
    ax.text(88.5, 35.6, "postgres_changes on\nelectives and\nstudent_registrations;\npresence channel", ha="center", va="center", fontsize=7.2, color=MUTED, zorder=3, linespacing=1.25)
    arrow(ax, [(73, 8.5), (88.5, 8.5), (88.5, 30)], label="change feed", lpos=(88.5, 19), ls="--")
    arrow(ax, [(88.5, 44), (88.5, 65), (72, 65)], label="WebSocket", lpos=(88.5, 55), ls="--")
    ax.text(88.5, 3.5, "Dashed: optional live updates;\npages also refresh on their own.", ha="center", fontsize=6.6, color=MUTED)
    save(fig, "fig_architecture")


# ────────────────────────────────────────────────────────────── 4.2 DFD level 1
def dfd():
    fig, ax = canvas(10, 7.2)
    ext = dict(color="navy", size=8.2)
    box(ax, 9, 62, 14, 6, "Student", **ext)
    box(ax, 9, 30, 14, 6, "Class Tutor", **ext)
    box(ax, 91, 62, 14, 6, "Course\nCoordinator", **ext)
    box(ax, 91, 9, 14, 6, "System\nAdministrator", **ext)
    def proc(x, y, t):
        ax.add_patch(FancyBboxPatch((x - 9.5, y - 4.2), 19, 8.4, boxstyle="round,pad=0,rounding_size=4", fc=FILL["blue"][0], ec=FILL["blue"][1], lw=1.2, zorder=2))
        ax.text(x, y, t, ha="center", va="center", fontsize=7.6, color=INK, zorder=3, linespacing=1.25)
    proc(31, 62, "1.0  Authenticate &\nonboard students")
    proc(69, 62, "2.0  Configure events,\nsubjects & quotas")
    proc(31, 30, "3.0  Register, change,\ncancel electives")
    proc(69, 30, "4.0  Monitor, report\n& replay")
    proc(69, 9, "5.0  Manage Year Servers,\ncohorts & accounts")
    store(ax, 50, 64, 14, 3.6, "D1  users · codes", size=6.7)
    store(ax, 50, 50, 14, 3.6, "D2  events · subjects", size=6.7)
    store(ax, 50, 31, 14, 3.6, "D3  registrations", size=6.7)
    store(ax, 50, 21, 14, 3.6, "D4  replay · audit", size=6.7)
    store(ax, 50, 9, 14, 3.6, "D5  sessions · classes", size=6.7)
    arrow(ax, [(16, 62), (21.5, 62)], both=True, label="credentials,\nclass code / session", lpos=(18.7, 68.5))
    arrow(ax, [(40.5, 64), (43, 64)], both=True)
    arrow(ax, [(12, 59), (12, 40), (26, 40), (26, 34.2)], both=True, label="selections / receipt", lpos=(12, 49))
    arrow(ax, [(16, 30), (21.5, 30)], label="manual\nregistration", lpos=(18.7, 25))
    arrow(ax, [(84, 62), (78.5, 62)], label="events, baskets,\nseats, quotas", lpos=(81.3, 68.5))
    arrow(ax, [(65, 57.8), (65, 50), (57, 50)])
    arrow(ax, [(43, 50), (36, 50), (36, 34.2)], label="offerings, capacity", lpos=(36, 44))
    arrow(ax, [(40.5, 31), (43, 31)])
    arrow(ax, [(31, 25.8), (31, 21), (43, 21)], label="replay, audit", lpos=(35.5, 21))
    arrow(ax, [(57, 31), (59.5, 31)])
    arrow(ax, [(57, 21), (65, 21), (65, 25.8)])
    arrow(ax, [(73, 34.2), (73, 42), (91, 42), (91, 59)], label="live monitor, reports", lpos=(82, 42))
    arrow(ax, [(63, 25.8), (63, 16), (9, 16), (9, 27)], label="class reports", lpos=(20, 16))
    arrow(ax, [(84, 9), (78.5, 9)], label="years, cohorts,\naccounts", lpos=(81.3, 14.5))
    arrow(ax, [(59.5, 9), (57, 9)])
    arrow(ax, [(43, 9), (27, 9), (27, 25.8)], label="class & cohort\n(eligibility)", lpos=(34, 11.8))
    save(fig, "fig_dfd")


# ────────────────────────────────────────────────────────────── 4.3 ER diagram
def er():
    fig, ax = canvas(10, 8.0)
    def ent(x, y, name, cols, color="blue", w=19):
        h = 3 + 2.15 * len(cols)
        face, edge = FILL[color]
        ax.add_patch(FancyBboxPatch((x - w / 2, y - h), w, h, boxstyle="round,pad=0,rounding_size=0.8", fc="white", ec=edge, lw=1.1, zorder=2))
        ax.add_patch(FancyBboxPatch((x - w / 2, y - 3), w, 3, boxstyle="round,pad=0,rounding_size=0.8", fc=face, ec=edge, lw=1.1, zorder=3))
        ax.text(x, y - 1.5, name, ha="center", va="center", fontsize=7.6, fontweight="bold", color=INK, zorder=4)
        for i, c in enumerate(cols):
            ax.text(x - w / 2 + 1, y - 4.2 - i * 2.15, c, ha="left", va="center", fontsize=6.2, color=INK if not c.startswith("FK") else MUTED, zorder=4)
    ent(11, 78, "faculties", ["PK id", "code (unique)"])
    ent(11, 65, "departments", ["PK id", "FK faculty_id"])
    ent(11, 52, "programmes", ["PK id", "FK department_id", "duration_years"])
    ent(11, 37, "academic_batches", ["PK id", "FK programme_id", "admission_year", "expected_end_year"], "green")
    ent(11, 19.5, "sections", ["PK id", "FK academic_batch_id", "label (unique per batch)"], "green")
    ent(36, 78, "academic_sessions", ["PK id", "start_year, end_year", "status"], "green")
    ent(36, 62, "cohort_session_terms", ["PK id", "FK batch_id, session_id", "study_year, semester"], "green")
    ent(36, 42, "users", ["PK id", "role", "register_number (unique)", "FK academic_batch_id", "FK section_id", "current_session_id"], "purple")
    ent(36, 19.5, "tutor_sections", ["PK id", "FK tutor_id, section_id"], "purple")
    ent(36, 9, "invite_codes", ["code, role, max_uses", "FK section_id"], "purple")
    ent(62, 78, "registration_events", ["PK id", "FK academic_batch_id", "FK academic_session_id", "status, open/close_date"], "amber")
    ent(62, 61, "event_sections", ["FK (event_id, batch_id)", "FK (section_id, batch_id)"], "amber")
    ent(62, 49, "elective_groups", ["PK id", "FK event_id", "min/max_choices"], "amber")
    ent(62, 35, "electives", ["PK id", "FK group_id", "max_seats", "available_seats ≥ 0"], "amber")
    ent(62, 17.5, "elective_seat_allocations", ["FK elective_id", "FK section_id (class quota)", "available_seats ≥ 0"], "amber", w=21)
    ent(88, 78, "registrations", ["PK id", "FK student_id, event_id", "status, receipt_number", "receipt_snapshot (jsonb)"], "red")
    ent(88, 59, "student_registrations", ["FK student, event, group", "FK elective_id", "status", "unique(student, event, group)"], "red", w=20)
    ent(88, 36, "replay_events", ["FK registration_event_id", "FK subject_id (elective)", "event_type", "seat_before / seat_after"], "grey", w=20)
    ent(88, 16, "audit_logs", ["action, user_id, role", "old / new value, metadata"], "grey", w=20)

    def link(pts, c1="1", c2="N"):
        xs, ys = zip(*pts)
        ax.plot(xs, ys, color=LINE, lw=0.9, zorder=1)
        def lab(p, q, t):
            dx, dy = q[0] - p[0], q[1] - p[1]
            if abs(dx) > abs(dy):
                x = p[0] + (1.2 if dx > 0 else -1.2); y = p[1] + 1.0
                ax.text(x, y, t, fontsize=6.5, color=NAVY, fontweight="bold", ha="center", va="center", zorder=5)
            else:
                x = p[0] + 1.0; y = p[1] + (1.4 if dy > 0 else -1.4)
                ax.text(x, y, t, fontsize=6.5, color=NAVY, fontweight="bold", ha="left", va="center", zorder=5)
        lab(pts[0], pts[1], c1)
        lab(pts[-1], pts[-2], c2)
    link([(11, 70.7), (11, 65)])
    link([(11, 57.7), (11, 52)])
    link([(11, 42.55), (11, 37)])
    link([(11, 25.4), (11, 19.5)])
    link([(36, 68.55), (36, 62)])
    link([(20.5, 33), (23, 33), (23, 57), (26.5, 57)])
    link([(20.5, 14), (24.5, 14), (24.5, 30), (26.5, 30)])
    link([(20.5, 10), (22, 10), (22, 5), (26.5, 5)])
    link([(36, 25.95), (36, 19.5)])
    link([(20.5, 31), (25.5, 31), (25.5, 46.5), (49.5, 46.5), (49.5, 70), (52.5, 70)])
    link([(45.5, 73), (52.5, 73)])
    link([(62, 66.4), (62, 61)])
    link([(71.5, 74), (73, 74), (73, 45), (71.5, 45)])
    link([(62, 39.55), (62, 35)])
    link([(62, 23.4), (62, 17.5)])
    link([(45.5, 36), (47.5, 36), (47.5, 37.7), (76, 37.7), (76, 72), (78.5, 72)])
    link([(88, 66.4), (88, 59)])
    link([(71.5, 27), (77, 27), (77, 50), (78, 50)])
    link([(71.5, 31), (74.5, 31), (74.5, 33), (78, 33)], "1", "N")
    save(fig, "fig_er")


# ────────────────────────────────────────────────────────────── 5.x onboarding
def onboarding():
    fig, ax = canvas(10, 8.6)
    W = 30
    terminal(ax, 25, 82, 26, 4.5, "Student opens /join")
    box(ax, 25, 74, W, 5, "Enter class signup code\n(e.g. EF-MCA-F-XXXX)")
    diamond(ax, 25, 63, 30, 9, "Code exists, role STUDENT,\nnot revoked or expired,\nuses < max_uses?")
    box(ax, 62, 63, 26, 5, "Show reason; no account\nis created", color="red")
    box(ax, 25, 52, W, 6, "Show class verified: cohort, programme,\ndepartment, tutor (from server records)", color="green")
    box(ax, 25, 42, W, 6, "Student enters e-mail, register number,\nname and a password")
    diamond(ax, 25, 31, 30, 9, "Register number / e-mail\nunused? Password meets\npolicy?")
    box(ax, 62, 31, 26, 5, "Reject with a specific message", color="red")
    box(ax, 25, 18.5, W + 4, 8, "One transaction:\n1. claim one use of the code (UPDATE … WHERE\n    used_count < max_uses AND status = 'ACTIVE')\n2. insert user with the code's class and cohort\n3. write STUDENT_CLASS_SIGNUP audit row", color="purple", size=7.4)
    terminal(ax, 25, 8, 30, 4.5, "Session started · student dashboard")
    arrow(ax, [(25, 79.7), (25, 76.5)])
    arrow(ax, [(25, 71.5), (25, 67.5)])
    arrow(ax, [(40, 63), (49, 63)], label="no", lpos=(44.5, 64.6))
    arrow(ax, [(25, 58.5), (25, 55)], label="yes", lpos=(28, 56.8))
    arrow(ax, [(25, 49), (25, 45)])
    arrow(ax, [(25, 39), (25, 35.5)])
    arrow(ax, [(40, 31), (49, 31)], label="no", lpos=(44.5, 32.6))
    arrow(ax, [(25, 26.5), (25, 22.5)], label="yes", lpos=(28, 24.5))
    arrow(ax, [(25, 14.5), (25, 10.25)])
    # Side notes
    ax.add_patch(FancyBboxPatch((52, 9), 44, 15, boxstyle="round,pad=0,rounding_size=1", fc="#FAFAFA", ec="#D5DCE8", lw=0.9))
    notes = ["Why the class is never taken from the form:",
             "• the code row names exactly one section; a CHECK",
             "  constraint requires a section for student codes",
             "• users_section_cohort_fk keeps section and cohort aligned",
             "• an existing student is never moved to another class",
             "• two simultaneous sign-ups cannot exceed max_uses",
             "• password hashed with bcrypt (cost 12)"]
    for i, t in enumerate(notes):
        ax.text(54, 22 - i * 1.9, t, fontsize=7.1, color=INK if i else NAVY, fontweight="bold" if i == 0 else "normal", va="center")
    save(fig, "fig_onboarding")


# ────────────────────────────────────────────────────────────── 5.x staff workspace
def workspace():
    fig, ax = canvas(10, 7.6)
    X = 25
    terminal(ax, X, 71, 28, 4.5, "Staff request to /faculty/*")
    box(ax, X, 63, 34, 5, "proxy.ts: valid JWT and staff role?")
    box(ax, X, 54, 34, 6, "getSession(): token's session id equals\nusers.current_session_id; account active")
    box(ax, X, 43.5, 34, 7, "loadStaffScope(): role read from users row\n(admin → all classes; coordinator → own\nprogramme + tutored; tutor → assigned)", color="purple", size=7.6)
    diamond(ax, X, 31, 32, 9.5, "Year Server chosen, and the\nchoice still valid for this user?")
    box(ax, 10, 18, 14, 6, "No Year Server\nin scope: notice", color="grey", size=7.2)
    box(ax, X, 18, 13, 6, "Yes: open\nthe workspace", color="green", size=7.6)
    box(ax, 40, 18, 14, 6, "No: Year\nServer chooser", color="amber", size=7.6)
    box(ax, X, 6.5, 40, 6, "Workspace = selected session + classes in scope;\ncookie value re-validated on every request", color="blue", size=7.8)
    for a, b in ((68.7, 65.5), (60.5, 57), (51, 47), (40, 35.75)):
        arrow(ax, [(X, a), (X, b)])
    arrow(ax, [(X - 9, 29), (10, 29), (10, 21)], label="none", lpos=(13.5, 29))
    arrow(ax, [(X, 26.25), (X, 21)], label="yes", lpos=(X + 2.2, 23.6))
    arrow(ax, [(X + 9, 29), (40, 29), (40, 21)], label="no", lpos=(37, 29))
    arrow(ax, [(X, 15), (X, 9.5)])
    arrow(ax, [(40, 15), (40, 12), (33, 12), (33, 9.5)], label="after choosing", lpos=(40, 12.6))
    band(ax, 52, 7, 45, 66, "CHECKS INSIDE EVERY SERVER ACTION")
    checks = [
        ("assertClass(ws, sectionId)", "class must be in the workspace; a cookie\nnever grants access"),
        ("assertEventInWorkspace(ws, eventId)", "event's targeted classes must be in scope"),
        ("assertElectiveInWorkspace / Group", "subjects and baskets belong to an\nin-scope event"),
        ("assertStudentsInWorkspace(ws, ids)", "bulk student operations are scoped"),
        ("loadAuthorizedResetRequest()", "tutors see resets for their own\nsections only"),
        ("Audit row per mutation", "user, role and metadata recorded"),
    ]
    for i, (a, b) in enumerate(checks):
        y = 63 - i * 9.6
        box(ax, 74.5, y, 41, 7.6, "", color="white", radius=0.8)
        ax.text(56, y + 1.6, a, fontsize=7.6, fontweight="bold", color=INK, va="center")
        ax.text(56, y - 1.5, b, fontsize=6.9, color=MUTED, va="center", linespacing=1.15)
    save(fig, "fig_workspace")


# ────────────────────────────────────────────────────────────── 5.x lifecycle
def lifecycle():
    fig, ax = canvas(10, 5.8)
    sub = {"UPCOMING": "derived: now < open_date", "OPEN": "status OPEN, or\nnow ≥ open_date", "CLOSED": "status CLOSED, or\nclose_date passed\n(auto-close on)"}
    S = {"DRAFT": (9, 38, "grey", 14), "PUBLISHED": (30, 38, "blue", 14), "UPCOMING": (30, 16, "blue", 16),
         "OPEN": (53, 38, "green", 14), "PAUSED": (60, 16, "amber", 14), "CLOSED": (78, 38, "red", 15), "ARCHIVED": (94, 38, "grey", 10)}
    for k, (x, y, c, w) in S.items():
        box(ax, x, y, w, 7.5 if k in sub else 5.5, k, color=c, sub=sub.get(k), size=8.2)
    arrow(ax, [(16, 38), (23, 38)], label="coordinator\npublishes", lpos=(19.5, 43.5))
    arrow(ax, [(30, 35.25), (30, 19.75)], label="before\nopen_date", lpos=(30, 27.5))
    arrow(ax, [(38, 17), (47, 17), (47, 34.25)], label="open_date\nreached", lpos=(42.5, 22.5))
    arrow(ax, [(37, 39.5), (46, 39.5)], label="manual open", lpos=(41.5, 43))
    arrow(ax, [(55, 34.25), (55, 18.75)], label="pause", lpos=(52, 26))
    arrow(ax, [(63, 18.75), (63, 34.25)], label="resume", lpos=(66.5, 26))
    arrow(ax, [(60, 38), (70.5, 38)], label="deadline or\nmanual close", lpos=(65.3, 43.5))
    arrow(ax, [(85.5, 38), (89, 38)])
    arrow(ax, [(67, 16), (78, 16), (78, 34)], label="close", lpos=(73, 16))
    arrow(ax, [(78, 42.25), (78, 48), (53, 48), (53, 42.25)], label="reopen (monitor / live window)", lpos=(65.5, 48), ls="--")
    box(ax, 80, 54, 30, 4, "VERIFICATION · FINALIZED: recognised as closed,\nbut no current action sets them", color="white", size=6.6, ls="--")
    ax.text(50, 4, "Students can submit, change or cancel only while the derived window state is OPEN (lib/registration-window.ts).\nThe same function drives the student pages and the server actions.", ha="center", fontsize=7, color=MUTED)
    save(fig, "fig_lifecycle")


# ────────────────────────────────────────────────────────────── 6.x registration transaction
def reg_txn():
    fig, ax = canvas(10, 9.4)
    L = 26
    terminal(ax, L, 90, 30, 4.4, "registerElectives(eventId, selections)")
    pre = [("Session is a STUDENT; maintenance off", 82.5), ("Student active and eligible", 76.5),
           ("Event targets the student's class & cohort", 70.5), ("Window OPEN on the server clock", 64.5),
           ("≤ 1 choice per group; groups belong to event", 58.5)]
    for t, y in pre:
        box(ax, L, y, 40, 4.2, t, size=7.8)
    for (t1, y1), (t2, y2) in zip(pre, pre[1:]):
        arrow(ax, [(L, y1 - 2.1), (L, y2 + 2.1)])
    arrow(ax, [(L, 87.8), (L, 84.6)])
    ax.plot([47.5, 48.5, 48.5, 47.5], [84.6, 84.6, 56.4, 56.4], color=NAVY, lw=0.9)
    ax.text(49.5, 70.5, "Checks before\nany lock is\ntaken", fontsize=7, color=NAVY, ha="left", va="center", fontweight="bold")
    band(ax, 5, 5, 46, 49, "BEGIN TRANSACTION", color="#F5F8F2")
    steps = [
        ("Lock registrations row (FOR UPDATE);\nreject if already CONFIRMED", 47.5),
        ("Re-check eligibility on the same snapshot", 40.5),
        ("Lock chosen electives in id order\n(FOR UPDATE) – avoids deadlocks", 33.5),
        ("For each choice: takeSeat()\n→ upsert student_registrations\n→ insert replay event", 25.5),
        ("Receipt number under advisory lock:\nELC-<year>-<term>-<sequence>", 16.5),
        ("Store receipt snapshot; audit row", 9.5),
    ]
    for t, y in steps:
        box(ax, 28, y, 40, 5.4 if "\n" in t else 4.2, t, color="white", size=7.4)
    for (t1, y1), (t2, y2) in zip(steps, steps[1:]):
        arrow(ax, [(28, y1 - (2.7 if "\n" in t1 else 2.1)), (28, y2 + (3.2 if t2.count("\n") > 1 else 2.7 if "\n" in t2 else 2.1))])
    arrow(ax, [(L, 56.4), (L, 50.2)])
    terminal(ax, 28, 1.8, 18, 3.2, "COMMIT", color="green", size=8)
    # takeSeat detail
    band(ax, 56, 30, 41, 40, "takeSeat(tx, elective, sectionId)  —  lib/seat-ops.ts", color="#FBF7EF")
    diamond(ax, 76.5, 61, 30, 7.5, "elective.available_seats > 0 ?", size=7.4)
    diamond(ax, 76.5, 50, 30, 7.5, "class has a quota row?", size=7.4)
    box(ax, 66, 39.5, 17, 7, "quota.available > 0\nthen decrement\nelective and quota", color="green", size=6.8)
    box(ax, 87.5, 39.5, 17, 7, "unreserved seats\n(available − Σ quotas)\n> 0, then decrement", color="green", size=6.8)
    box(ax, 76.5, 33, 34, 3.4, "otherwise throw SeatTakenError → ROLLBACK", color="red", size=6.8)
    arrow(ax, [(76.5, 57.25), (76.5, 53.75)], label="yes", lpos=(79, 55.5))
    arrow(ax, [(68, 50), (66, 50), (66, 43)], label="yes", lpos=(66, 47.5))
    arrow(ax, [(85, 50), (87.5, 50), (87.5, 43)], label="no", lpos=(87.5, 47.5))
    arrow(ax, [(91.5, 61), (95.5, 61), (95.5, 33), (93.5, 33)], label="no", lpos=(95.5, 52))
    arrow(ax, [(48, 25.5), (56, 25.5), (56, 30)], ls=":")
    # Failure note
    box(ax, 76.5, 17, 40, 15, "", color="white")
    ax.text(58, 22.5, "Failure behaviour", fontsize=8, fontweight="bold", color=NAVY)
    for i, t in enumerate(["• Any error rolls back every write: no seat,", "  choice, receipt or log survives a failed submit", "• CHECK (available_seats ≥ 0) is a final guard", "• The student keeps their picks and sees which", "  subject filled (code SEAT_TAKEN)"]):
        ax.text(58, 19.6 - i * 2.1, t, fontsize=7, color=INK)
    save(fig, "fig_registration_txn")


# ────────────────────────────────────────────────────────────── 6.x change & cancel
def change_cancel():
    fig, ax = canvas(10, 6.4)
    band(ax, 2, 10, 47, 52, "CHANGE  —  changeStudentElective()")
    band(ax, 51, 10, 47, 52, "CANCEL  —  cancelStudentElective() / cancelEntireRegistration()")
    a = [("Window open and allow_editing on", "blue"), ("Lock current choice (FOR UPDATE)", "white"),
         ("Lock old and new electives", "white"), ("takeSeat(new)  —  first", "green"),
         ("releaseSeat(old)  —  only after success", "amber"), ("Update choice and receipt snapshot;\nreplay STUDENT_CHANGED_CHOICE; audit", "white")]
    b = [("Window open (editing flag not required)", "blue"), ("Lock the choice; it must belong to\nthe student and not be CANCELLED", "white"),
         ("Lock elective row", "white"), ("releaseSeat(): LEAST(available + 1, max)\nfor the subject and the class quota", "amber"),
         ("Mark choice CANCELLED (row kept);\nparent CANCELLED if none remain", "white"), ("Receipt line marked [Cancelled];\nreplay and audit rows", "white")]
    for items, x in ((a, 25.5), (b, 74.5)):
        ys = [55 - i * 8.2 for i in range(len(items))]
        for (t, c), y in zip(items, ys):
            box(ax, x, y, 40, 5.6 if "\n" in t else 4.4, t, color=c, size=7.3)
        for y1, y2, (t1, _), (t2, _) in zip(ys, ys[1:], items, items[1:]):
            arrow(ax, [(x, y1 - (2.8 if "\n" in t1 else 2.2)), (x, y2 + (2.8 if "\n" in t2 else 2.2))])
    ax.text(25.5, 5.2, "If the new subject is full, SeatTakenError rolls the\ntransaction back and the student keeps the old seat.", ha="center", fontsize=7, color=MUTED)
    ax.text(74.5, 5.2, "Retrying a cancellation finds the row already\nCANCELLED, so a seat is never returned twice.", ha="center", fontsize=7, color=MUTED)
    save(fig, "fig_change_cancel")


# ────────────────────────────────────────────────────────────── main
if __name__ == "__main__":
    architecture(); dfd(); er(); onboarding(); workspace(); lifecycle(); reg_txn(); change_cancel()
