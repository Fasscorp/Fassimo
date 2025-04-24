// functions/api/chat.js

import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid'; // Import UUID library

// We might need helper functions if db logic gets complex, but for now access KV directly
// import { getTasksCollectionHelper, getCustomersCollectionHelper } from '../databases/db.js';

// --- Assistant ID Mapping ---
const assistantMap = {
    "Customer Information": "CUSTOMER_INTERVIEW_ASSISTANT_ID",
    "Branding Settings": "BRANDING_ASSISTANT_ID", // Added mapping
    "Product Ideas": "PRODUCT_IDEAS_ASSISTANT_ID",
    "General Settings": "GENERAL_SETTINGS_ASSISTANT_ID",
    // Add mappings for all topics
};

// --- Tool Parameter Schemas ---
const customerInfoParams = {
    type: "object",
    properties: {
        customerName: { type: "string", description: "Full name of the customer" },
        companyName: { type: "string", description: "Name of the customer company (optional)" },
        email: { type: "string", description: "Customer email address for identification" },
        projectNeeds: { type: "string", description: "Summary of the customer project needs" },
        timeline: { type: "string", description: "Project timeline (optional)" },
        budget: { type: "string", description: "Estimated budget (optional)" },
    },
    required: ["customerName", "email", "projectNeeds"]
};

const brandingParams = {
    type: "object",
    properties: {
        logoLink: { type: "string", description: "URL link to the customer logo file (e.g., SVG, PNG). Should be null or empty if not provided." },
        primaryBrandColor: { type: "string", description: "Primary brand color (e.g., hex code like #FFFFFF). Should be null or empty if not provided." }
    },
    required: [] // Handler checks for values
};

// --- Tool Definitions --- (Passed to OpenAI Run)
const customerInfoTool = {
    type: "function",
    function: {
        name: "saveCustomerData",
        description: "Saves the collected customer information (name, email, needs, timeline, budget).",
        parameters: customerInfoParams
    }
};

const brandingTool = {
    type: "function",
    function: {
        name: "saveBrandingData",
        description: "Saves the logo URL and primary brand color. Mentions task creation if data is missing.",
        parameters: brandingParams
    }
};


