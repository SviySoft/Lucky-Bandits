import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './styles/hud.css';
import './styles/modals.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

// No StrictMode: the double mount it performs in development would create the
// WebGL context twice. The game owns a single long-lived renderer instead.
createRoot(container).render(<App />);
