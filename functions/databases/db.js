// functions/databases/db.js
import { MongoClient, ObjectId } from 'mongodb'; // Import ObjectId again

let client = null;
let db = null;

async function connectToDatabase(uri) {
    if (db && client) {
        try {
            await client.db('admin').command({ ping: 1 });
            // console.log("Reusing existing MongoDB connection.");
            return { client, db };
        } catch (e) {
            console.warn("MongoDB connection lost, attempting to reconnect...");
            client = null;
            db = null;
        }
    }

    if (!uri) {
        throw new Error('MongoDB URI is not defined. Set MONGODB_URI environment variable.');
    }

    try {
        console.log("Connecting to MongoDB (Node Driver)...");
        client = new MongoClient(uri, {
            serverApi: {
                version: '1', 
                strict: true,
                deprecationErrors: true,
            }
        });

        await client.connect();
        // Determine DB name - use DB name from connection string path or specify default
        const urlParts = uri.split('/');
        const pathPart = urlParts.length > 3 ? urlParts[3] : null;
        const dbNameFromUri = pathPart ? pathPart.split('?')[0] : null;
        const dbName = dbNameFromUri || 'defaultDb'; // Use defaultDb if not in URI path

        console.log(`Connected to MongoDB database: ${dbName}`);
        db = client.db(dbName);

        await db.command({ ping: 1 });
        console.log("Pinged deployment. Successfully connected to MongoDB!");

        return { client, db };
    } catch (error) {
        console.error("Failed to connect to MongoDB", error);
        if (client) {
            await client.close();
            client = null;
            db = null;
        }
        throw error; 
    }
}

export async function getDb(context) {
    const uri = context.env.MONGODB_URI;
    if (!db) {
        await connectToDatabase(uri);
    }
    return db;
}

// Export ObjectId for use in other files
export { ObjectId };

// Convenience functions return the collection object directly
export async function getTasksCollection(context) {
    const database = await getDb(context);
    return database.collection('tasks');
}

export async function getCustomersCollection(context) {
    const database = await getDb(context);
    return database.collection('customers');
}