// --- Tool Handlers --- (Using Cloudflare KV)
const toolHandlers = {
    saveCustomerData: async (args, context, threadId) => {
        console.log("HANDLER: saveCustomerData called with:", args);
        const message = "Okay, I have saved the customer information.";
        const kv = context.env.APP_DATA;
        try {
            if (!args.customerName || !args.email || !args.projectNeeds) {
                return JSON.stringify({ success: false, error: "Missing required fields (name, email, needs)." });
            }
            const customerKey = `customer:${args.email}`;
            let existingData = {};
            const existingValue = await kv.get(customerKey);
            if (existingValue) {
                existingData = JSON.parse(existingValue);
            }
            // Only save fields defined in this tool's schema
            const dataToSave = {
                customerName: args.customerName,
                companyName: args.companyName,
                email: args.email,
                projectNeeds: args.projectNeeds,
                timeline: args.timeline,
                budget: args.budget
            };
            const customerData = { ...existingData, ...dataToSave, updatedAt: new Date().toISOString() };
            await kv.put(customerKey, JSON.stringify(customerData));
            console.log(`Customer data updated/saved to KV with key: ${customerKey}`);
            return JSON.stringify({ success: true, message: message });
        } catch (kvError) {
            console.error("KV error in saveCustomerData handler:", kvError);
            return JSON.stringify({ success: false, error: `Failed to save customer data: ${kvError.message}` });
        }
    },

    saveBrandingData: async (args, context, threadId) => {
        console.log("HANDLER: saveBrandingData called with:", args);
        let message = "Okay, I've saved the branding settings.";
        let taskAdded = false;
        const kv = context.env.APP_DATA;

        // We need customer context. Let's assume the assistant asks for email if needed,
        // or we retrieve based on threadId (requires storing thread->email mapping first)
        // For now, store branding associated with the threadId as a simpler approach.
        const brandingKey = `branding:${threadId}`; // Use threadId for association

        if (!threadId) {
             console.error("Cannot save branding data without threadId context.");
             return JSON.stringify({ success: false, error: "Could not determine context to save branding for." });
        }

        try {
            const hasLogo = args.logoLink && args.logoLink.trim() !== '';
            const hasColor = args.primaryBrandColor && args.primaryBrandColor.trim() !== '';

            // Save branding data keyed by threadId
            const brandingData = {
                logoLink: args.logoLink || null,
                primaryBrandColor: args.primaryBrandColor || null,
                updatedAt: new Date().toISOString()
            };
            await kv.put(brandingKey, JSON.stringify(brandingData));
            console.log(`Branding data saved to KV with key: ${brandingKey}`);

            // Add task if needed
            if (!hasLogo || !hasColor) {
                const missingItems = [];
                if (!hasLogo) missingItems.push('logo link');
                if (!hasColor) missingItems.push('primary brand color');
                const taskDescription = `Provide ${missingItems.join(' and ')}.`;
                const taskRequestKey = `taskreq:${threadId}:${taskDescription}`; // Use threadId
                const existingTaskRequest = await kv.get(taskRequestKey);

                if (!existingTaskRequest) {
                    const taskId = uuidv4();
                    const taskKey = `task:${taskId}`;
                    const newTask = {
                        _id: taskId,
                        name: taskDescription,
                        relatedThreadId: threadId, // Link task to thread
                        createdAt: new Date().toISOString(),
                        dueDate: null,
                        tags: ["Onboarding", "Assets"],
                        completed: false,
                        order: Date.now()
                    };
                    await kv.put(taskKey, JSON.stringify(newTask));
                    await kv.put(taskRequestKey, "created", { expirationTtl: 3600 });
                    console.log(`TASK ADDED to KV: Key ${taskKey} - ${taskDescription}`);
                    taskAdded = true;
                    message += ` Since the ${missingItems.join(' or ')} was missing, I've added a reminder task for you in the Tasklist section.`;
                } else {
                    console.log(`Task request already processed recently for ${taskDescription} for thread ${threadId}`);
                    message += ` I see there is already a task for the missing ${missingItems.join(' or ')}. Please check the Tasklist section.`;
                }
            }
            return JSON.stringify({ success: true, taskAdded: taskAdded, message: message });
        } catch (kvError) {
            console.error("KV error in saveBrandingData handler:", kvError);
            return JSON.stringify({ success: false, error: `Failed to save branding data: ${kvError.message}` });
        }
    }
};

// --- Polling Configuration ---
const POLLING_INTERVAL_MS = 500;
const MAX_POLLING_ATTEMPTS = 60;

