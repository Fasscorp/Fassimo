import { createApp } from 'vue'
// import './style.css' // REMOVED - Styles are consolidated in layout.css
import App from './App.vue'

// Import the consolidated layout CSS and the controller JS
import './layout.css';
import './layout-controller.js';

createApp(App).mount('#app')
