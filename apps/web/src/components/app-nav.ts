import { CreditCardIcon, PaletteIcon, SearchIcon, type LucideIcon } from "lucide-react"

export interface AppNavItem {
  title: string
  url: string
  icon: LucideIcon
  items?: { title: string; url: string }[]
}

// Primary navigation for the signed-in app (pages under app/(app))
export const appNavMain: AppNavItem[] = [
  { title: "Research", url: "/research", icon: SearchIcon },
  { title: "Studio", url: "/studio", icon: PaletteIcon },
]

export const appNavSecondary: AppNavItem[] = [
  { title: "Pricing", url: "/pricing", icon: CreditCardIcon },
]

export function isNavActive(pathname: string, url: string) {
  return pathname === url || pathname.startsWith(`${url}/`)
}
