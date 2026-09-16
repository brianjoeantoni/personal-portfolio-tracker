'use client'

import { CircleDollarSignIcon, HardDriveIcon, LayoutDashboardIcon, SettingsIcon, WalletCardsIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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

type PortfolioView = 'overview' | 'assets' | 'settings'

export function AppSidebar({ activeView, onNavigate, ...props }: React.ComponentProps<typeof Sidebar> & { activeView: PortfolioView; onNavigate: (view: PortfolioView) => void }) {
  const { t } = useTranslation()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
          <div className="grid size-8 place-items-center rounded-lg bg-[#283f34] text-[#d7f268]"><CircleDollarSignIcon size={17} /></div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-semibold">{t('navigation.productName')}</p><p className="truncate text-xs text-sidebar-foreground/65">{t('navigation.personal')}</p></div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('navigation.portfolio')}</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="cursor-pointer" tooltip={t('navigation.overview')} isActive={activeView === 'overview'} onClick={() => onNavigate('overview')}>
                <LayoutDashboardIcon />
                <span>{t('navigation.overview')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton className="cursor-pointer" tooltip={t('navigation.assets')} isActive={activeView === 'assets'} onClick={() => onNavigate('assets')}>
                <WalletCardsIcon />
                <span>{t('navigation.assets')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton className="cursor-pointer" tooltip={t('navigation.settings')} isActive={activeView === 'settings'} onClick={() => onNavigate('settings')}>
                <SettingsIcon />
                <span>{t('navigation.settings')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-sidebar-foreground/70 group-data-[collapsible=icon]:justify-center">
          <HardDriveIcon className="size-4 shrink-0" />
          <div className="min-w-0 text-xs group-data-[collapsible=icon]:hidden"><p className="font-medium text-sidebar-foreground">{t('navigation.thisDevice')}</p><p>{t('navigation.storedLocally')}</p></div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
