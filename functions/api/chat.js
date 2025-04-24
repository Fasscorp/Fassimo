// functions/api/chat.js

// --- Imports ---
import { Conversation, defineTool, createOpenAIProvider } from '@modelcontextprotocol/sdk';
import OpenAI from 'openai';
import { customerInfoSchema } from '../schemas/customer-info.schema.js';
import { saveCustomerInfoTool } from '../tools/save-customer-info.tool.js';
// Import others as needed

// --- Assistant ID Mapping ---
const assistantMap = {
    "Customer Information": "CUSTOMER_INTERVIEW_ASSISTANT_ID",
    "Product Ideas": "PRODUCT_IDEAS_ASSISTANT_ID",
    "General Settings": "GENERAL_SETTINGS_ASSISTANT_ID",
    // Add mappings for all topics
};

// --- Schema/Tool Mapping ---
const topicConfig = {
    "Customer Information": {
        tools: [saveCustomerInfoTool]
    },
    "General Settings": {
        tools: []
    },
    // Add configurations for all topics
};

// --- Cloudflare Function Entry Point ---
export async function onRequestPost(context) {
    try {
        // --- Environment Variables ---
        const apiKey = context.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

        // --- Request Body Parsing ---
        const requestBody = await context.request.json();
        const { message, topic, threadId: existingThreadId } = requestBody;
        if (!message || !topic) {
            return new Response(JSON.stringify({ error: 'Missing message or topic' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- Assistant Selection ---
        const assistantEnvVarName = assistantMap[topic];
        if (!assistantEnvVarName) {
            return new Response(JSON.stringify({ error: `No assistant for topic: ${topic}` }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }
        const assistantId = context.env[assistantEnvVarName];
        if (!assistantId) throw new Error(`Missing env var: ${assistantEnvVarName}`);

        // --- Get Topic Config ---
        const config = topicConfig[topic];
        const toolsForAssistant = config?.tools || [];

        // --- MCP Provider Setup ---
        const modelProvider = createOpenAIProvider({
            apiKey: apiKey,
            assistantId: assistantId,
            tools: toolsForAssistant,
        });

        // --- MCP Conversation ---
        const conversation = new Conversation({
            provider: modelProvider,
            threadId: existingThreadId || undefined,
        });

        // Add user message
        await conversation.addMessage({ role: 'user', content: message });

        // Send to Assistant
        const response = await conversation.send();

        // --- Process Response (Simplified) ---
        let reply = "Sorry, unexpected response.";
        let newThreadId = conversation.threadId || null;

        if (response?.type === 'message' && response.message?.role === 'assistant' && response.message?.content != null) {
            // FIX 5: Directly convert content to string, avoid join/Array.isArray
            reply = String(response.message.content);
        } else if (response?.type === 'tool_call_result') {
            reply = response.result?.message || "Processed request.";
        } else {
            console.warn("Unexpected response format:", JSON.stringify(response, null, 2));
            // Keep simple fallback for unexpected structure
            if (response?.message?.content != null) {
                reply = String(response.message.content);
            } else if (typeof response?.result?.message === 'string') {
                reply = response.result.message;
            }
        }

        // --- Return Response to Frontend ---
        const responseData = JSON.stringify({ reply: reply, threadId: newThreadId });
        return new Response(responseData, {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error) {
        console.error('Error in /api/chat:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({ error: 'Failed processing request', details: errorMessage }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
        });
    }
}

// --- onRequest Handler ---
export async function onRequest(context) {
    if (context.request.method === 'POST') {
        return onRequestPost(context);
    }
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        });
    }
    return new Response(`Method ${context.request.method} Not Allowed`, { status: 405 });
}
