"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { logout } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"

export function SignOutButton({ compact }: { compact?: boolean }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  return (
    <Button
      variant="ghost"
      size={compact ? "icon" : "md"}
      aria-label="Sign out"
      loading={pending}
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
