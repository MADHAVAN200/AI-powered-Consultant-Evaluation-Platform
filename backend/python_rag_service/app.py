import json
import os
import re
from datetime import datetime, timezone
from hashlib import sha1
from pathlib import Path
from typing import Any, Dict, List, Optional

import chromadb
from fastapi import FastAPI
from pydantic import BaseModel, Field

from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter


APP_TITLE = "Case RAG Service"

def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


# Ensure Python service reads backend/.env when started via uvicorn.
BACKEND_DIR = Path(__file__).resolve().parents[1]
_load_env_file(BACKEND_DIR / ".env")

RAG_EMBEDDING_MODEL = os.getenv("RAG_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
GROQ_MODEL = os.getenv("RAG_GROQ_MODEL", "llama-3.3-70b-versatile")
CHROMA_COLLECTION = os.getenv("RAG_CHROMA_COLLECTION", "case_chunks")
CHROMA_PERSIST_DIR = os.getenv("RAG_CHROMA_PERSIST_DIR", str((Path(__file__).resolve().parent / ".chroma").resolve()))
RAG_LOG_PATH = os.getenv("RAG_LOG_PATH", str((Path(__file__).resolve().parent / "logs" / "retrieval_logs.jsonl").resolve()))
RAG_DEBUG_LOGS = str(os.getenv("RAG_DEBUG_LOGS", "")).strip().lower() in {"1", "true", "yes", "on"}

embeddings = HuggingFaceEmbeddings(model_name=RAG_EMBEDDING_MODEL)
splitter = RecursiveCharacterTextSplitter(chunk_size=900, chunk_overlap=140)
Path(CHROMA_PERSIST_DIR).mkdir(parents=True, exist_ok=True)
_chroma_client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)


def _get_collection():
    return _chroma_client.get_or_create_collection(name=CHROMA_COLLECTION)


def _case_filter(case_id: str, case_version: str) -> Dict[str, Any]:
    return {
        "$and": [
            {"case_id": case_id},
            {"case_version": case_version},
        ]
    }


def _debug(msg: str) -> None:
    if RAG_DEBUG_LOGS:
        print(f"[RAG DEBUG] {msg}")


def _read_retrieval_log_entries(limit: int = 20) -> List[Dict[str, Any]]:
    log_path = Path(RAG_LOG_PATH)
    if not log_path.exists():
        return []

    safe_limit = max(1, min(200, int(limit)))
    rows: List[Dict[str, Any]] = []

    try:
        lines = log_path.read_text(encoding="utf-8").splitlines()
    except Exception:
        return []

    for raw in reversed(lines):
        if not raw.strip():
            continue
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                rows.append(parsed)
        except Exception:
            continue
        if len(rows) >= safe_limit:
            break

    return rows

_groq_keys = [k for k in [os.getenv("GROQ_API_KEY_1", ""), os.getenv("GROQ_API_KEY_2", ""), os.getenv("GROQ_API_KEY", "")] if k]
if not _groq_keys:
    raise RuntimeError("At least one GROQ API key is required")


def _get_llm(index: int = 0) -> ChatGroq:
    return ChatGroq(api_key=_groq_keys[index % len(_groq_keys)], model_name=GROQ_MODEL, temperature=0.1)


class Message(BaseModel):
    role: str
    content: str


class EvaluateRequest(BaseModel):
    caseStudy: Dict[str, Any]
    history: List[Message] = Field(default_factory=list)
    userMessage: str
    currentStep: str = "diagnostic"
    sessionId: Optional[str] = None


class IndexRequest(BaseModel):
    caseStudy: Dict[str, Any]


def _normalize_text(text: Any) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _tokenize(text: str) -> List[str]:
    clean = re.sub(r"[^a-z0-9\s.%]", " ", _normalize_text(text).lower())
    return [t for t in clean.split() if len(t) > 2]


def _case_version(case_study: Dict[str, Any]) -> str:
    base = str(case_study.get("updated_at") or case_study.get("created_at") or datetime.now(timezone.utc).isoformat())
    return sha1(base.encode("utf-8")).hexdigest()[:12]


