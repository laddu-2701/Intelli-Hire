import re
from typing import List, Dict, Any


# Expanded skill vocabulary for more realistic matching.
COMMON_SKILLS = [
    # Programming languages
    "python",
    "java",
    "c",
    "c++",
    "c#",
    "javascript",
    "typescript",
    # Web / backend
    "html",
    "css",
    "react",
    "node.js",
    "django",
    "flask",
    "spring",
    "spring boot",
    # Data / ML
    "mysql",
    "postgresql",
    "sql",
    "nlp",
    "machine learning",
    "deep learning",
    "pandas",
    "numpy",
    "scikit-learn",
    "pytorch",
    "tensorflow",
    # Cloud / devops
    "azure",
    "aws",
    "gcp",
    "docker",
    "kubernetes",
]


IDEAL_PROFILE_TEXT = (
    "We are looking for an AI and machine learning engineer "
    "with strong skills in Python, data structures, algorithms, "
    "machine learning, deep learning, NLP, model deployment, "
    "REST APIs, SQL and cloud platforms such as Azure or AWS. "
    "Experience with real projects, internships, and academic "
    "capstone projects is a plus."
)


STOPWORDS = {
    "a",
    "an",
    "the",
    "and",
    "or",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "by",
    "at",
    "from",
    "as",
    "is",
    "are",
    "was",
    "were",
    "this",
    "that",
    "these",
    "those",
    "i",
    "me",
    "my",
    "we",
    "our",
    "you",
    "your",
}


def _tokenize(text: str) -> List[str]:
    words = re.findall(r"[a-zA-Z]+", text.lower())
    return [w for w in words if w not in STOPWORDS and len(w) > 2]


EMAIL_REGEX = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}")
PHONE_REGEX = re.compile(r"(\\+?\\d[\\d\\s\\-]{7,})")


def extract_basic_entities(text: str) -> Dict[str, Any]:
    """Very lightweight placeholder for NLP entity extraction.

    In a production system you would plug in spaCy, transformers, or custom NER.
    """

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    name = lines[0][:120] if lines else "Unknown Candidate"

    email_match = EMAIL_REGEX.search(text)
    email = email_match.group(0) if email_match else None

    phone_match = PHONE_REGEX.search(text)
    phone = phone_match.group(0) if phone_match else None

    lower_text = text.lower()

    # Core skill detection from a common vocabulary
    skills_found: List[str] = []
    for skill in COMMON_SKILLS:
        if skill in lower_text:
            pretty = skill.upper() if skill in {"c", "c++", "c#"} else skill.title()
            if pretty not in skills_found:
                skills_found.append(pretty)

    # Additional skills from explicit "Skills" section(s)
    for idx, ln in enumerate(lines):
        lnl = ln.lower()
        if "skills" in lnl:
            window = lines[idx : idx + 4]
            for wline in window:
                parts = re.split(r"[,/|;•\-]\s*", wline)
                for part in parts:
                    token = part.strip()
                    if not token or len(token) < 2:
                        continue
                    token_lower = token.lower()
                    if token_lower.endswith(" skills"):
                        continue
                    pretty = token.upper() if token_lower in {"c", "c++", "c#"} else token.title()
                    if pretty not in skills_found:
                        skills_found.append(pretty)

    # Experience extraction (e.g., "5 years", "3+ years", "2 yrs")
    experience_years = None
    exp_candidates: List[float] = []
    patterns = [
        r"(\d+)(?:\+)?\s+years?",
        r"(\d+)\s+yrs",
        r"experience\s*[:\-]\s*(\d+)\s*(?:years?|yrs?)",
    ]
    for pat in patterns:
        for m in re.finditer(pat, lower_text):
            try:
                exp_candidates.append(float(m.group(1)))
            except ValueError:
                continue
    if exp_candidates:
        experience_years = max(exp_candidates)

    # Education / projects flags based on headings and content
    has_education = any("education" in ln.lower() for ln in lines)
    if not has_education:
        if any(k in lower_text for k in ["bachelor", "master", "b.tech", "b.e", "bsc", "m.tech", "degree"]):
            has_education = True

    has_project_section = any("project" in ln.lower() or "projects" in ln.lower() for ln in lines)

    return {
        "name": name,
        "email": email,
        "phone": phone,
        "skills": skills_found,
        "experience_years": experience_years,
        "has_education": has_education,
        "has_projects": has_project_section,
        "raw_text": text,
    }


