# IntelliHire Backend (Demo)

FastAPI-based demo backend for the "AI Resume Parser and Candidate Ranking" project.

## Quick start

1. Create and activate a virtual environment (optional but recommended).
2. Install dependencies:

   ```bash
   pip install -r backend/requirements.txt
   ```

3. Run the API server from the project root:

   ```bash
   uvicorn backend.app.main:app --reload
   ```

4. Open the interactive API docs:

   - http://127.0.0.1:8000/docs

By default, the app uses a local SQLite database file `intellihire.db`. To use MySQL, set the `DATABASE_URL` environment variable, for example:

```bash
set DATABASE_URL=mysql+pymysql://user:password@localhost/intellihire
```

(Ensure the MySQL database exists and the `pymysql` driver is installed.)

This backend is intentionally lightweight: the NLP and ranking logic are placeholders that you can later replace with full OCR, NLP models, and ML scoring.