def _build_documents(case_study: Dict[str, Any]) -> List[Dict[str, Any]]:
    case_id = str(case_study.get("id") or "unknown-case")
    version = _case_version(case_study)

    sources: List[Dict[str, Any]] = []

    def add_source(section: str, text: Any, page: Optional[int] = None) -> None:
        normalized = _normalize_text(text)
        if normalized:
            sources.append({"section": section, "text": normalized, "page": page})

    add_source("context", case_study.get("context", ""))
    add_source("initial_prompt", case_study.get("initial_prompt", ""))
    add_source("raw_content", case_study.get("raw_content", ""))

    financial_data = case_study.get("financial_data") or {}
    if isinstance(financial_data, dict) and financial_data:
        lines = []
        for key, value in financial_data.items():
            if isinstance(value, list):
                lines.append(f"{key}: {', '.join(str(v) for v in value)}")
            else:
                lines.append(f"{key}: {value}")
        add_source("financial_data", "\n".join(lines))

    parsed_sections = case_study.get("parsed_sections") or {}
    if isinstance(parsed_sections, dict):
        for section, body in parsed_sections.items():
            if section == "_numericSeries":
                continue
            add_source(f"section:{section}", body)

    docs: List[Dict[str, Any]] = []
    chunk_counter = 0
    for source in sources:
        chunks = splitter.split_text(source["text"])
        for chunk in chunks:
            chunk_counter += 1
            chunk_id = f"cit-{case_id[:8]}-{version[:6]}-{chunk_counter:03d}"
            docs.append(
                {
                    "case_id": case_id,
                    "case_version": version,
                    "chunk_id": chunk_id,
                    "section": source["section"],
                    "page": int(source.get("page")) if source.get("page") is not None else -1,
                    "content": chunk,
                    "token_count": len(_tokenize(chunk)),
                }
            )

    return docs


def _index_case(case_study: Dict[str, Any]) -> Dict[str, Any]:
    docs = _build_documents(case_study)
    if not docs:
        return {"indexed": 0, "case_id": str(case_study.get("id") or "unknown-case")}

    texts = [d["content"] for d in docs]
    vectors = embeddings.embed_documents(texts)

    case_id = docs[0]["case_id"]
    case_version = docs[0]["case_version"]
    collection = _get_collection()

    collection.delete(where=_case_filter(case_id, case_version))
    collection.add(
        ids=[d["chunk_id"] for d in docs],
        documents=texts,
        metadatas=[
            {
                "case_id": d["case_id"],
                "case_version": d["case_version"],
                "chunk_id": d["chunk_id"],
                "section": d["section"],
                "page": d["page"],
                "token_count": d["token_count"],
            }
            for d in docs
        ],
        embeddings=vectors,
    )

    _debug(f"Indexed case_id={case_id} version={case_version} chunks={len(docs)}")

    return {"indexed": len(docs), "case_id": case_id, "case_version": case_version}


def _ensure_case_index(case_study: Dict[str, Any]) -> Dict[str, Any]:
    case_id = str(case_study.get("id") or "unknown-case")
    case_version = _case_version(case_study)
    collection = _get_collection()

    check = collection.get(where=_case_filter(case_id, case_version), limit=1)

    if (check.get("ids") or []):
        return {"indexed": 0, "case_id": case_id, "case_version": case_version, "alreadyIndexed": True}

    return _index_case(case_study)


def _lexical_retrieve(case_study: Dict[str, Any], query: str, top_k: int = 8) -> List[Dict[str, Any]]:
    docs = _build_documents(case_study)
    q_tokens = set(_tokenize(query))
    ranked = []
    for d in docs:
        d_tokens = set(_tokenize(d["content"]))
        score = len(q_tokens.intersection(d_tokens))
        if score > 0:
            ranked.append((score, d))
    ranked.sort(key=lambda x: x[0], reverse=True)
    return [r[1] for r in ranked[:top_k]] or docs[:top_k]


