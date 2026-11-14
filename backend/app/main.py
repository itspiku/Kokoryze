from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import store
from .api_clinic import router as clinic_router
from .api_eeg import router as eeg_router
from .api_patient import router as patient_router

app = FastAPI(title="Kokoryze API", version="0.1.0",
              description="Home brain-health monitoring demo. Synthetic data only. Not a medical device.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(patient_router)
app.include_router(clinic_router)
app.include_router(eeg_router)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/demo/reset")
def demo_reset():
    store.reset()
    return {"ok": True}
