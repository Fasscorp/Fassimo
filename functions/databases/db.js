// functions/databases/db.js
import { MongoClient, ObjectId } from 'mongodb';

// Function to get a DB connection for the current request context
async function getDbConnection(context) {
    const uri = context.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MongoDB URI is not defined. Set MONGODB_URI environment variable.');
    }

    let client;
    try {
        // console.log("Creating new MongoDB connection for this request...");
        client = new MongoClient(uri, {
            serverApi: {
                version: '1',
                strict: true,
                deprecationErrors: true,
            }
        });

        await client.connect();
        // console.log("MongoDB connected for this request.");

        const urlParts = uri.split('/');
        const pathPart = urlParts.length > 3 ? urlParts[3] : null;
        const dbNameFromUri = pathPart ? pathPart.split('?')[0] : null;
        const dbName = dbNameFromUri || 'defaultDb';

        const db = client.db(dbName);

        // Return both client and db - IMPORTANT: Client needs closing by caller
        return { client, db };

    } catch (error) {
        console.error("Failed to connect to MongoDB", error);
        if (client) {
            // Attempt to close client if connection failed mid-way
             try { await client.close(); } catch (closeErr) { console.error("Error closing client after connection failure:", closeErr); }
        }
        throw error;
    }
}

// Export ObjectId for use in other files
export { ObjectId };

// Helper returns client and collection - CALLER MUST CLOSE CLIENT
export async function getTasksCollection(context) {
    const { client, db } = await getDbConnection(context);
    return { client, collection: db.collection('tasks') };
}

// Helper returns client and collection - CALLER MUST CLOSE CLIENT
export async function getCustomersCollection(context) {
    const { client, db } = await getDbConnection(context);
    return { client, collection: db.collection('customers') };
}