def _retrieve_chunks(case_study: Dict[str, Any], query: str, top_k: int = 8) -> List[Dict[str, Any]]:
    case_id = str(case_study.get("id") or "unknown-case")
    case_version = _case_version(case_study)
    q_vector = embeddings.embed_query(query)
    collection = _get_collection()

    try:
        result = collection.query(
            query_embeddings=[q_vector],
            n_results=top_k,
            where=_case_filter(case_id, case_version),
            include=["documents", "metadatas", "distances"],
        )

        docs = (result.get("documents") or [[]])[0]
        metas = (result.get("metadatas") or [[]])[0]
        distances = (result.get("distances") or [[]])[0]

        if docs and metas:
            rows = []
            for doc, meta, dist in zip(docs, metas, distances or [0.0] * len(docs)):
                rows.append(
                    {
                        "chunk_id": meta.get("chunk_id"),
                        "section": meta.get("section"),
                        "page": meta.get("page"),
                        "content": doc,
                        "similarity": float(1.0 / (1.0 + float(dist or 0.0))),
                    }
                )
            return [
                {
                    "chunk_id": row.get("chunk_id"),
                    "section": row.get("section"),
                    "page": row.get("page"),
                    "content": row.get("content"),
                    "similarity": float(row.get("similarity") or 0),
                }
                for row in rows
            ]
    except Exception:
        pass

    return _lexical_retrieve(case_study, query, top_k)


def _parse_json(content: str) -> Dict[str, Any]:
    text = content.strip()
    try:
        return json.loads(text)
    except Exception:
        pass

    match = re.search(r"\{.*\}", text, flags=re.S)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            return {}
    return {}


def _overlap_score(response_text: str, evidence_text: str) -> float:
    a = set(_tokenize(response_text))
    b = set(_tokenize(evidence_text))
    if not a or not b:
        return 0.0
    return len(a.intersection(b)) / max(1, len(a))


def _unsupported_claim_rate(response_text: str, evidence_text: str) -> float:
    evidence_tokens = set(_tokenize(evidence_text))
    sentences = [s.strip() for s in re.split(r"[.!?]+", response_text) if len(s.strip()) > 12]
    if not sentences:
        return 0.0

    unsupported = 0
    for sentence in sentences:
        tokens = set(_tokenize(sentence))
        if not tokens:
            continue
        overlap = len(tokens.intersection(evidence_tokens)) / max(1, len(tokens))
        if overlap < 0.12:
            unsupported += 1
    return unsupported / max(1, len(sentences))


def _default_evaluation(current_step: str) -> Dict[str, Any]:
    return {
        "response": "Please reference the case data directly and walk me through your reasoning step by step.",
        "analysis": "Fallback response due to model parse or grounding failure.",
        "logicalDepth": 2,
        "rubricScores": {
            "problemUnderstanding": 8,
            "dataUsage": 8,
            "rootCauseIdentification": 8,
            "solutionQuality": 8,
            "crossQuestionConsistency": 8,
        },
        "weakResponse": False,
        "isDisqualified": False,
        "nextStep": current_step,
        "citations": [],
    }


def _call_llm(prompt: str, retry_count: int = 2) -> Dict[str, Any]:
    last = {}
    for i in range(retry_count):
        llm = _get_llm(i)
        out = llm.invoke(prompt)
        parsed = _parse_json(str(out.content))
        if parsed:
            return parsed
        last = parsed
    return last


def _log_retrieval_metrics(
    case_id: str,
    case_version: str,
    session_id: Optional[str],
    user_message: str,
    retrieval_count: int,
    hit_rate: float,
    unsupported_claim_rate: float,
    evidence_overlap_score: float,
    retrieved_chunk_ids: List[str],
    cited_chunk_ids: List[str],
) -> None:
    try:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "case_id": case_id,
            "case_version": case_version,
            "session_id": session_id,
            "user_message": user_message,
            "retrieval_count": retrieval_count,
            "hit_rate": hit_rate,
            "unsupported_claim_rate": unsupported_claim_rate,
            "evidence_overlap_score": evidence_overlap_score,
            "retrieved_chunk_ids": retrieved_chunk_ids,
            "cited_chunk_ids": cited_chunk_ids,
        }
        log_path = Path(RAG_LOG_PATH)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=True) + "\n")
    except Exception:
        # Keep logging best-effort only.
        pass


