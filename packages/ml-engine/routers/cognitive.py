from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from routers.llm import get_llm
from langchain_core.prompts import ChatPromptTemplate
import json
import re

router = APIRouter()

class ChatMessage(BaseModel):
    role: str
    content: str

class CognitiveRequest(BaseModel):
    messages: List[ChatMessage]

class PersonaResponse(BaseModel):
    language: Optional[str] = Field(description="User's language style, e.g., 'Informal English with technical jargon'")
    tone: Optional[str] = Field(description="Communication tone, e.g., 'Casual and playful'")
    trading_style: Optional[str] = Field(description="Trading behavior, e.g., 'Aggressive, high-frequency'")
    behavior: Optional[str] = Field(description="General behavior, e.g., 'Task-oriented, concise'")

@router.post("/reason", response_model=PersonaResponse)
async def dialectic_reasoning(request: CognitiveRequest):
    if not request.messages or len(request.messages) < 5:
        # Not enough messages to form a strong persona
        return PersonaResponse(language=None, tone=None, trading_style=None, behavior=None)

    llm = get_llm()
    
    # We use structured output if supported, else fallback to raw JSON
    try:
        structured_llm = llm.with_structured_output(PersonaResponse)
    except Exception:
        structured_llm = None
        
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are Nyx, Nyxora's background Persona Auditor.
Analyze the following recent conversation between the USER and Nyxora.
Identify persistent user traits and preferences across EXACTLY these 4 categories.

RULES:
- If a category is unclear or not enough data, use null for that key.
- Be SPECIFIC and DESCRIPTIVE. Include examples of slang/words if identifiable.
- Focus especially on language & tone — capture the EXACT language the user speaks and their style.
- Include informal markers if present (e.g., slang, abbreviations, emojis, code-switching).

OUTPUT FORMAT: You MUST return ONLY valid JSON matching this schema:
{{"language": "...", "tone": "...", "trading_style": "...", "behavior": "..."}}
CRITICAL: Do NOT wrap the JSON in ```json ... ``` markdown blocks. Return the raw '{{' character immediately.
"""),
        ("user", "Conversation History:\n{history}")
    ])
    
    # Format the history
    history_str = "\n".join([f"{'USER' if m.role == 'user' else 'NYXORA'}: {m.content}" for m in request.messages])
    
    try:
        if structured_llm:
            try:
                chain = prompt | structured_llm
                result = chain.invoke({"history": history_str})
                return result
            except Exception as inner_e:
                print(f"[Cognitive] Structured LLM Failed, trying raw: {str(inner_e)}")
                # If structured fails, fallback to raw parsing
                chain = prompt | llm
                raw_result = chain.invoke({"history": history_str})
                content = raw_result.content
                # Clean markdown with robust regex
                content = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.IGNORECASE)
                content = re.sub(r"\s*```$", "", content).strip()
                try:
                    data = json.loads(content)
                    return PersonaResponse(**data)
                except json.JSONDecodeError:
                    return PersonaResponse(language=None, tone=None, trading_style=None, behavior=None)
        else:
            # Fallback for models that don't support with_structured_output well
            chain = prompt | llm
            raw_result = chain.invoke({"history": history_str})
            content = raw_result.content
            
            # Clean markdown with robust regex
            content = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.IGNORECASE)
            content = re.sub(r"\s*```$", "", content).strip()
            
            try:
                data = json.loads(content)
                return PersonaResponse(**data)
            except json.JSONDecodeError:
                return PersonaResponse(language=None, tone=None, trading_style=None, behavior=None)
                
    except Exception as e:
        print(f"[Cognitive] LLM Error: {str(e)}")
        # JANGAN raise 500, return kosong saja agar percakapan tetap berjalan
        return PersonaResponse(language=None, tone=None, trading_style=None, behavior=None)
