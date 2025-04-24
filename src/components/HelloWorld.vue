<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ msg: string }>();

const userMessage = ref(''); // To store user input
const apiResponse = ref(''); // To store the response from the function
const isLoading = ref(false); // To show a loading indicator
const errorMessage = ref(''); // To display errors

async function callAskFunction() {
  if (!userMessage.value.trim()) {
    errorMessage.value = 'Please enter a message.';
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';
  apiResponse.value = '';

  try {
    // Call the Cloudflare Function endpoint relative to the current domain
    const response = await fetch('/ask', { // Relative path works because the function is on the same domain
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: userMessage.value }),
    });

    if (!response.ok) {
      // Try to get error details from the response body
      let errorDetails = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorDetails += `: ${errorData.error || errorData.details || JSON.stringify(errorData)}`;
      } catch (e) {
        // Ignore if the body isn't JSON or is empty
        errorDetails += `: ${await response.text()}`;
      }
      throw new Error(errorDetails);
    }

    const data = await response.json();
    apiResponse.value = data.reply; // Assuming the function returns { reply: "..." }

  } catch (error: any) {
    console.error('Error calling /ask function:', error);
    errorMessage.value = `Failed to get response: ${error.message || error}`;
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <h1>{{ msg }}</h1>

  <div class="card">
    <textarea
      v-model="userMessage"
      placeholder="Ask something..."
      rows="3"
      :disabled="isLoading"
    ></textarea>
    <button type="button" @click="callAskFunction" :disabled="isLoading">
      {{ isLoading ? 'Asking...' : 'Send' }}
    </button>
  </div>

  <div v-if="isLoading" class="loading">
    Waiting for response...
  </div>

  <div v-if="errorMessage" class="error">
    <p>Error:</p>
    <pre>{{ errorMessage }}</pre>
  </div>

  <div v-if="apiResponse" class="response">
    <p>Response:</p>
    <pre>{{ apiResponse }}</pre>
  </div>

  <p>
    Check out
    <a href="https://vuejs.org/guide/quick-start.html#local" target="_blank"
      >create-vue</a
    >, the official Vue + Vite starter
  </p>
  <p>
    Learn more about IDE Support for Vue in the
    <a
      href="https://vuejs.org/guide/scaling-up/tooling.html#ide-support"
      target="_blank"
      >Vue Docs Scaling up Guide</a
    >.
  </p>
  <p class="read-the-docs">Click on the Vite and Vue logos to learn more</p>
</template>

<style scoped>
.read-the-docs {
  color: #888;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 1em;
  margin-bottom: 1em;
}
textarea {
  width: 100%;
  padding: 0.5em;
  font-family: inherit;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.loading, .error, .response {
  margin-top: 1em;
  padding: 1em;
  border-radius: 4px;
}
.loading {
  background-color: #e0e0e0;
}
.error {
  background-color: #ffdddd;
  color: #d8000c;
}
.response {
  background-color: #ddffdd;
  color: #4f8a10;
}
pre {
  white-space: pre-wrap; /* Allow text wrapping */
  word-wrap: break-word; /* Break long words */
  background-color: inherit; /* Inherit background color */
  padding: 0;
  margin: 0;
}
</style>
