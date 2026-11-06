"use client"

import * as React from "react"
import { Suspense } from "react"
import Image from "next/image"
import Link from "next/link"

import logo from "../../public/icon-192.png"
import { appNavGroups, appNavSecondary } from "@/components/app-nav"
import { NavMain, NavMainList } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  /** Rendered in the footer; streamed from the server since it reads the session */
  user: React.ReactNode
}) {
  const { isMobile } = useSidebar()

  return (
    <Sidebar variant="inset" collapsible={isMobile ? "offcanvas" : "icon"} {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/home">
                {/* Served as a static file: no image optimizer needed for a small icon */}
                <Image src={logo} alt="" width={32} height={32} className="size-8 shrink-0 rounded-lg" unoptimized priority />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Bookbot</span>
                  <span className="truncate text-xs">KDP toolkit</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* Reading the URL suspends on dynamic routes; show the nav unhighlighted meanwhile */}
        <Suspense fallback={<NavMainList groups={appNavGroups} pathname={null} />}>
          <NavMain groups={appNavGroups} />
        </Suspense>
        <NavSecondary items={appNavSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>{user}</SidebarFooter>
    </Sidebar>
  )
}
