import { BookmarkIcon, CreditCardIcon, HomeIcon, LibraryBigIcon, PlugIcon, UserRoundIcon, type LucideIcon } from "lucide-react"

export interface AppNavItem {
  title: string
  url: string
  icon: LucideIcon
  items?: { title: string; url: string }[]
}

export interface AppNavGroup {
  /** No label: the group sits at the top on its own */
  label?: string
  items: AppNavItem[]
}

// Primary navigation for the signed-in app (pages under app/(app))
export const appNavGroups: AppNavGroup[] = [
  { items: [{ title: "Home", url: "/home", icon: HomeIcon }] },
  { label: "Research", items: [{ title: "Saved books", url: "/research", icon: BookmarkIcon }] },
  { label: "Create", items: [{ title: "Projects", url: "/projects", icon: LibraryBigIcon }] },
]

export const appNavMain: AppNavItem[] = appNavGroups.flatMap((group) => group.items)

export const appNavSecondary: AppNavItem[] = [
  { title: "Account", url: "/settings/account", icon: UserRoundIcon },
  { title: "Billing", url: "/settings/billing", icon: CreditCardIcon },
  { title: "Extension", url: "/settings/extension", icon: PlugIcon },
]

export function isNavActive(pathname: string, url: string) {
  return pathname === url || pathname.startsWith(`${url}/`)
}
