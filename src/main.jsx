import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SocketProvider } from './context/SoketProvider.jsx'
import reportWebVitals from './reportWebVitals.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SocketProvider>
    <App />
    </SocketProvider>
  </StrictMode>,
)


reportWebVitals();