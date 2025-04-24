// functions/databases/db.js

// Helper function to construct the Data API request body
const createDataApiPayload = (dataSource, database, collection, action, params = {}) => ({
    dataSource: dataSource || 'Cluster0', // Default Atlas cluster name, adjust if needed
    database: database,
    collection: collection,
    ...params,
});

// Helper function to make the Data API fetch call
async function fetchMongoDataAPI(context, action, params) {
    const DATA_API_URL = context.env.DATA_API_URL;
    const DATA_API_KEY = context.env.DATA_API_KEY;

    if (!DATA_API_URL || !DATA_API_KEY) {
        throw new Error('Missing DATA_API_URL or DATA_API_KEY environment variables.');
    }

    // Extract DB name from the environment or use a default
    const DB_NAME = context.env.DB_NAME || 'defaultDb'; 
    const DATA_SOURCE = context.env.DATA_SOURCE || 'Cluster0';

    const url = `${DATA_API_URL}/action/${action}`;
    const collection = params.collection; 
    if (!collection) {
        throw new Error('Collection name must be provided in params for Data API call.');
    }

    const payload = createDataApiPayload(DATA_SOURCE, DB_NAME, collection, action, params);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': DATA_API_KEY,
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errorBody;
            try { errorBody = await response.json(); } catch (e) { errorBody = await response.text(); }
            console.error("Data API Error Response:", errorBody);
            throw new Error(`Data API request failed: ${response.status} ${response.statusText}`);
        }
        return await response.json();

    } catch (error) {
        console.error(`Data API fetch error for action ${action}:`, error);
        throw error; 
    }
}

// --- Collection Helper Functions --- 

// Find documents
export async function findDocuments(context, collection, filter = {}, options = {}) {
    const params = { collection, filter, ...options }; 
    const result = await fetchMongoDataAPI(context, 'find', params);
    return result.documents || []; 
}

// Find a single document
export async function findOneDocument(context, collection, filter = {}, options = {}) {
    const params = { collection, filter, ...options };
    const result = await fetchMongoDataAPI(context, 'findOne', params);
    return result.document; 
}

// Insert a single document
export async function insertOneDocument(context, collection, document) {
    const params = { collection, document };
    const result = await fetchMongoDataAPI(context, 'insertOne', params);
    return result; // Contains { insertedId: "..." }
}

// Update a single document
export async function updateOneDocument(context, collection, filter, update, options = {}) {
    const params = { collection, filter, update, ...options }; 
    const result = await fetchMongoDataAPI(context, 'updateOne', params);
    return result; // Contains { matchedCount, modifiedCount, upsertedId (optional) }
}

// Delete a single document
export async function deleteOneDocument(context, collection, filter) {
    const params = { collection, filter };
    const result = await fetchMongoDataAPI(context, 'deleteOne', params);
    return result; // Contains { deletedCount: 1 }
}

// Convenience functions for specific collections
export async function getTasksCollectionHelper(context) {
    const collectionName = 'tasks';
    return {
        find: (filter = {}, options = {}) => findDocuments(context, collectionName, filter, options),
        findOne: (filter = {}, options = {}) => findOneDocument(context, collectionName, filter, options),
        insertOne: (document) => insertOneDocument(context, collectionName, document),
        updateOne: (filter, update, options = {}) => updateOneDocument(context, collectionName, filter, update, options),
        deleteOne: (filter) => deleteOneDocument(context, collectionName, filter),
    };
}

export async function getCustomersCollectionHelper(context) {
    const collectionName = 'customers';
    return {
        find: (filter = {}, options = {}) => findDocuments(context, collectionName, filter, options),
        findOne: (filter = {}, options = {}) => findOneDocument(context, collectionName, filter, options),
        insertOne: (document) => insertOneDocument(context, collectionName, document),
        updateOne: (filter, update, options = {}) => updateOneDocument(context, collectionName, filter, update, options),
        deleteOne: (filter) => deleteOneDocument(context, collectionName, filter),
    };
}