def compute_category_scores(candidate: Dict[str, Any], job_description: str | None) -> Dict[str, Any]:
    """Heuristic scoring broken down by category + explanation.

    Returns both numeric scores and short natural-language hints so the
    frontend can show *why* a candidate scored a certain way and how
    they could improve their resume for this role.
    """

    jd_text = (job_description or "").lower()
    candidate_text = (candidate.get("raw_text") or "").lower()

    explanations: List[str] = []
    suggestions: List[str] = []
    factor_details: Dict[str, Dict[str, Any]] = {}

    # Skills score: reward a richer skills list, weighted by JD match.
    raw_skills = [s.lower() for s in candidate.get("skills") or []]
    skills_score = 0.0
    for skill in raw_skills:
        if not skill:
            continue
        base = 6.0  # generic value for any recognised skill
        bonus = 3.0 if jd_text and skill in jd_text else 0.0
        skills_score += base + bonus
    skills_score = min(40.0, skills_score)

    if raw_skills:
        msg = f"Detected {len(raw_skills)} recognised skills; skills that match the job description weigh more."
        explanations.append(msg)
        factor_details["skills"] = {
            "label": "Skills",
            "ok": True,
            "description": msg,
            "improvement": None,
        }
    else:
        msg = "No known technical skills were confidently detected."
        imp = "Add a clear 'Skills' section with technologies listed as comma-separated items (e.g., Python, SQL, NLP, Azure)."
        explanations.append(msg)
        suggestions.append(imp)
        factor_details["skills"] = {
            "label": "Skills",
            "ok": False,
            "description": msg,
            "improvement": imp,
        }

    # Education score: section + degree keywords + quality signals.
    education_score = 0.0
    if candidate.get("has_education"):
        education_score += 8.0

    edu_text = candidate_text
    if any(k in edu_text for k in ["bachelor", "masters", "phd", "b.tech", "b.e", "bsc", "msc"]):
        education_score += 7.0
    if any(k in edu_text for k in ["cgpa", "gpa", "percentage"]):
        education_score += 3.0
    # Never leave education completely at zero; give a tiny base so
    # candidates aren't penalised as "0" when text is weak.
    if education_score == 0.0:
        education_score = 3.0
        imp = "Mention your degree, university, and graduation year under an 'Education' heading."
        suggestions.append(imp)
        msg = "No clear education section or degree keywords detected; assuming some education but details are missing."
        factor_details["education"] = {
            "label": "Education",
            "ok": False,
            "description": msg,
            "improvement": imp,
        }
    else:
        msg = "Education section and degree-related keywords found in the resume."
        explanations.append(msg)
        factor_details["education"] = {
            "label": "Education",
            "ok": True,
            "description": msg,
            "improvement": None,
        }

    education_score = min(20.0, education_score)

    # Experience (including internships) score.
    exp_years = candidate.get("experience_years") or 0.0
    experience_score = 0.0
    if exp_years >= 5:
        experience_score = 22.0
    elif exp_years >= 3:
        experience_score = 18.0
    elif exp_years >= 1:
        experience_score = 12.0
    elif exp_years > 0:
        experience_score = 6.0

    if "intern" in edu_text:
        experience_score += 5.0
    if any(k in edu_text for k in ["lead", "team lead", "manager"]):
        experience_score += 3.0
    # Provide a minimum baseline when nothing could be parsed.
    if experience_score == 0.0:
        experience_score = 3.0
        imp = "State your total years of experience or internships explicitly, e.g., '6 months internship' or '2 years experience'."
        suggestions.append(imp)
        msg = "Could not confidently infer years of experience or internships from the text."
        factor_details["experience"] = {
            "label": "Experience",
            "ok": False,
            "description": msg,
            "improvement": imp,
        }
    else:
        msg = f"Experience inferred from the text (approx. {exp_years:.1f} years, internships or lead roles mentioned)."
        explanations.append(msg)
        factor_details["experience"] = {
            "label": "Experience",
            "ok": True,
            "description": msg,
            "improvement": None,
        }

    experience_score = min(25.0, experience_score)

    # Projects score based on presence of project section / keywords and real work.
    projects_score = 0.0
    if candidate.get("has_projects"):
        projects_score += 10.0
    if any(k in edu_text for k in ["project", "capstone", "thesis", "case study"]):
        projects_score += 5.0
    if any(k in edu_text for k in ["github", "kaggle", "open source", "hackathon"]):
        projects_score += 5.0
    if projects_score == 0.0:
        projects_score = 3.0
        imp = "Add a 'Projects' section describing 2–4 key projects, with tech stack and outcomes; include GitHub or portfolio links if possible."
        suggestions.append(imp)
        msg = "No explicit projects or portfolios (GitHub, Kaggle, hackathons) found in the text."
        factor_details["projects"] = {
            "label": "Projects",
            "ok": False,
            "description": msg,
            "improvement": imp,
        }
    else:
        msg = "Projects and real-world work (GitHub, Kaggle, hackathons) are mentioned."
        explanations.append(msg)
        factor_details["projects"] = {
            "label": "Projects",
            "ok": True,
            "description": msg,
            "improvement": None,
        }

    projects_score = min(20.0, projects_score)

    # Semantic match: lightweight lexical Jaccard similarity between
    # the candidate text and the JD (or an ideal profile when JD is missing).
    cand_tokens = set(_tokenize(candidate_text))
    if jd_text.strip():
        jd_tokens = set(_tokenize(jd_text))
    else:
        jd_tokens = set(_tokenize(IDEAL_PROFILE_TEXT))

    if cand_tokens and jd_tokens:
        inter = len(cand_tokens & jd_tokens)
        union = len(cand_tokens | jd_tokens) or 1
        jaccard = inter / union
    else:
        jaccard = 0.0

    semantic_score = jaccard * 20.0  # up to 20 from general overlap

    # Extra semantic reward when ML / NLP concepts in both JD and resume.
    semantic_keywords = [
        "nlp",
        "machine",
        "learning",
        "deep",
        "neural",
        "classification",
        "regression",
        "ranking",
        "pipeline",
    ]
    for kw in semantic_keywords:
        if kw in cand_tokens and kw in jd_tokens:
            semantic_score += 1.0

    semantic_score = float(min(25.0, semantic_score))

    if semantic_score == 0.0:
        imp = "Use role-specific keywords (e.g., NLP, machine learning, Azure, REST APIs) naturally in your project and experience descriptions."
        suggestions.append(imp)
        msg = "Little direct overlap between the wording in your resume and the target role/ideal profile."
        factor_details["semantic"] = {
            "label": "Semantic match",
            "ok": False,
            "description": msg,
            "improvement": imp,
        }
    else:
        msg = "Good overlap between your wording and the target role/ideal profile."
        explanations.append(msg)
        factor_details["semantic"] = {
            "label": "Semantic match",
            "ok": True,
            "description": msg,
            "improvement": None,
        }

    total = skills_score + education_score + experience_score + projects_score + semantic_score
    total = float(max(0.0, min(100.0, total)))

    return {
        "skills_score": float(skills_score),
        "education_score": float(education_score),
        "projects_score": float(projects_score),
        "experience_score": float(experience_score),
        "semantic_score": float(semantic_score),
        "total": total,
        "explanation": " ".join(explanations) if explanations else None,
        "suggestions": " ".join(suggestions) if suggestions else None,
        "factor_details": factor_details or None,
    }
