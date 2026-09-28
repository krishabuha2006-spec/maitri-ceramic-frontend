import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Purge all keys from localStorage on startup except the single login auth token ('maitri_auth_token')
try {
  const ALLOWED_AUTH_KEYS = new Set(['maitri_auth_token']);
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !ALLOWED_AUTH_KEYS.has(key)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
} catch (e) {
  console.warn('LocalStorage cleanup notice:', e);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
