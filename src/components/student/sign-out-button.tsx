"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { logout } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"

export function SignOutButton({ compact, compactOnMobile }: { compact?: boolean; compactOnMobile?: boolean }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  return (
    <Button
      variant="ghost"
      size={compact ? "icon" : "md"}
      aria-label="Sign out"
      loading={pending}
      // Icon-only (a 40px square target) below the sm breakpoint, where the label is hidden anyway.
      className={compactOnMobile ? "max-sm:w-10 max-sm:px-0" : undefined}
      onClick={async () => {
        setPending(true)
        await logout()
        router.replace("/login")
        router.refresh()
      }}
    >
      <LogOut />
      {!compact ? <span className="hidden sm:inline">Sign out</span> : null}
    </Button>
  )
}
