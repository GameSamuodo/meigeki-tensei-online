# Deploy

## 1. Deploy the API to Render

Use [Render](https://render.com/docs/web-services) to deploy the Node server in [`server.ts`](/Users/samu/my-boardgame/server.ts).

- Create a new Web Service from this repo.
- Render can also read [`render.yaml`](/Users/samu/my-boardgame/render.yaml).
- Runtime: `Node`
- Build command: `npm install`
- Start command: `npm run server`
- Health check path: `/api/health`

After deploy, copy the public Render URL.

## 2. Deploy the frontend to Vercel

Use [Vercel](https://vercel.com/docs/frameworks/frontend/vite) to deploy the Vite app.

- Import this repo into Vercel.
- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

Set this environment variable in Vercel:

- `VITE_API_BASE_URL=https://your-render-service.onrender.com`

The frontend reads that value in [`src/App.tsx`](/Users/samu/my-boardgame/src/App.tsx) and sends all `/api/...` requests to Render in production.

## 3. Local dev

Run the API:

```bash
npm run server
```

Run the frontend:

```bash
npm run dev
```

Vite proxies `/api` to `http://localhost:8787` in dev via [`vite.config.ts`](/Users/samu/my-boardgame/vite.config.ts).