app = FastAPI(title=APP_TITLE)


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "vector_store": "chroma",
        "collection": CHROMA_COLLECTION,
        "persist_dir": CHROMA_PERSIST_DIR,
        "debug": RAG_DEBUG_LOGS,
    }


@app.get("/rag/debug/case/{case_id}")
def debug_case_chunks(case_id: str, limit: int = 20) -> Dict[str, Any]:
    collection = _get_collection()
    safe_limit = max(1, min(100, int(limit)))
    rows = collection.get(where={"case_id": str(case_id)}, include=["metadatas", "documents"], limit=safe_limit)

    ids = rows.get("ids") or []
    metas = rows.get("metadatas") or []
    docs = rows.get("documents") or []

    samples = []
    for idx, cid in enumerate(ids):
        meta = metas[idx] if idx < len(metas) else {}
        doc = docs[idx] if idx < len(docs) else ""
        samples.append(
            {
                "chunk_id": cid,
                "section": meta.get("section"),
                "case_version": meta.get("case_version"),
                "token_count": meta.get("token_count"),
                "preview": str(doc)[:180],
            }
        )

    return {
        "success": True,
        "case_id": str(case_id),
        "count": len(ids),
        "samples": samples,
    }


@app.get("/rag/debug/latest-log")
def debug_latest_log(limit: int = 20) -> Dict[str, Any]:
    entries = _read_retrieval_log_entries(limit=limit)
    return {
        "success": True,
        "count": len(entries),
        "entries": entries,
    }


@app.get("/rag/debug/session/{session_id}")
def debug_session_log(session_id: str, limit: int = 20) -> Dict[str, Any]:
    session_key = str(session_id)
    entries = [
        e
        for e in _read_retrieval_log_entries(limit=500)
        if str(e.get("session_id") or "") == session_key
    ][: max(1, min(200, int(limit)))]

    return {
        "success": True,
        "session_id": session_key,
        "count": len(entries),
        "entries": entries,
    }


@app.post("/rag/index-case")
def index_case(req: IndexRequest) -> Dict[str, Any]:
    result = _index_case(req.caseStudy)
    return {"success": True, "result": result}


