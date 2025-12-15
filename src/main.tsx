// 1. Εισάγουμε τα βασικά styles του Mantine ΠΡΙΝ από οτιδήποτε άλλο
import '@mantine/core/styles.css';

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'; // 2. Import τον Provider
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 3. Τυλίγουμε το App με τον MantineProvider */}
    <MantineProvider>
      <App />
    </MantineProvider>
  </StrictMode>
)