import { Outlet, createRootRoute } from '@tanstack/react-router'
import AppSidebar from '@renderer/components/app-sidebar'
import { SidebarInset, SidebarProvider } from '@renderer/ui/sidebar'

const RootLayout = (): React.JSX.Element => (
  <SidebarProvider className="h-svh overflow-hidden">
    <AppSidebar />
    <SidebarInset className="bg-background/80 min-h-0">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-1 flex-col px-4 sm:px-6">
        <main className="app-scroll-area flex min-h-0 flex-1 items-start justify-center overflow-y-auto py-4 sm:py-6">
          <Outlet />
        </main>
      </div>
    </SidebarInset>
  </SidebarProvider>
)

export const Route = createRootRoute({ component: RootLayout })
