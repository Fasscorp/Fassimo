// functions/api/tasks/[[path]].js

import { getTasksCollection, ObjectId } from '../../databases/db.js';

export async function onRequest(context) {
    const { request, env, params } = context;
    const method = request.method;
    const pathSegments = params.path || [];
    const taskId = pathSegments.length > 0 ? pathSegments[0] : null;

    console.log(`Tasks API (Node Driver / Per-Request): Method=${method}, Path=${request.url}, TaskId=${taskId}`);

    let dbClient = null; // Variable to hold the client for closing
    try {
        // --- GET /api/tasks --- (Fetch all tasks)
        if (method === 'GET' && !taskId) {
            const { client, collection } = await getTasksCollection(context);
            dbClient = client; // Assign client for finally block
            const tasks = await collection.find({}).sort({ createdAt: -1 }).toArray();
            return new Response(JSON.stringify(tasks), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- POST /api/tasks --- (Create new task)
        if (method === 'POST' && !taskId) {
            const { client, collection } = await getTasksCollection(context);
            dbClient = client;
            const newTaskData = await request.json();
            const taskToInsert = {
                name: newTaskData.name || 'Untitled Task',
                completed: false,
                tags: newTaskData.tags || [],
                dueDate: newTaskData.dueDate ? new Date(newTaskData.dueDate) : null,
                createdAt: new Date(),
                order: Date.now()
            };
            const result = await collection.insertOne(taskToInsert);
            const createdTask = await collection.findOne({ _id: result.insertedId });
             if (!createdTask) throw new Error("Failed to fetch created task after insert.");
            return new Response(JSON.stringify(createdTask), {
                status: 201, headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- PUT /api/tasks/:id --- (Update task)
        if (method === 'PUT' && taskId) {
            if (!ObjectId.isValid(taskId)) {
                return new Response(JSON.stringify({ error: 'Invalid Task ID format' }), { status: 400 });
            }
            const { client, collection } = await getTasksCollection(context);
            dbClient = client;
            const updates = await request.json();
            const updateDoc = { $set: {} };

             // Build updateDoc as before
             if (updates.name !== undefined) updateDoc.$set.name = updates.name;
             if (updates.completed !== undefined) updateDoc.$set.completed = updates.completed;
             if (updates.dueDate !== undefined) updateDoc.$set.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
             if (updates.tags !== undefined && Array.isArray(updates.tags)) updateDoc.$set.tags = updates.tags;
             updateDoc.$set.updatedAt = new Date();

             if (Object.keys(updateDoc.$set).length <= 1) {
                 return new Response(JSON.stringify({ error: 'No valid fields provided for update' }), { status: 400 });
             }

            const result = await collection.findOneAndUpdate(
                { _id: new ObjectId(taskId) },
                updateDoc,
                { returnDocument: 'after' }
            );

            if (!result) {
                return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404 });
            }
            return new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- DELETE /api/tasks/:id --- (Delete task)
        if (method === 'DELETE' && taskId) {
            if (!ObjectId.isValid(taskId)) {
                 return new Response(JSON.stringify({ error: 'Invalid Task ID format' }), { status: 400 });
            }
            const { client, collection } = await getTasksCollection(context);
            dbClient = client;
            const result = await collection.deleteOne({ _id: new ObjectId(taskId) });
            if (result.deletedCount === 0) {
                return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404 });
            }
            return new Response(JSON.stringify({ success: true, message: 'Task deleted' }), {
                 headers: { 'Content-Type': 'application/json' }
             });
        }

        // --- OPTIONS (for CORS preflight) ---
        if (method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*', // Adjust for production
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
        console.error("Error in tasks API (Node Driver):", error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    } finally {
        // Ensure the client connection is closed after the request is handled
        if (dbClient) {
            // console.log("Closing MongoDB client connection for this request...");
             await dbClient.close().catch(err => console.error("Error closing MongoDB client:", err));
        }
    }
}
