// functions/api/tasks/[[path]].js
import { v4 as uuidv4 } from 'uuid';

// Helper to parse task JSON safely
function parseTask(value) {
    try {
        return JSON.parse(value);
    } catch (e) {
        console.error("Error parsing task JSON from KV:", e, "Value:", value);
        return null; // Return null if parsing fails
    }
}

// Main handler function for all requests to /api/tasks/*
export async function onRequest(context) {
    const { request, env, params } = context;
    const method = request.method;
    const pathSegments = params.path || [];
    const taskId = pathSegments.length > 0 ? pathSegments[0] : null;
    const kv = env.APP_DATA; // Get KV binding

    console.log(`Tasks API (KV): Method=${method}, Path=${request.url}, TaskId=${taskId}`);

    try {
        // --- GET /api/tasks --- (List all tasks)
        if (method === 'GET' && !taskId) {
            console.log("Listing tasks from KV...");
            const listResult = await kv.list({ prefix: "task:" });
            const tasks = [];
            for (const key of listResult.keys) {
                const value = await kv.get(key.name);
                if (value) {
                     const task = parseTask(value);
                     if (task) tasks.push(task);
                }
            }
             // Sort tasks (e.g., by createdAt, or an 'order' field if added)
            tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Newest first

            console.log(`Found ${tasks.length} tasks.`);
            return new Response(JSON.stringify(tasks), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- POST /api/tasks --- (Create new task)
        if (method === 'POST' && !taskId) {
            console.log("Creating new task in KV...");
            const newTaskData = await request.json();
            const taskId = uuidv4();
            const taskKey = `task:${taskId}`;
            const taskToInsert = {
                _id: taskId,
                name: newTaskData.name || 'Untitled Task',
                completed: false,
                tags: newTaskData.tags || [],
                dueDate: newTaskData.dueDate ? new Date(newTaskData.dueDate).toISOString() : null, // Store dates as ISO strings
                createdAt: new Date().toISOString(),
                order: Date.now()
            };
            await kv.put(taskKey, JSON.stringify(taskToInsert));
            console.log(`Task created with key: ${taskKey}`);
            return new Response(JSON.stringify(taskToInsert), {
                status: 201,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- PUT /api/tasks/:id --- (Update task)
        if (method === 'PUT' && taskId) {
             console.log(`Updating task ${taskId} in KV...`);
             const taskKey = `task:${taskId}`;
             const existingValue = await kv.get(taskKey);
             if (!existingValue) {
                 return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404, headers: { 'Content-Type': 'application/json' }});
             }

             const existingTask = parseTask(existingValue);
             if (!existingTask) {
                  return new Response(JSON.stringify({ error: 'Failed to parse existing task data' }), { status: 500, headers: { 'Content-Type': 'application/json' }});
             }

            const updates = await request.json();
            let changed = false;

            // Apply updates
            if (updates.name !== undefined && updates.name !== existingTask.name) {
                 existingTask.name = updates.name;
                 changed = true;
             }
            if (updates.completed !== undefined && updates.completed !== existingTask.completed) {
                 existingTask.completed = updates.completed;
                 changed = true;
             }
            if (updates.dueDate !== undefined) {
                 const newDueDate = updates.dueDate ? new Date(updates.dueDate).toISOString() : null;
                 if (newDueDate !== existingTask.dueDate) {
                     existingTask.dueDate = newDueDate;
                     changed = true;
                 }
             }
             if (updates.tags !== undefined && Array.isArray(updates.tags)) {
                 // Basic check if arrays are different (could be more sophisticated)
                 if (JSON.stringify(updates.tags) !== JSON.stringify(existingTask.tags)) {
                     existingTask.tags = updates.tags;
                     changed = true;
                 }
            }
             existingTask.updatedAt = new Date().toISOString();

             if (!changed) {
                  console.log(`No changes detected for task ${taskId}`);
                  return new Response(JSON.stringify(existingTask), { headers: { 'Content-Type': 'application/json' }});
             }

            await kv.put(taskKey, JSON.stringify(existingTask));
            console.log(`Task ${taskId} updated.`);
            return new Response(JSON.stringify(existingTask), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- DELETE /api/tasks/:id --- (Delete task)
        if (method === 'DELETE' && taskId) {
             console.log(`Deleting task ${taskId} from KV...`);
             const taskKey = `task:${taskId}`;
             // Check if exists before deleting (optional, delete is idempotent)
            // const existingValue = await kv.get(taskKey);
            // if (!existingValue) {
            //    return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404 });
            // }
             await kv.delete(taskKey);
             console.log(`Task ${taskId} deleted.`);
            return new Response(JSON.stringify({ success: true, message: 'Task deleted' }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- OPTIONS (for CORS preflight) ---
        if (method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                }
            });
        }

        // --- Method/Path Not Handled ---
        return new Response(JSON.stringify({ error: 'Method or path not allowed' }), {
            status: 405, headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error in tasks API (KV):", error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}
