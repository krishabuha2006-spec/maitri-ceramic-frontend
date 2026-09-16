import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Clear any previously cached mock/seed data so only real backend data shows
// This runs once on every fresh app load — cached real API data will be re-fetched
const SEED_CLEAR_VERSION = 'v3_no_mock_data';
if (localStorage.getItem('maitri_seed_clear') !== SEED_CLEAR_VERSION) {
  localStorage.removeItem('maitri_local_products');
  localStorage.removeItem('maitri_local_companies');
  localStorage.removeItem('maitri_local_product_groups');
  localStorage.removeItem('maitri_local_customers');
  localStorage.setItem('maitri_seed_clear', SEED_CLEAR_VERSION);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
