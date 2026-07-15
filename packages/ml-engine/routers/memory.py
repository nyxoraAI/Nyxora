import sqlite3
import os
import time
import threading
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from config import get_app_dir

# Use Chroma from langchain_chroma
from langchain_chroma import Chroma
from langchain_core.documents import Document

# Determine embedding model based on config
from config import config
def get_embeddings():
    provider = config.get_llm_provider().lower()
    creds = config.get_credentials()
    
    if provider == 'openai':
        from langchain_openai import OpenAIEmbeddings
        api_key = creds.get('openai', os.environ.get('OPENAI_API_KEY', ''))
        return OpenAIEmbeddings(openai_api_key=api_key)
    elif provider == 'gemini':
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        api_key = creds.get('gemini', os.environ.get('GEMINI_API_KEY', ''))
        return GoogleGenerativeAIEmbeddings(google_api_key=api_key, model="models/embedding-001")
    else:
        # Local fallback using sentence-transformers
        from langchain_huggingface import HuggingFaceEmbeddings
        return HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

router = APIRouter()

class RagRequest(BaseModel):
    query: str
    top_k: int = 3

class RagResponse(BaseModel):
    memories: List[str]

_vector_store = None
_last_sync = 0.0
_sync_lock = threading.Lock()
_SYNC_INTERVAL_SECONDS = 300  # Re-sync at most every 5 minutes


def sync_episodic_db_to_chroma(force: bool = False):
    """Syncs episodic.db into ChromaDB for semantic search.
    
    Only performs an actual sync if the data is stale (> _SYNC_INTERVAL_SECONDS old)
    or force=True. Uses a threading lock to prevent concurrent resets.
    """
    global _vector_store, _last_sync

    now = time.monotonic()
    if not force and (now - _last_sync) < _SYNC_INTERVAL_SECONDS and _vector_store is not None:
        # Data is fresh enough — skip sync
        return

    if not _sync_lock.acquire(blocking=False):
        # Another thread is already syncing — skip to avoid race condition
        return

    try:
        db_path = get_app_dir() / 'data' / 'episodic.db'
        if not db_path.exists():
            return

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT id, fact, category, confidence FROM episodic_memories WHERE confidence >= 0.3 OR rule_type = 'permanent'")
        rows = cursor.fetchall()
        conn.close()

        if not rows:
            _last_sync = now
            return

        docs = [
            Document(
                page_content=row['fact'],
                metadata={"id": row['id'], "category": row['category'], "confidence": row['confidence']}
            )
            for row in rows
        ]

        chroma_dir = str(get_app_dir() / 'data' / 'chroma_db')

        if _vector_store is None:
            _vector_store = Chroma(
                collection_name="episodic_memories",
                embedding_function=get_embeddings(),
                persist_directory=chroma_dir
            )

        # Bug #6 fix: only reset when actually syncing, not on every request
        try:
            _vector_store.reset_collection()
        except Exception:
            pass

        _vector_store.add_documents(docs)
        _last_sync = now

    finally:
        _sync_lock.release()

@router.post("/rag", response_model=RagResponse)
async def query_memory(request: RagRequest):
    global _vector_store
    
    # Sync before query to ensure fresh data
    sync_episodic_db_to_chroma()
    
    if not _vector_store:
        return RagResponse(memories=[])
        
    results = _vector_store.similarity_search_with_score(request.query, k=request.top_k)
    
    # Return facts that have a reasonable similarity (distance score depends on embedding, but we just return top_k)
    memories = [doc.page_content for doc, score in results]
    
    return RagResponse(memories=memories)
