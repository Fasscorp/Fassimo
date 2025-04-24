
import { defineTool } from '@modelcontextprotocol/sdk';
import { customerInfoSchema } from '../schemas/customer-info.schema.js'; // Import the schema

// Define and export the tool for saving customer information
export const saveCustomerInfoTool = defineTool({
    name: 'saveCustomerData',
    description: 'Saves the collected customer information once all required details are gathered.',
    inputSchema: customerInfoSchema.schema, // Use the imported schema
    handler: async (filledJsonData) => {
        console.log('Tool Handler: Received customer data from Assistant:', filledJsonData);
        // --->>> Your logic to save/process filledJsonData goes here
        // Example: await saveToDatabase(filledJsonData);
        // Return a confirmation message for the Assistant/User
        return { success: true, message: 'Okay, I have saved that customer information.' };
    }
});

// You can define other tools here and export them as needed
// export const updateGeneralSettingsTool = defineTool({ ... });
