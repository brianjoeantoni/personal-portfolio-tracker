'use client'

import { CircleDollarSignIcon, HardDriveIcon, LayoutDashboardIcon, WalletCardsIcon } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

type PortfolioView = 'overview' | 'assets'

export function AppSidebar({ activeView, onNavigate, ...props }: React.ComponentProps<typeof Sidebar> & { activeView: PortfolioView; onNavigate: (view: PortfolioView) => void }) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
          <div className="grid size-8 place-items-center rounded-lg bg-[#283f34] text-[#d7f268]"><CircleDollarSignIcon size={17} /></div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-semibold">Net Worth</p><p className="truncate text-xs text-sidebar-foreground/65">Personal</p></div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Portfolio</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Overview" isActive={activeView === 'overview'} onClick={() => onNavigate('overview')}>
                <LayoutDashboardIcon />
                <span>Overview</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Assets" isActive={activeView === 'assets'} onClick={() => onNavigate('assets')}>
                <WalletCardsIcon />
                <span>Assets</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-sidebar-foreground/70 group-data-[collapsible=icon]:justify-center">
          <HardDriveIcon className="size-4 shrink-0" />
          <div className="min-w-0 text-xs group-data-[collapsible=icon]:hidden"><p className="font-medium text-sidebar-foreground">This device</p><p>Stored locally</p></div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
