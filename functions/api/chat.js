// functions/api/chat.js

// --- Imports ---
// Using the correct SDK package now
import { Conversation, defineTool, createOpenAIProvider } from '@modelcontextprotocol/sdk';
import OpenAI from 'openai'; // Base OpenAI client might still be needed depending on provider implementation

// Import schemas and tools from separate files
import { customerInfoSchema } from '../schemas/customer-info.schema.js';
import { saveCustomerInfoTool } from '../tools/save-customer-info.tool.js';
// TODO: Import schemas/tools for other topics as needed
// import { generalSettingsSchema } from '../schemas/general-settings.schema.js';
// import { updateGeneralSettingsTool } from '../tools/update-general-settings.tool.js';

// --- Assistant ID Mapping ---
const assistantMap = {
    "Customer Information": "CUSTOMER_INTERVIEW_ASSISTANT_ID",
    "Product Ideas": "PRODUCT_IDEAS_ASSISTANT_ID", // Example
    "General Settings": "GENERAL_SETTINGS_ASSISTANT_ID", // Example
    // Add mappings for all topics
};

// --- Schema/Tool Mapping (Example - extend as needed) ---
// Map topics to their corresponding schemas and tools
const topicConfig = {
    "Customer Information": {
        // schema: customerInfoSchema, // Pass schema to Conversation if needed by SDK
        tools: [saveCustomerInfoTool]
    },
    "General Settings": {
        // schema: generalSettingsSchema,
        // tools: [updateGeneralSettingsTool]
        tools: [] // Example: Maybe this topic doesn't use tools
    },
    // Add configurations for all topics
};

// --- Cloudflare Function Entry Point ---
export async function onRequestPost(context) {
    try {
        // --- Environment Variables ---
        const apiKey = context.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('Missing OPENAI_API_KEY environment variable');
        }

        // --- Request Body Parsing ---
        const requestBody = await context.request.json();
        const { message, topic, threadId: existingThreadId } = requestBody;

        if (!message || !topic) {
            return new Response(JSON.stringify({ error: 'Missing message or topic in request body' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- Assistant Selection --- (Using assistantMap)
        const assistantEnvVarName = assistantMap[topic];
        if (!assistantEnvVarName) {
            return new Response(JSON.stringify({ error: `No assistant configured for topic: ${topic}` }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }
        const assistantId = context.env[assistantEnvVarName];
        if (!assistantId) {
             throw new Error(`Missing Assistant ID environment variable: ${assistantEnvVarName} for topic ${topic}`);
        }

        // --- Get Tools/Schema for the selected topic --- (Using topicConfig)
        const config = topicConfig[topic];
        if (!config) {
             console.warn(`No specific schema/tool configuration found for topic: ${topic}. Using defaults or none.`);
             // Decide on default behavior: empty tools, specific default tools, etc.
        }
        const toolsForAssistant = config?.tools || []; // Use configured tools or default to empty array
        // const schemaForAssistant = config?.schema; // Get schema if needed by Conversation

        // --- MCP Provider Setup ---
        // Note: Ensure createOpenAIProvider is the correct function from @modelcontextprotocol/sdk
        const modelProvider = createOpenAIProvider({
            apiKey: apiKey,
            assistantId: assistantId,
            tools: toolsForAssistant,
            // It's possible you might need to pass the base OpenAI client instance depending on the SDK design:
            // openaiClient: new OpenAI({ apiKey }),
        });

        // --- MCP Conversation ---
        const conversation = new Conversation({
            provider: modelProvider,
            threadId: existingThreadId || undefined,
            // contextSchema: schemaForAssistant, // Pass schema if needed
        });

        // Add user message
        await conversation.addMessage({ role: 'user', content: message });

        // Send to Assistant
        const response = await conversation.send();

        // --- Process Response ---
        let reply = "Sorry, I received an unexpected response.";
        // Get the thread ID *after* the send call, as it might be created by the provider
        let newThreadId = conversation.threadId || null;

        // Check the response structure carefully based on SDK documentation
        if (response?.type === 'message' && response.message?.role === 'assistant' && response.message?.content) {
             // FIX: Escape the newline character for the join
            reply = Array.isArray(response.message.content) ? response.message.content.join('
') : String(response.message.content);
        } else if (response?.type === 'tool_call_result') {
            reply = response.result?.message || "Okay, I've processed that request.";
        } else {
             console.warn("Unexpected response format from conversation.send():", JSON.stringify(response, null, 2));
             if (response?.message?.content) {
                  // FIX: Escape the newline character for the join
                 reply = Array.isArray(response.message.content) ? response.message.content.join('
') : String(response.message.content);
             } else if (typeof response?.result?.message === 'string') {
                 reply = response.result.message;
             }
        }

        // --- Return Response to Frontend ---
        const responseData = JSON.stringify({
            reply: reply,
            threadId: newThreadId
         });
        return new Response(responseData, {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error) {
        console.error('Error in /api/chat function:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({ error: 'Failed to process request', details: errorMessage }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
        });
    }
}

// --- onRequest Handler (Includes OPTIONS for CORS preflight) ---
export async function onRequest(context) {
    if (context.request.method === 'POST') {
        return onRequestPost(context);
    }
     if (context.request.method === 'OPTIONS') {
         return new Response(null, {
             headers: {
                 'Access-Control-Allow-Origin': '*', // IMPORTANT: Restrict in production!
                 'Access-Control-Allow-Methods': 'POST, OPTIONS',
                 'Access-Control-Allow-Headers': 'Content-Type',
             }
         });
     }
    return new Response(`Method ${context.request.method} Not Allowed`, { status: 405 });
}
