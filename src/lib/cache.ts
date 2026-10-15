/**
 * Safe Next.js cache revalidation helper.
 * Centralizes cache and route invalidations to prevent boilerplate duplication
 * and eliminate unsafe `as any` assertions in server actions.
 */

interface NextCacheModule {
  revalidatePath?: (path: string, type?: "layout" | "page") => void;
  revalidateTag?: (tag: string, profile?: string) => void;
  updateTag?: (tag: string) => void;
}

/**
 * Safely revalidates given paths. Gracefully no-ops in non-Next runtime (e.g. unit test runner).
 */
export async function safeRevalidatePaths(paths: Array<string | { path: string; type: "layout" | "page" }>): Promise<void> {
  try {
    const cache = (await import("next/cache")) as unknown as NextCacheModule;
    if (typeof cache.revalidatePath === "function") {
      for (const entry of paths) {
        if (typeof entry === "string") {
          cache.revalidatePath(entry);
        } else {
          cache.revalidatePath(entry.path, entry.type);
        }
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[Cache] safeRevalidatePaths warning:", err);
    }
  }
}

/**
 * Revalidates common hierarchy paths and tags across the academic dashboard.
 */
export async function revalidateHierarchyCache(): Promise<void> {
  try {
    const cache = (await import("next/cache")) as unknown as NextCacheModule;
    if (typeof cache.revalidatePath === "function") {
      cache.revalidatePath("/faculty/window");
      cache.revalidatePath("/faculty/events");
      cache.revalidatePath("/faculty/dashboard");
      cache.revalidatePath("/dashboard");
      cache.revalidatePath("/dashboard/electives");
      cache.revalidatePath("/", "layout");
    }
    if (typeof cache.updateTag === "function") {
      cache.updateTag("hierarchy");
    }
    if (typeof cache.revalidateTag === "function") {
      cache.revalidateTag("hierarchy", "max");
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[Cache] revalidateHierarchyCache warning:", err);
    }
  }
}
