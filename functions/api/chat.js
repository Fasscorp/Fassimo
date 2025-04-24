// functions/api/chat.js

import OpenAI from 'openai';
// Import the Node Driver DB utility functions (CORRECTED PATH AGAIN)
import { getTasksCollection, getCustomersCollection } from '../databases/db.js';

// --- Assistant ID Mapping ---
const assistantMap = {
    "Customer Information": "CUSTOMER_INTERVIEW_ASSISTANT_ID",
    "Product Ideas": "PRODUCT_IDEAS_ASSISTANT_ID",
    "General Settings": "GENERAL_SETTINGS_ASSISTANT_ID",
    // Add mappings for all topics
};

// --- Tool Definitions (OpenAI Format) ---
const toolsOpenAIFormat = [
    {
        type: "function",
        function: {
            name: "saveCustomerData",
            description: "Saves the collected customer information. Ask about logo and brand color too. If logo or color are missing, mention a task will be added.",
            parameters: {
                type: "object",
                properties: {
                    customerName: { type: "string", description: "Full name of the customer" },
                    companyName: { type: "string", description: "Name of the customer company (optional)" },
                    email: { type: "string", description: "Customer email address" },
                    projectNeeds: { type: "string", description: "Summary of the customer project needs" },
                    timeline: { type: "string", description: "Project timeline (optional)" },
                    budget: { type: "string", description: "Estimated budget (optional)" },
                    logoLink: { type: "string", description: "URL link to the customer logo file (e.g., SVG, PNG) (optional)" },
                    primaryBrandColor: { type: "string", description: "Primary brand color (e.g., hex code like #FFFFFF) (optional)" },
                },
                required: ["customerName", "email", "projectNeeds"]
            },
        }
    }
    // Add other tool definitions
];

// --- Tool Handlers --- (Using Node Driver Collections, ensuring client closure)
const toolHandlers = {
    saveCustomerData: async (args, context) => {
        console.log("HANDLER: saveCustomerData called with:", args);
        let message = "Okay, I have saved the customer information.";
        let taskAdded = false;
        let customerClient = null;
        let taskClient = null;

        try {
            // Basic validation
            if (!args.customerName || !args.email || !args.projectNeeds) {
                return JSON.stringify({ success: false, error: "Missing required fields (name, email, needs)." });
            }

            // Get DB collections (get client too)
            const { client: custClient, collection: customersCollection } = await getCustomersCollection(context);
            customerClient = custClient; // Assign for finally block

            // Save customer data
            const customerFilter = { email: args.email };
            const customerUpdate = { $set: { ...args, updatedAt: new Date() } };
            const customerOptions = { upsert: true };
            const customerResult = await customersCollection.updateOne(customerFilter, customerUpdate, customerOptions);
            console.log("Customer save result:", customerResult);

            // Check for logo and color & add task if needed
            const hasLogo = args.logoLink && args.logoLink.trim() !== '';
            const hasColor = args.primaryBrandColor && args.primaryBrandColor.trim() !== '';

            if (!hasLogo || !hasColor) {
                 const { client: tClient, collection: tasksCollection } = await getTasksCollection(context);
                 taskClient = tClient; // Assign task client for finally block

                const missingItems = [];
                if (!hasLogo) missingItems.push('logo link');
                if (!hasColor) missingItems.push('primary brand color');
                const taskDescription = `Provide ${missingItems.join(' and ')}.`;

                const existingTask = await tasksCollection.findOne({
                    relatedCustomerEmail: args.email,
                    name: taskDescription,
                    completed: false
                });

                if (!existingTask) {
                    const newTask = {
                         name: taskDescription,
                         relatedCustomerEmail: args.email,
                         createdAt: new Date(),
                         dueDate: null,
                         tags: ["Onboarding", "Assets"],
                         completed: false,
                         order: Date.now()
                     };
                    const taskResult = await tasksCollection.insertOne(newTask);
                    console.log(`TASK ADDED: ID ${taskResult.insertedId} - ${taskDescription}`);
                    taskAdded = true;
                    message += ` Since the ${missingItems.join(' or ')} was missing, I've added a reminder task for you in the Tasklist section.`;
                } else {
                    console.log(`Task already exists for ${taskDescription} for ${args.email}`);
                     message += ` I see there is already a task for the missing ${missingItems.join(' or ')}. Please check the Tasklist section.`;
                }
            }

            return JSON.stringify({ success: true, taskAdded: taskAdded, message: message });

        } catch (dbError) {
            console.error("Database error in saveCustomerData handler:", dbError);
            return JSON.stringify({ success: false, error: `Failed to save data: ${dbError.message}` });
        } finally {
             // Close both potential clients
            if (customerClient) {
                 await customerClient.close().catch(err => console.error("Error closing customer DB client:", err));
             }
            if (taskClient) {
                 // Important: Check if taskClient was actually assigned before closing
                 if (taskClient !== customerClient) { // Avoid closing the same client twice if only one was opened
                    await taskClient.close().catch(err => console.error("Error closing task DB client:", err));
                 }
             }
        }
    }
    // Add other handlers here
};

