// functions/api/tasks/[[path]].js

import { getTasksCollection, ObjectId } from '../../databases/db.js';

// Main handler function for all requests to /api/tasks/*
export async function onRequest(context) {
    const { request, env, params } = context;
    const method = request.method;
    const pathSegments = params.path || [];
    const taskId = pathSegments.length > 0 ? pathSegments[0] : null;

    console.log(`Tasks API (Node Driver): Method=${method}, Path=${request.url}, TaskId=${taskId}`);

    try {
        const tasksCollection = await getTasksCollection(context);

        // --- GET /api/tasks --- (Fetch all tasks)
        if (method === 'GET' && !taskId) {
            const tasks = await tasksCollection.find({}).sort({ createdAt: -1 }).toArray();
            return new Response(JSON.stringify(tasks), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- POST /api/tasks --- (Create new task)
        if (method === 'POST' && !taskId) {
            const newTaskData = await request.json();
            const taskToInsert = {
                name: newTaskData.name || 'Untitled Task',
                completed: false,
                tags: newTaskData.tags || [],
                dueDate: newTaskData.dueDate ? new Date(newTaskData.dueDate) : null,
                createdAt: new Date(),
                order: Date.now()
            };
            const result = await tasksCollection.insertOne(taskToInsert);
            const createdTask = await tasksCollection.findOne({ _id: result.insertedId });
            return new Response(JSON.stringify(createdTask), {
                status: 201, headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- PUT /api/tasks/:id --- (Update task)
        if (method === 'PUT' && taskId) {
            if (!ObjectId.isValid(taskId)) {
                return new Response(JSON.stringify({ error: 'Invalid Task ID format' }), { status: 400, headers: { 'Content-Type': 'application/json' }});
            }
            const updates = await request.json();
            const updateDoc = { $set: {} };

            if (updates.name !== undefined) updateDoc.$set.name = updates.name;
            if (updates.completed !== undefined) updateDoc.$set.completed = updates.completed;
            if (updates.dueDate !== undefined) updateDoc.$set.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
            if (updates.tags !== undefined && Array.isArray(updates.tags)) updateDoc.$set.tags = updates.tags;
            updateDoc.$set.updatedAt = new Date();

            if (Object.keys(updateDoc.$set).length <= 1) {
                return new Response(JSON.stringify({ error: 'No valid fields provided for update' }), { status: 400, headers: { 'Content-Type': 'application/json' }});
            }

            const result = await tasksCollection.findOneAndUpdate(
                { _id: new ObjectId(taskId) },
                updateDoc,
                { returnDocument: 'after' }
            );

            if (!result) {
                return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404, headers: { 'Content-Type': 'application/json' }});
            }
            return new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- DELETE /api/tasks/:id --- (Delete task)
        if (method === 'DELETE' && taskId) {
            if (!ObjectId.isValid(taskId)) {
                return new Response(JSON.stringify({ error: 'Invalid Task ID format' }), { status: 400, headers: { 'Content-Type': 'application/json' }});
            }
            const result = await tasksCollection.deleteOne({ _id: new ObjectId(taskId) });
            if (result.deletedCount === 0) {
                return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404, headers: { 'Content-Type': 'application/json' }});
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
    }
}
