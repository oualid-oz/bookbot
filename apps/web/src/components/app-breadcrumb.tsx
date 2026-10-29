"use client"

import { usePathname } from "next/navigation"

import { appNavMain, appNavSecondary, isNavActive } from "@/components/app-nav"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export function AppBreadcrumb() {
  const pathname = usePathname()
  const section = [...appNavMain, ...appNavSecondary].find((item) => isNavActive(pathname, item.url))

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">Bookbot</BreadcrumbItem>
        {section && (
          <>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{section.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
