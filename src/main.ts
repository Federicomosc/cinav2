import { mount } from 'svelte';
import { initTheme } from './lib/theme.svelte';
import './fonts.css';
import './app.css';
import App from './App.svelte';

initTheme();

const target = document.getElementById('app');
if (!target) throw new Error('#app non trovato');

const app = mount(App, { target });

export default app;
