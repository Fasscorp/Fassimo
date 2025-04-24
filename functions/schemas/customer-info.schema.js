
// Try importing from a potential subpath with .js extension
import { defineContextSchema } from '@modelcontextprotocol/sdk/context.js';

// Define and export the schema for Customer Information
export const customerInfoSchema = defineContextSchema({
    type: 'object',
    properties: {
        customerName: { type: 'string', description: 'Full name of the customer' },
        companyName: { type: 'string', description: 'Company name' },
        email: { type: 'string', description: 'Customer email address' },
        projectNeeds: { type: 'string', description: 'Customer project needs' },
        timeline: { type: 'string', description: 'Project timeline' },
        budget: { type: 'string', description: 'Estimated budget' },
    },
    required: ['customerName', 'email', 'projectNeeds']
});

// You can define other schemas here and export them as needed
// export const generalSettingsSchema = defineContextSchema({ ... });
