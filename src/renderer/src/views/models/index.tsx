import type { JSX } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger } from '@renderer/ui/tabs'

function resolveActiveTab(pathname: string): 'cloud' | 'local' {
  if (pathname.startsWith('/models/local')) {
    return 'local'
  }

  return 'cloud'
}

export function ModelsLayoutView(): JSX.Element {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const activeTab = resolveActiveTab(pathname)

  return (
    <section className="w-full max-w-4xl space-y-5 py-1 sm:py-2">
      <header className="space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Models</h2>
        <p className="text-muted-foreground text-sm">
          Choose which model category to configure for transcription.
        </p>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(nextTab) =>
          navigate({ to: nextTab === 'cloud' ? '/models/cloud' : '/models/local' })
        }
      >
        <TabsList>
          <TabsTrigger value="cloud">Cloud</TabsTrigger>
          <TabsTrigger value="local">Local</TabsTrigger>
        </TabsList>
      </Tabs>

      <Outlet />
    </section>
  )
}
