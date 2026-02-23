# Deploy na Vercel — Mission Kanban

## Setup Rápido

### 1. Fork/Push para GitHub
```bash
cd ~/mission-kanbam
git push origin master
```

### 2. Deploy na Vercel

Acesse: https://vercel.com/new

1. Selecione o repositório `mission-kanbam`
2. Framework: **Other** (deixe vazio)
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. **Variáveis de Ambiente:**
   - `KANBAN_PASSWORD` = sua senha (ex: `minha-senha-123`)
6. Clique **Deploy**

### 3. Seu URL será algo como:
```
https://mission-kanbam-xxxx.vercel.app
```

### 4. Acesso no Celular

- Abra no navegador do celular: `https://seu-url.vercel.app`
- Digite sua senha
- Pronto! 🎉

---

## Mudança de Senha Depois

1. Acesse https://vercel.com/dashboard
2. Selecione o projeto `mission-kanbam`
3. **Settings** → **Environment Variables**
4. Edite `KANBAN_PASSWORD`
5. Redeploy automático

---

## Local Dev (antes de deploy)

```bash
npm run dev
```

Abre: `http://localhost:5173`

Senha padrão: `changeme123` (definida em `api/auth.js`)

---

## Endpoints Disponíveis

- `GET /api/tasks` — lista de tasks
- `POST /api/tasks` — criar task
- `PUT /api/tasks/:id` — atualizar task
- `DELETE /api/tasks/:id` — deletar task
- `GET /api/costs` — custos por sessão
- `POST /api/auth` — login (password)

---

## Persistência de Dados

⚠️ **Nota:** Dados no `data/tasks.json` são resetados a cada deploy no Vercel.

Para persistência em produção, considere:
- Supabase (PostgreSQL)
- Vercel KV (Redis)
- Firebase Firestore
- PlanetScale (MySQL)

---

## Troubleshooting

**Problema:** "Cannot find module 'fs'"
**Solução:** Vercel Functions suportam `fs` apenas na build time, não em runtime.

Para production, migre para um banco de dados.

---

**Dúvidas?** Avalia o log de deploy no Vercel Dashboard.
