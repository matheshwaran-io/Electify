import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import os

os.makedirs("documentation/final-report/assets", exist_ok=True)
plt.rcParams['font.sans-serif'] = 'Helvetica'
plt.rcParams['axes.edgecolor'] = '#CBD5E1'
plt.rcParams['axes.linewidth'] = 0.8

# 1. System Architecture Diagram
fig, ax = plt.subplots(figsize=(10, 6.5), dpi=300)
ax.set_xlim(0, 100)
ax.set_ylim(0, 100)
ax.axis('off')

# Layer boxes
def draw_layer(y, height, title, color, bg_color):
    rect = patches.FancyBboxPatch((5, y), 90, height, boxstyle="round,pad=1.5,rounding_size=2",
                                  facecolor=bg_color, edgecolor=color, linewidth=1.5)
    ax.add_patch(rect)
    ax.text(8, y + height - 5, title, fontsize=11, fontweight='bold', color=color)

# Client Layer
draw_layer(72, 22, "CLIENT LAYER (Next.js 16 + React 19 + Tailwind CSS)", "#2563EB", "#EFF6FF")
# Subcomponents
boxes_client = [
    ("Student Portal\n(/dashboard)", 8, 75, 18, 12),
    ("Faculty & Staff Panel\n(/faculty)", 29, 75, 20, 12),
    ("Year Servers Workspace\n(/faculty/year-servers)", 52, 75, 20, 12),
    ("Live Monitor & Replay\n(/faculty/monitor)", 75, 75, 18, 12),
]
for title, x, y, w, h in boxes_client:
    r = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.8,rounding_size=1", facecolor="#DBEAFE", edgecolor="#3B82F6", linewidth=1)
    ax.add_patch(r)
    ax.text(x + w/2, y + h/2, title, fontsize=8.5, ha='center', va='center', color="#1E3A8A", fontweight='medium')

# Application & Security Layer
draw_layer(38, 28, "EDGE & APPLICATION LOGIC LAYER (Next.js Edge Proxy & Server Actions)", "#0D9488", "#F0FDFA")
boxes_app = [
    ("Edge Proxy Guard\n(src/proxy.ts)\nJWT Verification & RBAC", 8, 42, 25, 17),
    ("Server Actions\n(src/app/actions/*)\nregister, tutor, admin, replay", 37, 42, 27, 17),
    ("Audit & Replay Engine\nEvent Sourcing, Hash Fingerprints\nReceipt Generation", 68, 42, 25, 17),
]
for title, x, y, w, h in boxes_app:
    r = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.8,rounding_size=1", facecolor="#CCFBF1", edgecolor="#14B8A6", linewidth=1)
    ax.add_patch(r)
    ax.text(x + w/2, y + h/2, title, fontsize=8.5, ha='center', va='center', color="#134E4A", fontweight='medium')

# Data & Persistence Layer
draw_layer(4, 28, "PERSISTENCE & REALTIME DATA LAYER", "#7C3AED", "#F5F3FF")
boxes_data = [
    ("Drizzle ORM Engine\n(Node Postgres Pooler)\nType-Safe Schema Mapping", 8, 8, 25, 17),
    ("PostgreSQL Database\nACID Transactions, Row Locks\n17 Relational Tables", 37, 8, 27, 17),
    ("Supabase Realtime\nPostgres CDC -> WebSocket\nLive Seat Broadcasting", 68, 8, 25, 17),
]
for title, x, y, w, h in boxes_data:
    r = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.8,rounding_size=1", facecolor="#EDE9FE", edgecolor="#8B5CF6", linewidth=1)
    ax.add_patch(r)
    ax.text(x + w/2, y + h/2, title, fontsize=8.5, ha='center', va='center', color="#4C1D95", fontweight='medium')

# Arrows
ax.annotate('', xy=(50, 71), xytext=(50, 67), arrowprops=dict(arrowstyle="<->", color="#475569", lw=2))
ax.annotate('', xy=(50, 37), xytext=(50, 33), arrowprops=dict(arrowstyle="<->", color="#475569", lw=2))

plt.title("Figure 5.1: High-Level System Architecture of Electify", fontsize=12, fontweight='bold', pad=15)
plt.tight_layout()
plt.savefig("documentation/final-report/assets/fig_architecture.png", dpi=300, bbox_inches='tight')
plt.close()
print("Generated fig_architecture.png")
