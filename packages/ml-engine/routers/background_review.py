from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from langchain_core.prompts import ChatPromptTemplate
import httpx
import json
import logging

from routers.llm import get_llm

router = APIRouter()
logger = logging.getLogger("nyxora.review")

class ChatMessage(BaseModel):
    role: str
    content: str

class ReviewRequest(BaseModel):
    messages: List[ChatMessage]
    session_id: str
    trigger: str = "turn_end"

class ReviewResponse(BaseModel):
    success: bool
    actions: List[str]

# Tool Definitions for the LLM
class MemoryManageTool(BaseModel):
    """Manage durable facts about the user, their environment, or workflows."""
    action: str = Field(description="'add', 'replace', or 'remove'")
    target: str = Field(description="'memory' for facts/environment, 'user' for user persona/preferences")
    content: str = Field(description="The factual sentence to add or new content to replace with", default="")
    old_text: str = Field(description="The exact old text to replace or remove", default="")

class SkillManageTool(BaseModel):
    """Manage skills (reusable workflows and procedures) in the SKILL.md library."""
    action: str = Field(description="'create', 'patch', 'write_file', or 'delete'")
    name: str = Field(description="Name of the skill (lowercase-hyphenated)")
    description: str = Field(description="Description of the skill (for create)", default="")
    old_string: str = Field(description="Exact old string to replace in SKILL.md (for patch)", default="")
    new_string: str = Field(description="New string to replace old_string with (for patch)", default="")
    file_path: str = Field(description="Support file path like 'references/topic.md' (for write_file)", default="")
    content: str = Field(description="Full markdown content for write_file", default="")

_COMBINED_REVIEW_PROMPT = """Review the conversation above and update two things:

**Memory**: who the user is. Did the user reveal persona, desires, preferences, personal details, or expectations about how you should behave? Save facts about the user and durable preferences with the MemoryManageTool.

**Skills**: how to do this class of task. Be ACTIVE — most sessions produce at least one skill update. A pass that does nothing is a missed learning opportunity, not a neutral outcome.

Target shape of the skill library: CLASS-LEVEL skills with a rich SKILL.md and a `references/` directory for session-specific detail.

Signals that warrant a skill update (any one is enough):
- User corrected your style, tone, format, legibility, verbosity, or approach. Frustration is a FIRST-CLASS skill signal, not just a memory signal. 'stop doing X', 'don't format like this' — embed the lesson in the skill that governs that task so the next session starts fixed.
- Non-trivial technique, fix, workaround, or debugging path emerged.
- A skill that was loaded or consulted turned out wrong, missing, or outdated — patch it now.

Preference order for skills — pick the earliest that fits:
1. UPDATE A CURRENTLY-LOADED SKILL.
2. UPDATE AN EXISTING UMBRELLA.
3. ADD A SUPPORT FILE under an existing umbrella via SkillManageTool action=write_file (e.g. references/topic.md).
4. CREATE A NEW CLASS-LEVEL UMBRELLA when nothing exists.

User-preference embedding: when the user complains about how you handled a task, update the skill that governs that task — memory alone isn't enough. Memory says 'who the user is'; skills say 'how to do this task for this user'. Both should carry lessons.

Do NOT capture as skills:
- Environment-dependent failures: missing binaries, 'command not found'.
- Negative claims about tools or features.
- Session-specific transient errors that resolved before the conversation ended.
- One-off task narratives.

If a tool failed because of setup state, capture the FIX under an existing setup skill — never 'this tool does not work' as a standalone constraint.

Act on whichever of the two dimensions has real signal. If genuinely nothing stands out on either, just return no tool calls. Do NOT call tools if nothing needs saving.
"""

@router.post("/review", response_model=ReviewResponse)
async def background_review(req: ReviewRequest):
    if len(req.messages) < 3:
        return ReviewResponse(success=True, actions=[])

    llm = get_llm()
    # Bind tools to the LLM
    llm_with_tools = llm.bind_tools([MemoryManageTool, SkillManageTool])
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", _COMBINED_REVIEW_PROMPT),
        ("user", "Conversation History:\n{history}")
    ])
    
    # Format history (keep last 100 to bound context window)
    history_str = "\n".join([f"{'USER' if m.role == 'user' else 'NYXORA'}: {m.content}" for m in req.messages[-100:]])
    
    try:
        chain = prompt | llm_with_tools
        result = chain.invoke({"history": history_str})
        
        actions_taken = []
        
        # Process tool calls
        if hasattr(result, 'tool_calls') and result.tool_calls:
            async with httpx.AsyncClient() as client:
                for tool_call in result.tool_calls:
                    name = tool_call.get('name')
                    args = tool_call.get('args', {})
                    
                    if name == "MemoryManageTool":
                        res = await client.post('http://127.0.0.1:8000/memory/manage', json=args)
                        if res.status_code == 200 and res.json().get('success'):
                            actions_taken.append(f"Memory updated: {args.get('action')} {args.get('target')}")
                            
                    elif name == "SkillManageTool":
                        res = await client.post('http://127.0.0.1:8000/skills/manage', json=args)
                        if res.status_code == 200 and res.json().get('success'):
                            actions_taken.append(f"Skill '{args.get('name')}' updated: {args.get('action')}")
                            
        return ReviewResponse(success=True, actions=actions_taken)
        
    except Exception as e:
        logger.error(f"[Review] Error running background review: {e}")
        return ReviewResponse(success=False, actions=[])
