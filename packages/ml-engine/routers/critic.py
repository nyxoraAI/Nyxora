from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from routers.llm import get_llm
from langchain_core.prompts import ChatPromptTemplate
import json
import re

router = APIRouter()


class CriticRequest(BaseModel):
    user_input: str
    draft_answer: str
    current_utc_datetime: Optional[str] = None  # e.g. "2026-07-04T06:43:00Z"


class CriticResponse(BaseModel):
    needs_revision: bool
    factual_confidence: float   # 0.0 – 1.0
    completeness: float         # 0.0 – 1.0
    revision_instructions: str  # Kosong jika lolos


CRITIC_SYSTEM_PROMPT = """You are a STRICT QUALITY EVALUATOR for an AI assistant called Nyxora, used by global users across different timezones and languages.
You must evaluate a DRAFT ANSWER against the USER'S QUESTION and return ONLY a JSON object.

The current UTC date and time is: {current_utc_datetime}

Evaluate on these dimensions:
- "factual_confidence" (float 0.0-1.0): How certain are you all facts, dates, numbers, and events in the draft are accurate and not hallucinated? If the draft uses tools/search results as evidence, confidence can be higher.
- "completeness" (float 0.0-1.0): Does the draft fully and directly answer what the user asked?
- "needs_revision" (boolean): Set TRUE if factual_confidence < 0.75 OR completeness < 0.75.
- "revision_instructions" (string): If needs_revision is true, write concise, specific instructions on EXACTLY what to fix. If false, return "".

RULES:
- Return ONLY raw JSON. No markdown, no explanation outside the JSON.
- Be strict. Prefer to flag rather than pass.
- If the draft contains phrases like "I think", "probably", "might be", "kemungkinan besar", or vague hedging on factual claims WITHOUT supporting tool evidence, lower factual_confidence significantly.
- If the draft says it "cannot" find information but did not actually try searching, set needs_revision=true.
- Short conversational replies (greetings, acknowledgements, simple confirmations) should always pass with high scores.

STALENESS RULE (Critical for Global Users):
- If the user's question contains ANY time-sensitive reference in ANY language (e.g. "today", "this morning", "now", "latest", "current", "tadi", "hari ini", "sekarang", "terbaru", "今日", "сегодня", "aujourd'hui", "hoy", "heute", etc.)...
  AND the draft answer provides factual data (scores, prices, news, events) WITHOUT any explicit mention of having searched/retrieved live data...
  THEN set needs_revision=true and set revision_instructions to: "The question is time-sensitive. The draft may contain stale data from conversation history. Instruct the AI to call search_web NOW with the current UTC date ({current_utc_datetime}) to retrieve fresh results."
- If the draft explicitly states it searched and found results, this rule does NOT apply.

Return format (raw JSON only):
{{"needs_revision": false, "factual_confidence": 0.95, "completeness": 0.9, "revision_instructions": ""}}
"""


@router.post("/critic", response_model=CriticResponse)
async def evaluate_draft(request: CriticRequest):
    """
    Critic Engine — evaluates a draft answer before it is sent to the user.
    Accepts current_utc_datetime to detect stale answers for global users.
    """
    # Skip evaluation for very short responses (greetings, confirmations, etc.)
    if len(request.draft_answer.strip()) < 100:
        return CriticResponse(
            needs_revision=False,
            factual_confidence=1.0,
            completeness=1.0,
            revision_instructions=""
        )

    current_utc = request.current_utc_datetime or "unknown"

    llm = get_llm()
    prompt = ChatPromptTemplate.from_messages([
        ("system", CRITIC_SYSTEM_PROMPT),
        ("user", "USER QUESTION:\n{user_input}\n\nDRAFT ANSWER:\n{draft_answer}\n\nEvaluate the draft now and return only JSON.")
    ])

    try:
        chain = prompt | llm
        result = chain.invoke({
            "user_input": request.user_input,
            "draft_answer": request.draft_answer,
            "current_utc_datetime": current_utc
        })
        content = result.content.strip()

        # Strip potential markdown code fences from LLM response
        content = re.sub(r"^```(?:json)?\s*", "", content, flags=re.IGNORECASE)
        content = re.sub(r"\s*```$", "", content).strip()

        # Extract JSON object if there is surrounding text
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            content = json_match.group(0)

        data = json.loads(content)

        return CriticResponse(
            needs_revision=bool(data.get("needs_revision", False)),
            factual_confidence=float(data.get("factual_confidence", 1.0)),
            completeness=float(data.get("completeness", 1.0)),
            revision_instructions=str(data.get("revision_instructions", ""))
        )

    except Exception as e:
        print(f"[Critic] Evaluation error (passing through): {e}")
        return CriticResponse(
            needs_revision=False,
            factual_confidence=1.0,
            completeness=1.0,
            revision_instructions=""
        )
