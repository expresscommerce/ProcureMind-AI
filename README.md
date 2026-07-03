# ProcureMind AI

ProcureMind AI is a comprehensive procurement and vendor audit platform. This application allows you to upload vendor contracts and proposals, run them through an AI pipeline for information extraction, cost analysis, and risk assessment, and interact with the data via a rich dashboard and a RAG-powered Q&A interface.

## Prerequisites

- Python 3.10+
- Node.js 18+
- Supabase Project

## Supabase Configuration

Your Supabase project requires the following setup:

### 1. Database Schema
Ensure all migrations are run. The database uses `uuid` primary keys and contains tables for `projects`, `documents`, and `results`.

### 2. Authentication
- Go to Authentication -> Providers and enable Email.
- Disable "Confirm email" if you want users to sign in immediately without verification.

### 3. Storage
- Create a bucket named `documents`.
- Ensure it is private (or public depending on your strict security needs).

### 4. Row Level Security (RLS)
- You must create RLS policies on the `projects`, `documents`, and `results` tables so that users can only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` rows where `user_id = auth.uid()`.

## Environment Variables

### Backend (`apps/backend/.env`)

```ini
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_DB_URL=postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
DEEPINFRA_API_KEY=your_deepinfra_api_key
```

### Frontend (`apps/frontend/.env.local`)

```ini
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Local Setup

### 1. Backend

Navigate to `apps/backend`:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start server
uvicorn main:app --reload --port 8000
```

### 2. Frontend

Navigate to `apps/frontend`:
```bash
npm install
npm run dev
```

## Architecture Notes & Limitations

- **LLM Provider Setup:** The application is currently wired to use DeepInfra (`meta-llama/Meta-Llama-3-70B-Instruct` for chat and `BAAI/bge-large-en-v1.5` for embeddings). To swap to OpenAI, modify `apps/backend/agent.py` to use the standard `ChatOpenAI` and `OpenAIEmbeddings` classes without the `base_url` override.
- **Background Tasks:** The pipeline runs inside FastAPI `BackgroundTasks` via `asyncio`. If job volume grows, this should be swapped to Celery and Redis to ensure reliable distributed task queuing.
- **FAISS Index Rebuild:** Currently, the FAISS index is built synchronously during the Information Extraction step of the pipeline. If a document is updated, the index must be rebuilt. For production, consider using a persistent vector database like Pinecone, Qdrant, or Supabase pgvector.
- **Rate Limits:** DeepInfra has rate limits. If you parse extremely large documents, ensure you implement exponential backoff and retry logic in `agent.py`.
