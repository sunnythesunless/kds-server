# Render Environment Variables Guide

To deploy your backend to Render, navigate to your **Service Dashboard > Environment > Environment Variables** and add the following.

## 1. Essential Configuration
| Variable | Value / Description |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` (Render listens on the port you bind to, usually 10000, but setting 3000 helps if your code defaults to it) |
| `BASE_URL` | `https://your-service-name.onrender.com` (Your Render Backend URL) |
| `CLIENT_URL` | `https://your-client-app.vercel.app` (Your Frontend URL - critical for CORS) |

## 2. Databases
You need **BOTH** MongoDB (for Auth) and PostgreSQL (for InsightOps) in production. SQLite will **NOT** work on Render as the filesystem is ephemeral.

### MongoDB (Auth)
| Variable | Value |
|---|---|
| `MONGODB_URI` | Your MongoDB Atlas connection string (e.g., `mongodb+srv://...`) |

### PostgreSQL (InsightOps)
Create a PostgreSQL database on Render (or elsewhere) and add these details:
| Variable | Value |
|---|---|
| `DB_DIALECT` | `postgres` (REQUIRED to switch from SQLite) |
| `DB_HOST` | Your Postgres Host (e.g., `dpg-xxxx-a`) |
| `DB_NAME` | Your Postgres Database Name (e.g., `insightops_db`) |
| `DB_USER` | Your Postgres User |
| `DB_PASSWORD` | Your Postgres Password |
| `DB_PORT` | `5432` |

## 3. Secrets & Keys
| Variable | Value |
|---|---|
| `JWT_SECRET` | A long random string |
| `JWT_EXPIRES_IN` | `7d` |
| `REFRESH_TOKEN_SECRET` | Another long random string |
| `REFRESH_TOKEN_EXPIRES_IN` | `7d` |

## 4. AI & External Services
| Variable | Value |
|---|---|
| `GROQ_API_KEY` | Your Groq API Key (or `AI_API_KEY` if you updated the code to match the new docs) |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` (or your preferred model) |
| `EMAIL_SERVICE` | `gmail` (if using email features) |
| `EMAIL_USER` | Your email address |
| `EMAIL_PASS` | Your email app password (NOT your login password) |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | `https://your-service-name.onrender.com/api/auth/google/callback` (Must match Render URL) |