@app.post("/rag/evaluate")
def rag_evaluate(req: EvaluateRequest) -> Dict[str, Any]:
    case_study = req.caseStudy or {}
    case_id = str(case_study.get("id") or "unknown-case")
    case_version = _case_version(case_study)

    _ensure_case_index(case_study)

    history_text = "\n".join([f"{m.role}: {m.content}" for m in req.history[-8:]])
    chunks = _retrieve_chunks(case_study, f"{req.userMessage}\n{history_text}", top_k=8)
    _debug(f"Evaluate session={req.sessionId} case_id={case_id} retrieved_chunks={len(chunks)}")
    evidence_pack = "\n\n".join(
        [f"[{c.get('chunk_id')}] ({c.get('section')}) {c.get('content')}" for c in chunks]
    )

    prompt = f"""
You are a strategy-case interviewer. Use ONLY the evidence pack below.
If evidence is insufficient, ask clarifying question and do not invent facts.

CURRENT_PHASE: {req.currentStep}

EVIDENCE_PACK:
{evidence_pack}

RECENT_HISTORY:
{history_text}

CANDIDATE_MESSAGE:
{req.userMessage}

Return valid JSON only:
{{
  "response": "one concise follow-up question",
  "analysis": "short internal assessment",
  "logicalDepth": 1,
  "rubricScores": {{
    "problemUnderstanding": 0,
    "dataUsage": 0,
    "rootCauseIdentification": 0,
    "solutionQuality": 0,
    "crossQuestionConsistency": 0
  }},
  "weakResponse": false,
  "isDisqualified": false,
  "nextStep": "diagnostic|brainstorming|calculations|final_recommendation|complete",
  "citations": ["cit-..."]
}}
"""

    parsed = _call_llm(prompt, retry_count=min(2, len(_groq_keys)))
    if not parsed:
        parsed = _default_evaluation(req.currentStep)

    cited = parsed.get("citations") if isinstance(parsed.get("citations"), list) else []
    retrieved_ids = [c.get("chunk_id") for c in chunks if c.get("chunk_id")]
    valid_citations = [c for c in cited if c in retrieved_ids]
    if not valid_citations and retrieved_ids:
        valid_citations = retrieved_ids[:2]

    evidence_text = " ".join([c.get("content", "") for c in chunks if c.get("chunk_id") in valid_citations]) or " ".join(
        [c.get("content", "") for c in chunks]
    )

    response_text = str(parsed.get("response") or "")
    overlap = _overlap_score(response_text, evidence_text)
    unsupported = _unsupported_claim_rate(response_text, evidence_text)
    citations_valid = all(c in retrieved_ids for c in valid_citations)

    grounding_passed = citations_valid and overlap >= 0.08 and unsupported <= 0.5
    regenerated = False

    if not grounding_passed:
        regenerated = True
        strict_prompt = prompt + "\n\nYour previous answer was not sufficiently grounded. Re-answer with explicit support from evidence and valid citations only."
        parsed_2 = _call_llm(strict_prompt, retry_count=min(2, len(_groq_keys)))
        if parsed_2:
            parsed = parsed_2
            response_text = str(parsed.get("response") or "")
            cited = parsed.get("citations") if isinstance(parsed.get("citations"), list) else []
            valid_citations = [c for c in cited if c in retrieved_ids] or valid_citations
            evidence_text = " ".join([c.get("content", "") for c in chunks if c.get("chunk_id") in valid_citations]) or evidence_text
            overlap = _overlap_score(response_text, evidence_text)
            unsupported = _unsupported_claim_rate(response_text, evidence_text)
            grounding_passed = overlap >= 0.08 and unsupported <= 0.5

    if not grounding_passed:
        parsed = _default_evaluation(req.currentStep)
        parsed["response"] = "I need one specific metric from the case to validate your assumption before we proceed."
        parsed["analysis"] = "Grounding guard fallback: unsupported claims detected."

    retrieval_count = len(chunks)
    query_tokens = set(_tokenize(req.userMessage))
    evidence_tokens = set(_tokenize(" ".join([c.get("content", "") for c in chunks])))
    hit_rate = (len(query_tokens.intersection(evidence_tokens)) / max(1, len(query_tokens))) if query_tokens else 0.0

    _log_retrieval_metrics(
        case_id=case_id,
        case_version=case_version,
        session_id=req.sessionId,
        user_message=req.userMessage,
        retrieval_count=retrieval_count,
        hit_rate=hit_rate,
        unsupported_claim_rate=unsupported,
        evidence_overlap_score=overlap,
        retrieved_chunk_ids=retrieved_ids,
        cited_chunk_ids=valid_citations,
    )

    evaluation = {
        "response": str(parsed.get("response") or "Please continue with a structured answer."),
        "analysis": str(parsed.get("analysis") or "RAG evaluation completed."),
        "logicalDepth": max(1, min(5, int(parsed.get("logicalDepth") or 2))),
        "rubricScores": parsed.get("rubricScores")
        or {
            "problemUnderstanding": 8,
            "dataUsage": 8,
            "rootCauseIdentification": 8,
            "solutionQuality": 8,
            "crossQuestionConsistency": 8,
        },
        "weakResponse": bool(parsed.get("weakResponse")),
        "isDisqualified": bool(parsed.get("isDisqualified")),
        "nextStep": str(parsed.get("nextStep") or req.currentStep),
        "citations": valid_citations,
        "retrievalMetrics": {
            "hitRate": hit_rate,
            "unsupportedClaimRate": unsupported,
            "evidenceOverlapScore": overlap,
            "retrievalCount": retrieval_count,
            "regenerated": regenerated,
            "groundingPassed": grounding_passed,
            "retrievedChunkIds": retrieved_ids,
            "citedChunkIds": valid_citations,
        },
    }

    return {"success": True, "evaluation": evaluation}