// --- Cloudflare Function Entry Point ---
export async function onRequestPost(context) {
     try {
        const apiKey = context.env.OPENAI_API_KEY;
        const kvBinding = context.env.APP_DATA;
        if (!apiKey || !kvBinding) throw new Error('Missing OPENAI_API_KEY or APP_DATA KV binding');

        const openai = new OpenAI({ apiKey });

        const requestBody = await context.request.json();
        const { message, topic, threadId: existingThreadId } = requestBody;
        if (!message || !topic) { 
             return new Response(JSON.stringify({ error: 'Missing message or topic' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const assistantEnvVarName = assistantMap[topic];
        if (!assistantEnvVarName) { 
            return new Response(JSON.stringify({ error: `No assistant configured for topic: ${topic}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
         }
        const assistantId = context.env[assistantEnvVarName];
        if (!assistantId) throw new Error(`Missing env var ${assistantEnvVarName} for topic ${topic}`);

        // Select correct tools based on topic
        let toolsForRun = [];
        if (topic === "Customer Information") {
            toolsForRun = [customerInfoTool]; 
        } else if (topic === "Branding Settings") {
             toolsForRun = [brandingTool];
        }
        // Add other topic/tool mappings here

        let threadId = existingThreadId;
        if (!threadId) {
            const thread = await openai.beta.threads.create();
            threadId = thread.id;
            console.log("Created thread:", threadId);
        }

        await openai.beta.threads.messages.create(threadId, { role: "user", content: message });
        console.log(`Message added to thread ${threadId}`);

        let run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: assistantId,
            tools: toolsForRun.length > 0 ? toolsForRun : undefined,
        });
        console.log(`Run created: ${run.id}`);

        // --- Polling Loop (Pass context and threadId to handlers) ---
        let attempts = 0;
        while (["queued", "in_progress", "cancelling"].includes(run.status) && attempts < MAX_POLLING_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
            run = await openai.beta.threads.runs.retrieve(threadId, run.id);
            console.log(`Run status (${attempts + 1}/${MAX_POLLING_ATTEMPTS}): ${run.status}`);
            attempts++;

            if (run.status === "requires_action" && run.required_action?.type === "submit_tool_outputs") {
                const toolOutputs = [];
                for (const toolCall of run.required_action.submit_tool_outputs.tool_calls) {
                    const functionName = toolCall.function.name;
                    const handler = toolHandlers[functionName];
                    if (handler) {
                        console.log(`Calling handler for: ${functionName}`);
                        try {
                            const args = JSON.parse(toolCall.function.arguments);
                            // Pass context AND threadId to the handler
                            const output = await handler(args, context, threadId);
                            toolOutputs.push({ tool_call_id: toolCall.id, output: output });
                        } catch (error) { 
                            console.error(`Error executing or parsing args for tool ${functionName}:`, error);
                            toolOutputs.push({ tool_call_id: toolCall.id, output: JSON.stringify({ error: `Failed to execute tool or parse args: ${error.message}` }) });
                         }
                    } else { 
                        console.warn(`No handler found for tool: ${functionName}`);
                        toolOutputs.push({ tool_call_id: toolCall.id, output: JSON.stringify({ error: `Tool ${functionName} not implemented.` }) });
                     }
                }
                if (toolOutputs.length > 0) {
                     console.log("Submitting tool outputs:", toolOutputs);
                     run = await openai.beta.threads.runs.submitToolOutputs(threadId, run.id, { tool_outputs: toolOutputs });
                     console.log("Tool outputs submitted, run status:", run.status);
                } else { console.warn("Required action was tool calls, but no outputs generated."); }
            }
        }
        
        // --- Process Final Run Status ---
        let reply = "An unknown error occurred.";
        if (run.status === "completed") {
             console.log("Run completed, retrieving messages.");
             const messages = await openai.beta.threads.messages.list(threadId, { order: "desc", limit: 5 });
             const assistantMessage = messages.data.find(m => m.role === "assistant");
             if (assistantMessage?.content?.[0]?.type === "text") {
                 reply = assistantMessage.content[0].text.value;
             } else {
                 reply = "Assistant finished but provided no text response.";
                 console.log("Latest messages data:", messages.data);
             }
        } else if (run.status === "requires_action") {
            reply = "Assistant requires further action but it couldn't be processed.";
            console.error("Run ended with requires_action status unexpectedly.");
        } else {
             reply = `Request failed (Status: ${run.status}).`;
             if (run.last_error) {
                 reply += ` Error: ${run.last_error.message}`;
                 console.error("Run failed:", run.last_error);
             } else if (attempts >= MAX_POLLING_ATTEMPTS) {
                 reply = "Request timed out waiting for assistant.";
                 console.error("Run timed out.");
             } else {
                 console.error(`Run ended with status: ${run.status}`);
             }
        }

        const responseData = JSON.stringify({ reply: reply, threadId: threadId });
        return new Response(responseData, { headers: { 'Content-Type': 'application/json' }, status: 200 });

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
   // ... (remains the same) ...
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
