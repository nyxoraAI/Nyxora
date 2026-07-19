from fastapi import APIRouter
from pydantic import BaseModel
import os
from pathlib import Path
from typing import Optional

from config import get_app_dir

router = APIRouter()

def get_memory_dir() -> Path:
    mem_dir = get_app_dir() / 'data'
    mem_dir.mkdir(parents=True, exist_ok=True)
    return mem_dir

class MemoryManageRequest(BaseModel):
    action: str  # "add", "replace", "remove"
    target: str  # "memory" or "user"
    content: Optional[str] = None
    old_text: Optional[str] = None

class NarrativeResponse(BaseModel):
    memory_md: str
    user_md: str

@router.get("/narrative", response_model=NarrativeResponse)
async def get_narrative():
    mem_path = get_memory_dir() / 'narrative_memory.md'
    user_path = get_memory_dir() / 'narrative_user.md'
    
    memory_md = mem_path.read_text(encoding='utf-8') if mem_path.exists() else ""
    user_md = user_path.read_text(encoding='utf-8') if user_path.exists() else ""
    
    return NarrativeResponse(memory_md=memory_md, user_md=user_md)

@router.post("/manage")
async def manage_memory(req: MemoryManageRequest):
    if req.target not in ["memory", "user"]:
        return {"success": False, "message": "Invalid target. Must be 'memory' or 'user'."}
        
    file_name = f"narrative_{req.target.lower()}.md"
    file_path = get_memory_dir() / file_name
    
    current_content = file_path.read_text(encoding='utf-8') if file_path.exists() else ""
    
    if req.action == "add":
        if not req.content:
            return {"success": False, "message": "Content required for 'add'."}
        new_content = current_content + f"\n\n§\n{req.content.strip()}" if current_content else req.content.strip()
        file_path.write_text(new_content.strip(), encoding='utf-8')
        return {"success": True, "message": f"Entry added to {file_name}."}
        
    elif req.action == "replace":
        if not req.old_text or not req.content:
            return {"success": False, "message": "old_text and content required for 'replace'."}
        if req.old_text not in current_content:
            return {"success": False, "message": f"old_text not found in {file_name}."}
        new_content = current_content.replace(req.old_text, req.content)
        file_path.write_text(new_content, encoding='utf-8')
        return {"success": True, "message": f"Entry replaced in {file_name}."}
        
    elif req.action == "remove":
        if not req.old_text:
            return {"success": False, "message": "old_text required for 'remove'."}
        if req.old_text not in current_content:
            return {"success": False, "message": f"old_text not found in {file_name}."}
        new_content = current_content.replace(f"§\n{req.old_text}", "")
        new_content = new_content.replace(req.old_text, "").strip()
        file_path.write_text(new_content, encoding='utf-8')
        return {"success": True, "message": f"Entry removed from {file_name}."}
        
    return {"success": False, "message": f"Unknown action: {req.action}"}
