from fastapi import FastAPI

from routers import auth, documents

app = FastAPI(title="DataShield API", version="0.1.0")

app.include_router(auth.router)
app.include_router(documents.router)


@app.get("/health")
def health():
    return {"status": "ok"}
