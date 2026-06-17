from pydantic import BaseModel, Field
from typing import List, Optional


class CandidateBase(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    experience_years: Optional[float] = None

    # Scores by category (heuristic for demo; can be replaced with real ML)
    skills_score: float
    education_score: float
    projects_score: float
    experience_score: float
    semantic_score: float

    # Overall relevance score (kept for compatibility with existing UI)
    relevance_score: float

    # Human-readable explanation and suggestions for improvement
    explanation: str | None = None
    suggestions: str | None = None
    factor_details: dict | None = None


class CandidateOut(CandidateBase):
    id: int
    rank: int

    class Config:
        from_attributes = True


class JobDescriptionCreate(BaseModel):
    title: str
    description: str


class JobDescriptionOut(BaseModel):
    id: int
    title: str
    description: str

    class Config:
        from_attributes = True


class ParseResult(BaseModel):
    job: Optional[JobDescriptionOut]
    candidates: List[CandidateOut]


class UserSignup(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserPublic(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    token: str
    user: UserPublic
