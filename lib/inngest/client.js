import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "sensai", name:"Sensai",
    credentials: {
        groq: {
            apiKey: process.env.GROQ_API_KEY,
        },
    },
});