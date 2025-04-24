import { createApp } from 'vue'
import './style.css' // Keep existing global styles
import App from './App.vue'

// Import the new layout CSS and JS
import './layout.css';
import './layout-controller.js';

createApp(App).mount('#app')
