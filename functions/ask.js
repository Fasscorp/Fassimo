// functions/ask.js
import OpenAI from 'openai';

// Note: No need for 'dotenv' here. Cloudflare reads environment variables
// directly from the Pages project settings.

// Define the onRequestPost function, the entry point for POST requests
export async function onRequestPost(context) {
  try {
    // 1. Get OpenAI API Key from environment variables (set in Cloudflare Pages settings)
    const apiKey = context.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response('Missing OPENAI_API_KEY environment variable', { status: 500 });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey });

    // 2. Parse the request body to get the message
    // Use context.request.json() which is standard for Cloudflare Functions/Workers
    const requestBody = await context.request.json();
    const { message } = requestBody;

    if (!message) {
      return new Response('Missing message in request body', { status: 400 });
    }

    // 3. Call OpenAI API (using the same logic as before)
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: message }],
    });

    const reply = completion.choices[0].message.content;

    // 4. Return the response
    // Create a JSON response
    const responseData = JSON.stringify({ reply });
    return new Response(responseData, {
      headers: {
        'Content-Type': 'application/json',
        // Add CORS headers if needed, though calls from the same domain might not require it.
        // 'Access-Control-Allow-Origin': '*', // Example: Allow all origins (adjust as needed)
      },
      status: 200
    });

  } catch (error) {
    console.error('Error in /ask function:', error);
    // Return a generic error response
    return new Response(JSON.stringify({ error: 'Failed to process request', details: error.message }), {
      headers: {
        'Content-Type': 'application/json',
        // 'Access-Control-Allow-Origin': '*', // Also add CORS here if needed
      },
      status: 500
    });
  }
}

// Optional: Handle other methods (GET, etc.) if needed, or return method not allowed
export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  // Handle other methods or return an error
  return new Response(`Method ${context.request.method} Not Allowed`, { status: 405 });
}
