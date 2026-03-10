import { useNavigate, useRouterState } from '@tanstack/react-router'
import { BlocksIcon, HomeIcon, PanelLeftIcon, SettingsIcon, type LucideIcon } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import OpenVocalyLogo, { type OpenVocalyLogoTuning } from './openvocaly-logo'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@renderer/ui/sidebar'

type NavigationItem = {
  icon: LucideIcon
  label: string
  to: '/' | '/models' | '/settings'
}

const navigation: NavigationItem[] = [
  { icon: HomeIcon, label: 'Home', to: '/' },
  { icon: BlocksIcon, label: 'Models', to: '/models' }
]

const settingsItem: NavigationItem = { icon: SettingsIcon, label: 'Settings', to: '/settings' }
const EXPANDED_LOGO_SIZE = 34
const COLLAPSED_LOGO_SIZE = 28

const EXPANDED_LOGO_TUNING: OpenVocalyLogoTuning = {
  sharpness: 'pixel-snapped',
  barPattern: 'five',
  circleGap: 34,
  circleStroke: 8.5,
  barWidth: 7.5,
  barRadius: 3.25
}

const COLLAPSED_LOGO_TUNING: OpenVocalyLogoTuning = {
  sharpness: 'exact',
  barPattern: 'three',
  circleGap: 28,
  circleStroke: 9.5,
  barWidth: 9,
  barRadius: 3.5
}

const isRouteActive = (pathname: string, route: NavigationItem['to']): boolean => {
  if (route === '/') {
    return pathname === '/'
  }

  return pathname === route || pathname.startsWith(`${route}/`)
}

function AppSidebar(): React.JSX.Element {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { toggleSidebar, state } = useSidebar()
  const isCollapsed = state === 'collapsed'
  const logoSize = isCollapsed ? COLLAPSED_LOGO_SIZE : EXPANDED_LOGO_SIZE
  const logoTuning = isCollapsed ? COLLAPSED_LOGO_TUNING : EXPANDED_LOGO_TUNING

  return (
    <Sidebar collapsible="icon" className="group/sidebar">
      <SidebarHeader className="border-sidebar-border h-14 border-b p-0 group-data-[collapsible=icon]:p-0">
        <div className="group/brand relative flex h-full items-center gap-2 px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div
            className={cn(
              'flex min-w-0 items-center gap-2',
              'group-data-[collapsible=icon]:transition-opacity',
              'group-data-[collapsible=icon]:group-hover/brand:opacity-0'
            )}
          >
            <OpenVocalyLogo
              size={logoSize}
              animateOnce
              animationKey="sidebar-brand-logo"
              tuning={logoTuning}
              className="text-sidebar-foreground"
            />
            <span className="text-sidebar-foreground truncate text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
              OpenVocaly
            </span>
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            className={cn(
              'text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-opacity cursor-pointer disabled:cursor-not-allowed',
              'group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:inset-0 group-data-[collapsible=icon]:m-auto group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:pointer-events-none',
              'group-data-[collapsible=icon]:group-hover/brand:opacity-100 group-data-[collapsible=icon]:group-hover/brand:pointer-events-auto'
            )}
          >
            <PanelLeftIcon className="size-[18px]" />
            <span className="sr-only">Toggle Sidebar</span>
          </button>
        </div>
      </SidebarHeader>
      <SidebarContent className="py-2">
        <SidebarGroup className="py-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {navigation.map((item) => {
                const Icon = item.icon

                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      type="button"
                      onClick={() => navigate({ to: item.to })}
                      isActive={isRouteActive(pathname, item.to)}
                      tooltip={item.label}
                      className="group-data-[collapsible=icon]:justify-center"
                      size="lg"
                    >
                      <Icon className="size-4" />
                      <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="pb-3">
        <SidebarMenu className="gap-2">
          <SidebarMenuItem key={settingsItem.to}>
            <SidebarMenuButton
              type="button"
              onClick={() => navigate({ to: settingsItem.to })}
              isActive={isRouteActive(pathname, settingsItem.to)}
              tooltip={settingsItem.label}
              className="group-data-[collapsible=icon]:justify-center"
              size="lg"
            >
              <SettingsIcon className="size-4" />
              <span className="group-data-[collapsible=icon]:hidden">{settingsItem.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
