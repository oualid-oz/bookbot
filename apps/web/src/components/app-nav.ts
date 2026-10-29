import { CreditCardIcon, LibraryBigIcon, SearchIcon, type LucideIcon } from "lucide-react"

export interface AppNavItem {
  title: string
  url: string
  icon: LucideIcon
  items?: { title: string; url: string }[]
}

// Primary navigation for the signed-in app (pages under app/(app))
export const appNavMain: AppNavItem[] = [
  { title: "Research", url: "/research", icon: SearchIcon },
  { title: "Projects", url: "/projects", icon: LibraryBigIcon },
]

export const appNavSecondary: AppNavItem[] = [
  { title: "Billing", url: "/settings/billing", icon: CreditCardIcon },
]

export function isNavActive(pathname: string, url: string) {
  return pathname === url || pathname.startsWith(`${url}/`)
}
