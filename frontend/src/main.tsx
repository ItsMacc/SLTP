// main.tsx — React entry point
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lab/queryClient'
import { requestPersistentStorage } from './store/opfs'
import './index.css'
import App from './App.tsx'

// Before any download: the browser's own heuristics decide whether to grant
// it, so asking on every visit is the only reliable way to get the cache out
// of automatic eviction. A refusal changes nothing about how the app works.
void requestPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)