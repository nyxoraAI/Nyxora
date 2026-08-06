from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import base64
import os
import json
import re
from routers.llm import get_llm
from langchain_core.messages import SystemMessage, HumanMessage

router = APIRouter()

class ChartRequest(BaseModel):
    image_path: str
    question: Optional[str] = None

class ChartAnalysis(BaseModel):
    title: Optional[str]
    x_axis: Optional[str]
    y_axis: Optional[str]
    data_points: List[str]
    trend: Optional[str]
    key_insight: Optional[str]
    raw_analysis: str

class VerifyRequest(BaseModel):
    screenshot_path: str
    expected_description: str
    strict: bool = False

class VerifyResponse(BaseModel):
    matches: bool
    confidence: float
    issues: List[str]
    suggestions: List[str]

def encode_image(image_path: str) -> str:
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image not found")
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def get_mime_type(image_path: str) -> str:
    ext = os.path.splitext(image_path)[1].lower()
    if ext == '.png':
        return 'image/png'
    elif ext in ['.jpg', '.jpeg']:
        return 'image/jpeg'
    elif ext == '.webp':
        return 'image/webp'
    return 'image/jpeg'

@router.post("/analyze-chart", response_model=ChartAnalysis)
async def analyze_chart(req: ChartRequest):
    base64_img = encode_image(req.image_path)
    mime_type = get_mime_type(req.image_path)
    llm = get_llm()
    
    msg_content = [
        {"type": "text", "text": req.question if req.question else "Analyze this chart in detail. Extract the title, axes, data points, trend, and key insight."}
    ]
    
    msg_content.append({
        "type": "image_url",
        "image_url": {"url": f"data:{mime_type};base64,{base64_img}"}
    })
    
    try:
        structured_llm = llm.with_structured_output(ChartAnalysis)
        messages = [
            SystemMessage(content="You are an expert data analyst. Extract precise details from the chart."),
            HumanMessage(content=msg_content)
        ]
        result = structured_llm.invoke(messages)
        return result
    except Exception as e:
        print(f"[Vision] Structured LLM Failed, trying raw: {str(e)}")
        messages = [
            SystemMessage(content="You are an expert data analyst. Return JSON matching the schema: {\"title\": \"str\", \"x_axis\": \"str\", \"y_axis\": \"str\", \"data_points\": [\"str\"], \"trend\": \"str\", \"key_insight\": \"str\", \"raw_analysis\": \"str\"}. DO NOT return markdown blocks, just raw JSON."),
            HumanMessage(content=msg_content)
        ]
        try:
            res = llm.invoke(messages)
            content = res.content
            if isinstance(content, list):
                content = content[0].get("text", "")
            content = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.IGNORECASE)
            content = re.sub(r"\s*```$", "", content).strip()
            data = json.loads(content)
            return ChartAnalysis(**data)
        except Exception as inner_e:
            raise HTTPException(status_code=500, detail=f"LLM parsing error: {inner_e}")

@router.post("/verify-screenshot", response_model=VerifyResponse)
async def verify_screenshot(req: VerifyRequest):
    base64_img = encode_image(req.screenshot_path)
    mime_type = get_mime_type(req.screenshot_path)
    llm = get_llm()
    
    prompt = f"Verify if this screenshot matches the expected description: '{req.expected_description}'. Strict mode is {'ON' if req.strict else 'OFF'}."
    
    msg_content = [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{base64_img}"}}
    ]
    
    try:
        structured_llm = llm.with_structured_output(VerifyResponse)
        messages = [
            SystemMessage(content="You are a QA automation expert. Verify visual state."),
            HumanMessage(content=msg_content)
        ]
        result = structured_llm.invoke(messages)
        return result
    except Exception as e:
        print(f"[Vision] Structured LLM Failed, trying raw: {str(e)}")
        messages = [
            SystemMessage(content="You are a QA automation expert. Return JSON matching schema: {\"matches\": true, \"confidence\": 0.9, \"issues\": [], \"suggestions\": []}. DO NOT return markdown blocks, just raw JSON."),
            HumanMessage(content=msg_content)
        ]
        try:
            res = llm.invoke(messages)
            content = res.content
            if isinstance(content, list):
                content = content[0].get("text", "")
            content = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.IGNORECASE)
            content = re.sub(r"\s*```$", "", content).strip()
            data = json.loads(content)
            return VerifyResponse(**data)
        except Exception as inner_e:
            raise HTTPException(status_code=500, detail=f"LLM parsing error: {inner_e}")
