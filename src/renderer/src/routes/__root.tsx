import { Outlet, createRootRoute } from '@tanstack/react-router'
import AppSidebar from '@renderer/components/app-sidebar'
import { SidebarInset, SidebarProvider } from '@renderer/ui/sidebar'

const RootLayout = (): React.JSX.Element => (
  <SidebarProvider className="h-svh overflow-hidden">
    <AppSidebar />
    <SidebarInset className="bg-background/80 min-h-0">
      <main className="app-scroll-area min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
          <div className="flex w-full items-start justify-center">
            <Outlet />
          </div>
        </div>
      </main>
    </SidebarInset>
  </SidebarProvider>
)

export const Route = createRootRoute({ component: RootLayout })
