import { Outlet, createRootRoute } from '@tanstack/react-router'
import AppSidebar from '@renderer/components/app-sidebar'
import SiteHeader from '@renderer/components/site-header'
import { SidebarInset, SidebarProvider } from '@renderer/ui/sidebar'

const RootLayout = (): React.JSX.Element => (
  <SidebarProvider className="[--sidebar-width-icon:3.5rem]">
    <AppSidebar />
    <SidebarInset className="bg-background/80">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-start justify-center p-8 sm:p-10">
          <Outlet />
        </main>
      </div>
    </SidebarInset>
  </SidebarProvider>
)

export const Route = createRootRoute({ component: RootLayout })
