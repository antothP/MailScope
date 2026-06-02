from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from parsers import parse_eml
from analyzers import analyze_headers, analyze_attachment, compute_score
from analyzers.scoring import ScoreResult as _ScoreResult
from models.analysis import ParsedEmail, HeaderAnalysis, AttachmentAnalysis, ScoreResult

router = APIRouter(prefix="/api")


class AnalyzeResponse(BaseModel):
    email: ParsedEmail
    header_analysis: HeaderAnalysis
    attachment_analyses: list[AttachmentAnalysis]
    score: ScoreResult


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_eml(file: UploadFile = File(...)):
    if not file.filename.endswith(".eml"):
        raise HTTPException(status_code=400, detail="Le fichier doit être un .eml")

    raw = await file.read()
    parsed, raw_attachments = parse_eml(raw)

    header_analysis = analyze_headers(parsed.headers, parsed.sender)
    attachment_analyses = [
        analyze_attachment(fname, ct, data)
        for fname, ct, data in raw_attachments
    ]
    result = compute_score(header_analysis, attachment_analyses)

    return AnalyzeResponse(
        email=parsed,
        header_analysis=header_analysis,
        attachment_analyses=attachment_analyses,
        score=ScoreResult(score=result.score, level=result.level, reasons=result.reasons),
    )
