import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { runStorageResetIfNeeded } from './storage/bootstrap.ts'

await runStorageResetIfNeeded()

const { default: App } = await import('./App.tsx')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
