
import { defineContextSchema } from '@modelcontextprotocol/sdk';

// Define and export the schema for Customer Information
export const customerInfoSchema = defineContextSchema({
    type: 'object',
    properties: {
        customerName: { type: 'string', description: 'Full name of the customer' },
        companyName: { type: 'string', description: 'Name of the customer's company (optional)' },
        email: { type: 'string', description: 'Customer's email address' },
        projectNeeds: { type: 'string', description: 'Summary of the customer's project needs, goals, or problems to solve' },
        timeline: { type: 'string', description: 'Desired project start date or timeline (optional)' },
        budget: { type: 'string', description: 'Estimated budget range (optional)' },
        // Add other relevant fields for your customer interview
    },
    required: ['customerName', 'email', 'projectNeeds']
});

// You can define other schemas here and export them as needed
// export const generalSettingsSchema = defineContextSchema({ ... });
