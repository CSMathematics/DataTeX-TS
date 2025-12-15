import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

// 1. IMPORT ΤΩΝ ΒΑΣΙΚΩΝ STYLES ΤΟΥ MANTINE (ΑΠΑΡΑΙΤΗΤΟ ΓΙΑ V7)
import '@mantine/core/styles.css';

// 2. IMPORT ΤΟΥ APP.CSS (Πρέπει να είναι μετά το Mantine για να κάνει override)
import './App.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)