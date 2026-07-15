from fastapi import APIRouter
from pydantic import BaseModel
import os
import shutil
from pathlib import Path
from typing import Optional, List, Dict, Any
import yaml

from config import get_app_dir

router = APIRouter()

def get_skills_dir() -> Path:
    skills_dir = get_app_dir() / 'playbooks'
    skills_dir.mkdir(parents=True, exist_ok=True)
    return skills_dir

class SkillManageRequest(BaseModel):
    action: str  # "create", "patch", "delete", "write_file"
    name: str
    description: Optional[str] = None
    old_string: Optional[str] = None
    new_string: Optional[str] = None
    file_path: Optional[str] = None # For write_file (e.g. references/topic.md)
    content: Optional[str] = None   # Content for write_file or full SKILL.md for create

class SkillListResponse(BaseModel):
    skills: List[Dict[str, Any]]
    
def _parse_frontmatter(content: str) -> Dict[str, Any]:
    if not content.startswith("---"):
        return {}
    parts = content.split("---")
    if len(parts) >= 3:
        try:
            return yaml.safe_load(parts[1]) or {}
        except Exception:
            return {}
    return {}

@router.get("/list", response_model=SkillListResponse)
async def list_skills():
    skills = []
    skills_dir = get_skills_dir()
    for item in skills_dir.iterdir():
        if item.is_dir() and not item.name.startswith("."):
            skill_md = item / "SKILL.md"
            if skill_md.exists():
                content = skill_md.read_text(encoding='utf-8')
                meta = _parse_frontmatter(content)
                skills.append({
                    "name": item.name,
                    "description": meta.get("description", ""),
                    "version": meta.get("version", "1.0.0"),
                    "author": meta.get("author", "nyxora"),
                    "pinned": meta.get("pinned", False)
                })
    return SkillListResponse(skills=skills)

@router.post("/manage")
async def manage_skill(req: SkillManageRequest):
    skill_dir = get_skills_dir() / req.name
    skill_md = skill_dir / "SKILL.md"
    
    if req.action == "create":
        if skill_dir.exists():
            return {"success": False, "message": f"Skill '{req.name}' already exists."}
        skill_dir.mkdir(parents=True)
        
        # Default content if none provided
        content = req.content
        if not content:
            content = f"---\nname: {req.name}\ndescription: \"{req.description or ''}\"\nversion: 1.0.0\nauthor: nyxora-self\n---\n\n# {req.name}\n\n"
            
        skill_md.write_text(content, encoding='utf-8')
        return {"success": True, "message": f"Skill '{req.name}' created successfully."}
        
    elif req.action == "patch":
        if not skill_md.exists():
            return {"success": False, "message": f"Skill '{req.name}' not found."}
        if not req.old_string or req.new_string is None:
            return {"success": False, "message": "old_string and new_string required for patch."}
            
        content = skill_md.read_text(encoding='utf-8')
        if req.old_string not in content:
            return {"success": False, "message": f"old_string not found in SKILL.md of '{req.name}'."}
            
        new_content = content.replace(req.old_string, req.new_string)
        skill_md.write_text(new_content, encoding='utf-8')
        return {"success": True, "message": f"Skill '{req.name}' patched successfully."}
        
    elif req.action == "write_file":
        if not skill_dir.exists():
            return {"success": False, "message": f"Skill '{req.name}' not found."}
        if not req.file_path or not req.content:
            return {"success": False, "message": "file_path and content required for write_file."}
            
        # Secure the path
        safe_path = os.path.normpath(f"/{req.file_path}").lstrip('/')
        if ".." in safe_path:
            return {"success": False, "message": "Invalid file_path."}
            
        target_file = skill_dir / safe_path
        target_file.parent.mkdir(parents=True, exist_ok=True)
        target_file.write_text(req.content, encoding='utf-8')
        return {"success": True, "message": f"File '{safe_path}' written to skill '{req.name}'."}
        
    elif req.action == "delete":
        if not skill_dir.exists():
            return {"success": False, "message": f"Skill '{req.name}' not found."}
            
        # Move to .archive instead of hard delete
        archive_dir = get_skills_dir() / ".archive"
        archive_dir.mkdir(exist_ok=True)
        
        target_archive = archive_dir / req.name
        if target_archive.exists():
            shutil.rmtree(target_archive)
            
        shutil.move(str(skill_dir), str(target_archive))
        return {"success": True, "message": f"Skill '{req.name}' archived."}
        
    return {"success": False, "message": f"Unknown action: {req.action}"}
