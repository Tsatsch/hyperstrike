from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import wallet

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Add your frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(wallet.router, prefix="/api", tags=["wallet"])

@app.get("/")
def read_root():
    return {"message": "Hello, FastAPI working!"}

