# Study Platform — Local / Self-hosted

A full Arabic study platform with AI assistant, powered by Cerebras (free) or OpenAI.

## Requirements
- Node.js 18 or newer — https://nodejs.org
- No npm install needed — server has zero external dependencies

## Setup (one time)

1. Open the `.env` file and paste your API key:
   ```
   CEREBRAS_API_KEY=your_actual_key_here
   ```
   Get a **free** Cerebras key at: https://cloud.cerebras.ai

2. That's it!

## Run

```bash
node server.js
```

Then open **http://localhost:3000** in your browser.

To use a different port:
```bash
PORT=8080 node server.js
```

## Deploy to a cloud service

This project is a plain Node.js app — it runs anywhere:

| Service | Command |
|---------|---------|
| Railway | `node server.js` |
| Render  | `node server.js` |
| Fly.io  | `node server.js` |
| VPS/Linux | `node server.js` |

Set `CEREBRAS_API_KEY` as an environment variable in your cloud dashboard.

## Features
- Flashcards & spaced repetition
- Pomodoro timer
- Study goals & tasks
- Progress tracking & achievements
- AI chat assistant (Arabic/English)
- All data stored locally in browser (localStorage)

## Stop
Press `Ctrl+C` in the terminal.
