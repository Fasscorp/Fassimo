// functions/api/chat.js

// --- Imports ---
// Using the official OpenAI SDK
import OpenAI from 'openai';

// Removed MCP SDK imports for Conversation, defineTool, etc.
// We might re-introduce schema definition/validation later if needed, e.g., with Zod

// --- Assistant ID Mapping (Remains the same) ---
const assistantMap = {
    "Customer Information": "CUSTOMER_INTERVIEW_ASSISTANT_ID",
    "Product Ideas": "PRODUCT_IDEAS_ASSISTANT_ID", // Example
    "General Settings": "GENERAL_SETTINGS_ASSISTANT_ID", // Example
    // Add mappings for all topics
};

// --- Tool Definitions (OpenAI Format) & Handlers ---
// Define the structure OpenAI expects for tools passed to the Run
const toolsOpenAIFormat = [
    {
        type: "function",
        function: {
            name: "saveCustomerData",
            description: "Saves the collected customer information once all required details are gathered.",
            parameters: {
                type: "object",
                properties: {
                    customerName: { type: "string", description: "Full name of the customer" },
                    companyName: { type: "string", description: "Name of the customer company (optional)" },
                    email: { type: "string", description: "Customer email address" },
                    projectNeeds: { type: "string", description: "Summary of the customer project needs" },
                    timeline: { type: "string", description: "Project timeline (optional)" },
                    budget: { type: "string", description: "Estimated budget (optional)" },
                },
                required: ["customerName", "email", "projectNeeds"]
            },
        }
    }
    // Add other tool definitions here if needed for other assistants
];

// Handlers for our functions (match the tool names)
const toolHandlers = {
    saveCustomerData: async (args) => {
        console.log("HANDLER: saveCustomerData called with:", args);
        // --->>> Your logic to save/process args (the JSON data) goes here
        // Example validation (can use Zod for more complex cases)
        if (!args.customerName || !args.email || !args.projectNeeds) {
            return JSON.stringify({ success: false, error: "Missing required fields." });
        }
        // Assume save successful
        const message = "Okay, I have saved that customer information.";
        return JSON.stringify({ success: true, message: message }); // Return value MUST be a JSON string
    }
    // Add other handlers here
};

// --- Polling Configuration ---
const POLLING_INTERVAL_MS = 500; // 0.5 seconds
const MAX_POLLING_ATTEMPTS = 60; // 30 seconds timeout

// --- Cloudflare Function Entry Point ---
export async function onRequestPost(context) {
    try {
        // --- Environment Variables ---
        const apiKey = context.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

        // Initialize OpenAI Client
        const openai = new OpenAI({ apiKey });

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

        // TODO: Select appropriate tools based on the assistant/topic if needed
        const toolsForRun = toolsOpenAIFormat; // Using the defined tools for now

        // --- Thread Management ---
        let threadId = existingThreadId;
        if (!threadId) {
            console.log("No thread ID provided, creating new thread.");
            const thread = await openai.beta.threads.create();
            threadId = thread.id;
            console.log("Created new thread with ID:", threadId);
        }

        // --- Add Message to Thread ---
        await openai.beta.threads.messages.create(threadId, {
            role: "user",
            content: message,
        });
        console.log(`Message added to thread ${threadId}`);

        // --- Create Run ---
        let run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: assistantId,
            // Pass tools if the assistant is expected to use them
            tools: toolsForRun.length > 0 ? toolsForRun : undefined,
            // instructions: // Optional: Override assistant instructions here
        });
        console.log(`Run created with ID: ${run.id}`);

        // --- Polling Loop --- (Modified for tool calls)
        let attempts = 0;
        while (
            ["queued", "in_progress", "cancelling"].includes(run.status) &&
            attempts < MAX_POLLING_ATTEMPTS
        ) {
            await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
            run = await openai.beta.threads.runs.retrieve(threadId, run.id);
            console.log(`Run status (${attempts + 1}/${MAX_POLLING_ATTEMPTS}): ${run.status}`);
            attempts++;

            // --- Handle Tool Calls --- (Check moved inside loop)
            if (run.status === "requires_action" && run.required_action?.type === "submit_tool_outputs") {
                console.log("Run requires action (tool calls)");
                const toolOutputs = [];
                for (const toolCall of run.required_action.submit_tool_outputs.tool_calls) {
                    const functionName = toolCall.function.name;
                    const handler = toolHandlers[functionName];

                    if (handler) {
                        console.log(`Calling tool handler for: ${functionName}`);
                        try {
                            const args = JSON.parse(toolCall.function.arguments);
                            const output = await handler(args);
                            toolOutputs.push({ tool_call_id: toolCall.id, output: output });
                        } catch (error) {
                            console.error(`Error executing tool ${functionName}:`, error);
                            // Optionally submit an error message back
                            toolOutputs.push({ tool_call_id: toolCall.id, output: JSON.stringify({ error: `Failed to execute tool: ${error.message}` }) });
                        }
                    } else {
                        console.warn(`No handler found for tool: ${functionName}`);
                        toolOutputs.push({ tool_call_id: toolCall.id, output: JSON.stringify({ error: `Tool ${functionName} not implemented.` }) });
                    }
                }

                // Submit outputs back to the run
                if (toolOutputs.length > 0) {
                    console.log("Submitting tool outputs:", toolOutputs);
                    run = await openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
                        tool_outputs: toolOutputs,
                    });
                    console.log("Tool outputs submitted, run status:", run.status);
                } else {
                    console.warn("Required action was tool calls, but no outputs were generated.");
                    // Handle this case? Maybe cancel the run?
                }
            } // End of requires_action check
        } // End of polling loop

        // --- Process Final Run Status ---
        let reply = "An unknown error occurred.";

        if (run.status === "completed") {
            console.log("Run completed, retrieving messages.");
            const messages = await openai.beta.threads.messages.list(threadId, {
                order: "desc", // Get latest messages first
                limit: 10, // Limit to recent messages
            });
            // Find the latest assistant message
            const assistantMessage = messages.data.find(m => m.role === "assistant");
            if (assistantMessage?.content?.[0]?.type === "text") {
                reply = assistantMessage.content[0].text.value;
            } else {
                 reply = "Assistant finished but provided no text response.";
                 console.log("Latest messages data:", messages.data)
            }
        } else if (run.status === "requires_action") {
            // Should have been handled in the loop, but as a fallback:
            reply = "The assistant requires further action, but it wasn't processed.";
            console.error("Run finished with requires_action status unexpectedly.");
        } else {
             // Handle failed, cancelled, expired, timed out
             reply = `The request could not be completed (Status: ${run.status}).`;
             if (run.last_error) {
                 reply += ` Error: ${run.last_error.message}`;
                 console.error("Run failed:", run.last_error);
             } else if (attempts >= MAX_POLLING_ATTEMPTS) {
                 reply = "The request timed out while waiting for the assistant.";
                 console.error("Run timed out.");
             } else {
                 console.error(`Run ended with status: ${run.status}`);
             }
        }

        // --- Return Response to Frontend ---
        const responseData = JSON.stringify({ reply: reply, threadId: threadId });
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

// --- onRequest Handler (remains the same) ---
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
