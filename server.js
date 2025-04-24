import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import path from 'path'; // Import the 'path' module
import { fileURLToPath } from 'url'; // Import 'fileURLToPath'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// ---> Add this section to serve static files <---
// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));
// ---> End of static files section <---

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/ask', async (req, res) => {
  try {
    const { message } = req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: message }],
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error('OpenAI API Error:', error); // Log specific error
    res.status(500).json({ error: 'An error occurred processing your request.' }); // More generic error message
  }
});

// ---> Add this Catch-all route for SPAs <---
// Handles any requests that don't match the ones above
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
// ---> End of Catch-all route <---


app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
