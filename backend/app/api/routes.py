from fastapi import APIRouter, UploadFile, File, HTTPException
from parsers import parse_eml
from models import ParsedEmail

router = APIRouter(prefix="/api")


@router.post("/analyze", response_model=ParsedEmail)
async def analyze_eml(file: UploadFile = File(...)):
    if not file.filename.endswith(".eml"):
        raise HTTPException(status_code=400, detail="Le fichier doit être un .eml")
    raw = await file.read()
    return parse_eml(raw)
