from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.ai import client as ai_client
from app.config import get_settings
from app.routers import analyze, auth, investigations

settings = get_settings()

app = FastAPI(title="ProofLink API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(analyze.router)
app.include_router(investigations.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "service": "prooflink-api", "ai_enabled": ai_client.enabled()}
