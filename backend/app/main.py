from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import hashlib
import secrets
import os

from PyPDF2 import PdfReader
from docx import Document

from . import models, schemas
from .database import Base, engine, get_db
from .parser_service import extract_basic_entities, compute_category_scores

Base.metadata.create_all(bind=engine)

app = FastAPI(title="IntelliHire API", version="0.1.0")

# Allow local frontend
origins = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:5500",
    "*",  # relax for demo / academic project
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _verify_password(password: str, password_hash: str) -> bool:
    return _hash_password(password) == password_hash


def _generate_token() -> str:
    return secrets.token_hex(16)


@app.post("/api/job", response_model=schemas.JobDescriptionOut)
async def create_job(job: schemas.JobDescriptionCreate, db: Session = Depends(get_db)):
    db_job = models.JobDescription(title=job.title, description=job.description)
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    return db_job


@app.get("/api/job/{job_id}", response_model=schemas.JobDescriptionOut)
async def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(models.JobDescription, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job description not found")
    return job


@app.post("/api/auth/signup", response_model=schemas.AuthResponse)
async def signup(payload: schemas.UserSignup, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        email=payload.email,
        full_name=payload.full_name,
        password_hash=_hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = _generate_token()
    return schemas.AuthResponse(
        token=token,
        user=schemas.UserPublic.from_orm(user),
    )


@app.post("/api/auth/login", response_model=schemas.AuthResponse)
async def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not _verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = _generate_token()
    return schemas.AuthResponse(
        token=token,
        user=schemas.UserPublic.from_orm(user),
    )


@app.post("/api/resumes/upload", response_model=schemas.ParseResult)
async def upload_resumes(
    files: List[UploadFile] = File(...),
    job_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    job: Optional[models.JobDescription] = None
    if job_id is not None:
        job = db.get(models.JobDescription, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job description not found")

    candidates_out: List[schemas.CandidateOut] = []

    for f in files:
        content_bytes = await f.read()
        filename = f.filename or ""
        ext = os.path.splitext(filename)[1].lower()

        text = ""
        # Prefer structured parsers for PDFs and DOCX files.
        if ext == ".pdf":
            try:
                from io import BytesIO

                reader = PdfReader(BytesIO(content_bytes))
                pages_text = []
                for page in reader.pages:
                    try:
                        pages_text.append(page.extract_text() or "")
                    except Exception:
                        continue
                text = "\n".join(pages_text)
            except Exception:
                # Fallback to naive decode if PDF parsing fails
                text = content_bytes.decode("utf-8", errors="ignore")
        elif ext == ".docx":
            try:
                from io import BytesIO

                doc = Document(BytesIO(content_bytes))
                paragraphs = [p.text for p in doc.paragraphs]
                text = "\n".join(paragraphs)
            except Exception:
                text = content_bytes.decode("utf-8", errors="ignore")
        else:
            # Plain text, .doc or unknown extension: best-effort decode
            text = content_bytes.decode("utf-8", errors="ignore")

        # Derive a human-friendly name from the file name (without extension).
        base_name = os.path.splitext(filename)[0].strip()
        if base_name:
            # Replace underscores/dashes with spaces for nicer display.
            base_name = base_name.replace("_", " ").replace("-", " ").strip()

        entities = extract_basic_entities(text)

        # If the parsed name looks like a PDF header or is too generic, fall back to the file name.
        raw_name = (entities.get("name") or "").strip()
        if not raw_name or raw_name.startswith("%PDF") or raw_name.lower().startswith("unknown"):
            if base_name:
                entities["name"] = base_name
            else:
                entities["name"] = "Unknown Candidate"

        scores = compute_category_scores(entities, job.description if job else None)

        candidate = models.Candidate(
            name=entities["name"],
            email=entities["email"],
            phone=entities["phone"],
            skills=", ".join(entities["skills"]),
            experience_years=entities["experience_years"],
            raw_text=text,
            relevance_score=scores["total"],
            job=job,
        )
        db.add(candidate)
        db.flush()  # get id without full commit yet

        # rank placeholder; will be updated after sorting
        candidates_out.append(
            schemas.CandidateOut(
                id=candidate.id or 0,
                name=candidate.name,
                email=candidate.email,
                phone=candidate.phone,
                skills=entities["skills"],
                experience_years=candidate.experience_years,
                skills_score=scores["skills_score"],
                education_score=scores["education_score"],
                projects_score=scores["projects_score"],
                experience_score=scores["experience_score"],
                semantic_score=scores["semantic_score"],
                relevance_score=scores["total"],
                explanation=scores.get("explanation"),
                suggestions=scores.get("suggestions"),
                factor_details=scores.get("factor_details"),
                rank=0,
            )
        )

    db.commit()

    # compute rank based on score
    candidates_out_sorted = sorted(candidates_out, key=lambda c: c.relevance_score, reverse=True)
    for idx, c in enumerate(candidates_out_sorted, start=1):
        c.rank = idx

    return schemas.ParseResult(job=job, candidates=candidates_out_sorted)


@app.get("/api/candidates", response_model=List[schemas.CandidateOut])
async def list_candidates(
    job_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Candidate)
    if job_id is not None:
        query = query.filter(models.Candidate.job_id == job_id)

    records = query.order_by(models.Candidate.relevance_score.desc()).all()

    candidates: List[schemas.CandidateOut] = []
    for idx, c in enumerate(records, start=1):
        skills = [s.strip() for s in (c.skills or "").split(",") if s.strip()]
        entities = {
            "skills": skills,
            "experience_years": c.experience_years,
            "has_education": True if c.raw_text and "education" in c.raw_text.lower() else False,
            "has_projects": True if c.raw_text and "project" in c.raw_text.lower() else False,
            "raw_text": c.raw_text or "",
        }

        scores = compute_category_scores(entities, c.job.description if c.job else None)
        candidates.append(
            schemas.CandidateOut(
                id=c.id,
                name=c.name,
                email=c.email,
                phone=c.phone,
                skills=skills,
                experience_years=c.experience_years,
                skills_score=scores["skills_score"],
                education_score=scores["education_score"],
                projects_score=scores["projects_score"],
                experience_score=scores["experience_score"],
                semantic_score=scores["semantic_score"],
                relevance_score=scores["total"],
                explanation=scores.get("explanation"),
                suggestions=scores.get("suggestions"),
                factor_details=scores.get("factor_details"),
                rank=idx,
            )
        )

    return candidates


@app.delete("/api/candidates")
async def clear_candidates(db: Session = Depends(get_db)):
    """Delete all candidates from the database (demo utility)."""
    db.query(models.Candidate).delete()
    db.commit()
    return {"status": "cleared"}


@app.delete("/api/candidates/{candidate_id}")
async def delete_candidate(candidate_id: int, db: Session = Depends(get_db)):
    """Delete a single candidate by ID (demo utility)."""
    candidate = db.get(models.Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    db.delete(candidate)
    db.commit()
    return {"status": "deleted", "id": candidate_id}


@app.get("/health")
async def health():
    return {"status": "ok"}
