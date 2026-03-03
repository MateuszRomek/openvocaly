import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { queryClient } from './lib/query-client'
import { startThemeSync } from './lib/theme'
import router from './router'
import { Toaster } from './ui/sonner'
import { TooltipProvider } from './ui/tooltip'

const stopThemeSync = startThemeSync()
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopThemeSync()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>
)
