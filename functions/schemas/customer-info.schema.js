// functions/schemas/customer-info.schema.js

// Define and export the schema for Customer Information
// Using a plain object for OpenAI tool parameters format
export const customerInfoToolSchema = {
    type: 'object',
    properties: {
        customerName: { type: 'string', description: 'Full name of the customer' },
        companyName: { type: 'string', description: 'Company name (optional)' },
        email: { type: 'string', description: 'Customer email address' },
        projectNeeds: { type: 'string', description: 'Customer project needs' },
        timeline: { type: 'string', description: 'Project timeline (optional)' },
        budget: { type: 'string', description: 'Estimated budget (optional)' },
        logoLink: { type: 'string', description: 'URL link to the customer logo file (e.g., SVG, PNG) (optional)' },
        primaryBrandColor: { type: 'string', description: 'Primary brand color (e.g., hex code like #FFFFFF) (optional)' },
    },
    required: ['customerName', 'email', 'projectNeeds']
};

// You can define other schemas here and export them as needed
// export const generalSettingsSchema = { ... };
