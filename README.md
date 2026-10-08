# Face ID Davomat — Production

React + Vite frontend va Node.js + Express backend asosidagi Face ID davomat tizimi.

## Arxitektura

- **Frontend:** Netlify
- **Backend:** Railway
- **Storage:** Railway Volume (`/data`)
- **Frontend API URL:** `VITE_API_URL`
- **Backend CORS:** `FRONTEND_URL`
- **Timezone:** `Asia/Tashkent`

## Lokal ishga tushirish

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## Netlify — Frontend

Repository rootini Netlifyga ulang. `netlify.toml` build sozlamalarini avtomatik beradi:

```text
Build command: npm run build --workspace frontend
Publish directory: frontend/dist
```

Netlify Environment Variables:

```text
VITE_API_URL=https://YOUR-RAILWAY-BACKEND.up.railway.app
```

`VITE_API_URL` production build vaqtida frontend bundle ichiga kiradi; bu yerga secret qo'ymang.

## Railway — Backend

Railwayda repositorydan yangi service yarating va **Root Directory** sifatida:

```text
backend
```

ni tanlang.

Start command:

```text
npm start
```

Railway Variables:

```text
NODE_ENV=production
DATA_DIR=/data
FRONTEND_URL=https://YOUR-SITE.netlify.app
ADMIN_LOGIN=admin
ADMIN_PASSWORD=CHANGE_THIS_STRONG_PASSWORD
JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_SECRET
APP_TIMEZONE=Asia/Tashkent
ATTENDANCE_COOLDOWN_SECONDS=90
```

`PORT`ni Railway odatda beradi; server `process.env.PORT`ni ishlatadi.

### Railway Volume — MUHIM

Railway servicega Volume ulang va mount pathni:

```text
/data
```

qiling.

Shunda quyidagilar redeploylardan keyin ham saqlanadi:

```text
/data/db.json
/data/uploads/*
```

Volume ulanmasa, Railwaydagi ephemeral filesystem sababli lokal `db.json` va rasmlar yo'qolishi mumkin.

## Deploy tartibi

1. Avval Railway backendni deploy qiling.
2. Railway public domainini oling, masalan `https://...up.railway.app`.
3. Netlifyda `VITE_API_URL`ga shu backend URLini kiriting.
4. Netlify frontendni deploy qiling.
5. Netlify domainini Railway `FRONTEND_URL`ga kiriting.
6. Railwayni qayta deploy qiling.
7. `https://YOUR-RAILWAY-BACKEND.up.railway.app/api/health` ochilib `{ ok: true }` qaytarishini tekshiring.
8. Netlify saytidan admin login va kamera ishlashini tekshiring.

## Production xavfsizlik

Default `admin/admin123` ishlatish tavsiya etilmaydi. Railway Variablesda kuchli `ADMIN_PASSWORD` va uzun tasodifiy `JWT_SECRET` qo'ying.

## Kamera

Face ID kamera brauzerda HTTPS orqali ishlashi kerak. Netlify production sayti HTTPS bo'lgani uchun kamera permission ishlashi mumkin.
