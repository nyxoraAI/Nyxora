from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from config import config
from routers import market, cognitive, memory, critic, background_review, skill_manager, memory_writer, os_agent

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
app.include_router(critic.router, prefix="/cognitive")
app.include_router(background_review.router, prefix="/cognitive")
app.include_router(memory.router, prefix="/memory")
app.include_router(memory_writer.router, prefix="/memory")
app.include_router(skill_manager.router, prefix="/skills")
app.include_router(os_agent.router, prefix="/os")

@app.get("/health")
async def health_check():
    """Simple health check endpoint"""
    return {
        "status": "ok",
        "llm_provider": config.get_llm_provider(),
        "llm_model": config.get_llm_model()
    }

