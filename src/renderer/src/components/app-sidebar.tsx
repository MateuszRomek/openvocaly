import { useNavigate, useRouterState } from '@tanstack/react-router'
import { HomeIcon, PanelLeftIcon, SettingsIcon, type LucideIcon } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import {
  Sidebar,
  SidebarContent,
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
  to: '/' | '/settings'
}

const navigation: NavigationItem[] = [
  { icon: HomeIcon, label: 'Home', to: '/' },
  { icon: SettingsIcon, label: 'Settings', to: '/settings' }
]

function AppSidebar(): React.JSX.Element {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { toggleSidebar } = useSidebar()

  return (
    <Sidebar collapsible="icon" className="group/sidebar">
      <SidebarHeader className="border-sidebar-border h-14 border-b px-2">
        <div className="group/brand relative flex h-full items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div
            className={cn(
              'flex min-w-0 items-center gap-2',
              'group-data-[collapsible=icon]:transition-opacity',
              'group-data-[collapsible=icon]:group-hover/brand:opacity-0'
            )}
          >
            <span className="bg-sidebar-primary text-sidebar-primary-foreground dark:bg-sidebar-foreground dark:text-sidebar flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold">
              W
            </span>
            <span className="text-sidebar-foreground truncate text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
              Wispr
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
            <PanelLeftIcon className="size-4" />
            <span className="sr-only">Toggle Sidebar</span>
          </button>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navigation.map((item) => {
                const Icon = item.icon

                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      type="button"
                      onClick={() => navigate({ to: item.to })}
                      isActive={pathname === item.to}
                      tooltip={item.label}
                      className="group-data-[collapsible=icon]:justify-center"
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
    </Sidebar>
  )
}

export default AppSidebar
