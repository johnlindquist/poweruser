#!/usr/bin/env bun

import { query } from '@anthropic-ai/claude-agent-sdk';
import { parseArgs } from 'util';

const { positionals } = parseArgs({
    args: Bun.argv.slice(2), // Skip executable and script path
    allowPositionals: true,
});

const prompt = positionals[0];
if (!prompt) {
    console.error('Error: Prompt is required as the first argument');
    process.exit(1);
}
console.log(`The prompt is: ${prompt}. API KEY: ${process.env.ZAI_API_KEY}`);
const result = query({
    prompt,
    options: {
        systemPrompt: `You are a helpful assistant.`,
        env: {
            ANTHROPIC_AUTH_TOKEN: process.env.ZAI_API_KEY,
            ANTHROPIC_BASE_URL: "https://api.z.ai/api/anthropic",
            ...process.env
        }
    }
});

for await (const message of result) {
    if (message.type === 'assistant') {
        if (message.message.content[0].type === 'text') {
            console.log(message.message.content[0].text);
        } else {
            console.log(message.message.content[0]);
        }
    }
}


