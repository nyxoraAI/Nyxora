from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from config import config
from routers import market, cognitive, memory

app = FastAPI(
    title="Nyxora ML Engine",
    description="Universal AI & Data Science Sidecar for Nyxora",
    version="1.0.0"
)

# CORS middleware so Node.js can easily call it if needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market.router, prefix="/web3")
app.include_router(cognitive.router, prefix="/cognitive")
app.include_router(memory.router, prefix="/memory")

@app.get("/health")
async def health_check():
    """Simple health check endpoint"""
    return {
        "status": "ok",
        "llm_provider": config.get_llm_provider(),
        "llm_model": config.get_llm_model()
    }

