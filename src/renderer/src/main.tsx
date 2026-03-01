import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { queryClient } from './lib/query-client'
import { startThemeSync } from './lib/theme'
import router from './router'

const stopThemeSync = startThemeSync()
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopThemeSync()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
