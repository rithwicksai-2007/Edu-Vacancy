import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App';
import { BrowserRouter, HashRouter } from "react-router-dom";

const Router = import.meta.env.DEV ? BrowserRouter : HashRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router basename={import.meta.env.DEV ? import.meta.env.BASE_URL : undefined}>
      <App />
    </Router>
  </StrictMode>,
)
