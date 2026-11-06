import './utils/freshVisit'   // 가장 먼저: 스토어가 저장분을 읽기 전에 "나갔다 온 방문"이면 비운다
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
