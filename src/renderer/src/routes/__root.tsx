import { Outlet, createRootRoute } from '@tanstack/react-router'
import AppSidebar from '@renderer/components/app-sidebar'
import SiteHeader from '@renderer/components/site-header'
import { SidebarInset, SidebarProvider } from '@renderer/ui/sidebar'

const RootLayout = (): React.JSX.Element => (
  <SidebarProvider className="[--sidebar-width-icon:3.5rem]">
    <AppSidebar />
    <SidebarInset className="bg-background/80 min-h-0">
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
        <SiteHeader />
        <main className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </SidebarInset>
  </SidebarProvider>
)

export const Route = createRootRoute({ component: RootLayout })
