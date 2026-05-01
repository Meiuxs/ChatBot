from fastapi import FastAPI

app = FastAPI(title="Test")

@app.get("/health")
async def health():
    return {"status": "ok"}