// --- Polling Configuration ---
const POLLING_INTERVAL_MS = 500;
const MAX_POLLING_ATTEMPTS = 60;

// --- Cloudflare Function Entry Point ---
export async function onRequestPost(context) {
     try {
        const apiKey = context.env.OPENAI_API_KEY;
        const mongoUri = context.env.MONGODB_URI;
        if (!apiKey || !mongoUri) throw new Error('Missing OPENAI_API_KEY or MONGODB_URI');

        const openai = new OpenAI({ apiKey });

        const requestBody = await context.request.json();
        const { message, topic, threadId: existingThreadId } = requestBody;
        if (!message || !topic) { 
             return new Response(JSON.stringify({ error: 'Missing message or topic' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const assistantEnvVarName = assistantMap[topic];
        if (!assistantEnvVarName) { 
            return new Response(JSON.stringify({ error: `No assistant for topic: ${topic}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
         }
        const assistantId = context.env[assistantEnvVarName];
        if (!assistantId) throw new Error(`Missing env var: ${assistantEnvVarName}`);

        let toolsForRun = [];
        if (topic === "Customer Information") { 
            // Ensure the parameters are correct within the tools definition passed to the run
             toolsOpenAIFormat[0].function.parameters = {
                  type: "object",
                  properties: {
                    customerName: { type: "string", description: "Full name of the customer" },
                    companyName: { type: "string", description: "Name of the customer company (optional)" },
                    email: { type: "string", description: "Customer email address" },
                    projectNeeds: { type: "string", description: "Summary of the customer project needs" },
                    timeline: { type: "string", description: "Project timeline (optional)" },
                    budget: { type: "string", description: "Estimated budget (optional)" },
                    logoLink: { type: "string", description: "URL link to the customer logo file (e.g., SVG, PNG) (optional)" },
                    primaryBrandColor: { type: "string", description: "Primary brand color (e.g., hex code like #FFFFFF) (optional)" },
                },
                required: ["customerName", "email", "projectNeeds"]
            };
            toolsForRun = toolsOpenAIFormat; 
        }

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

        // --- Polling Loop (Pass context to handlers) ---
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
                            // Pass context to the handler
                            const output = await handler(args, context);
                            toolOutputs.push({ tool_call_id: toolCall.id, output: output });
                        } catch (error) { 
                            console.error(`Error executing tool ${functionName}:`, error);
                            toolOutputs.push({ tool_call_id: toolCall.id, output: JSON.stringify({ error: `Failed to execute tool: ${error.message}` }) });
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
         // ... (Process Final Run Status - remains the same) ...
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
            reply = "Assistant requires further action (tool call error?).";
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
        // ... (Error handling - remains the same) ...
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
