# TodakTalk (React + TypeScript + Vite + Express + MongoDB)

This project uses Vite (frontend) and a Node/Express API server with MongoDB.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Setup: External MongoDB via IP

1) Copy env template and fill values

```
cp .env.example .env
# Edit .env and set:
# - MONGO_URI: mongodb://USER:PASS@<EXTERNAL_IP>:27017/?authSource=admin
# - DB_NAME: your DB name (default: appdb)
# - JWT_SECRET: change to a secure value
# - PORT: 7780 (matches Vite proxy)
```

2) Install dependencies and run API

```
npm install
npm run server
```

3) In a separate terminal, run frontend (Vite proxy will forward /api to the API)

```
npm run dev
```

4) Health check (optional)

```
curl http://localhost:7780/api/health
```

If ok: true and db: up, your external MongoDB connection works.

## Diary API (MVP)

- GET /api/diary/list — list recent diaries for the logged-in user. Each item has { _id, date, mood, lastUpdatedAt, preview }.
- GET /api/diary/:date — fetch or create a diary for a date (YYYY-MM-DD) and return its messages.
- POST /api/diary/:date/chat { text } — append user's message, get AI reply, detect emotion → color, and persist both.

Notes
- OPENAI_MODEL can be set in `.env` (default: gpt-4o-mini). For cheaper runs, you may set `gpt-3.5-turbo`.
- Detected mood colors drive the Diary page background.

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
