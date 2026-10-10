from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.ai import analyze_with_ai
from app.analysis import Analysis
from app.database import get_db
from app.graph import CaseRef, Graph, build_graph
from app.deps import get_current_user
from app.models import AnalysisResult, Investigation, User
from app.models import Entity as EntityRow
from app.ratelimit import rate_limited_user
from app.routers.analyze import AnalyzeRequest
from app.schemas import DashboardStats, InvestigationDetail, InvestigationList, InvestigationSummary

router = APIRouter(prefix="/investigations", tags=["investigations"])

RiskLevel = Literal["SAFE", "SUSPICIOUS", "HIGH_RISK"]


def _preview(text: str | None, n: int = 140) -> str:
    flat = " ".join((text or "").split())
    return flat if len(flat) <= n else flat[: n - 1] + "…"


def _summary(inv: Investigation) -> InvestigationSummary:
    signals = inv.result.signals if inv.result else []
    return InvestigationSummary(
        id=inv.id, created_at=inv.created_at, input_type=inv.input_type,
        risk_level=inv.risk_level or "SAFE", risk_score=inv.risk_score or 0,
        preview=_preview(inv.raw_text), top_signals=[s["label"] for s in signals[:2]],
    )


def _detail(inv: Investigation) -> InvestigationDetail:
    return InvestigationDetail(
        id=inv.id, created_at=inv.created_at, input_type=inv.input_type,
        content=inv.raw_text or "", analysis=Analysis.model_validate(inv.result.raw_analysis),
    )


def _owned(db: Session, user: User, investigation_id: int) -> Investigation:
    # Always filter by user_id: one user must never be able to read or delete another's data.
    inv = db.scalar(
        select(Investigation)
        .where(Investigation.id == investigation_id, Investigation.user_id == user.id)
        .options(selectinload(Investigation.result))
    )
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Investigation not found")
    return inv


@router.post("", response_model=InvestigationDetail, status_code=status.HTTP_201_CREATED)
def create_investigation(body: AnalyzeRequest, user: User = Depends(rate_limited_user), db: Session = Depends(get_db)):
    """Analyse the content and save the investigation to the user's history."""
    analysis = analyze_with_ai(body.content, body.input_type)
    inv = Investigation(
        user_id=user.id, input_type=analysis.input_type, raw_text=body.content,
        risk_level=analysis.risk_level, risk_score=analysis.risk_score,
    )
    inv.result = AnalysisResult(
        risk_level=analysis.risk_level, risk_score=analysis.risk_score, confidence=analysis.confidence,
        signals=[s.model_dump() for s in analysis.signals], explanation=analysis.explanation,
        recommended_actions=analysis.recommended_actions, raw_analysis=analysis.model_dump(),
    )
    inv.entities = [
        EntityRow(kind=e.kind, value=e.value[:1024], flagged=e.flagged, flag_reason=e.flag_reason)
        for e in analysis.entities
    ]
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return _detail(inv)


@router.get("", response_model=InvestigationList)
def list_investigations(
    risk: RiskLevel | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    where = [Investigation.user_id == user.id]
    if risk:
        where.append(Investigation.risk_level == risk)
    total = db.scalar(select(func.count()).select_from(Investigation).where(*where)) or 0
    rows = db.scalars(
        select(Investigation).where(*where)
        .options(selectinload(Investigation.result))
        .order_by(Investigation.created_at.desc(), Investigation.id.desc())
        .limit(limit).offset(offset)
    ).all()
    return InvestigationList(items=[_summary(r) for r in rows], total=total)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_all_investigations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Clears this user's whole history. Loaded and deleted through the ORM so child rows cascade on SQLite too."""
    for inv in db.scalars(select(Investigation).where(Investigation.user_id == user.id)).all():
        db.delete(inv)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Declared before "/{investigation_id}" so "stats" is not parsed as an id.
@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    counts = dict(
        db.execute(
            select(Investigation.risk_level, func.count()).where(Investigation.user_id == user.id).group_by(Investigation.risk_level)
        ).all()
    )
    recent = db.scalars(
        select(Investigation).where(Investigation.user_id == user.id)
        .options(selectinload(Investigation.result))
        .order_by(Investigation.created_at.desc(), Investigation.id.desc()).limit(5)
    ).all()
    return DashboardStats(
        total=sum(counts.values()), high_risk=counts.get("HIGH_RISK", 0),
        suspicious=counts.get("SUSPICIOUS", 0), safe=counts.get("SAFE", 0),
        recent=[_summary(r) for r in recent],
    )


@router.get("/{investigation_id}/graph", response_model=Graph)
def investigation_graph(investigation_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Relationship graph for the 3D view. Cross-case links only ever use this user's own data."""
    inv = _owned(db, user, investigation_id)
    analysis = Analysis.model_validate(inv.result.raw_analysis)
    pairs = {(e.kind, e.value[:1024]) for e in analysis.entities if e.kind in ("url", "domain", "email", "phone")}
    related: dict[tuple[str, str], list[CaseRef]] = {}
    if pairs:
        rows = db.execute(
            select(EntityRow.kind, EntityRow.value, Investigation.id, Investigation.risk_level, Investigation.risk_score,
                   Investigation.created_at, Investigation.raw_text)
            .join(Investigation, Investigation.id == EntityRow.investigation_id)
            .where(
                Investigation.user_id == user.id,  # never another user's data
                Investigation.id != inv.id,
                or_(*[and_(EntityRow.kind == k, EntityRow.value == v) for k, v in pairs]),
            )
            .order_by(Investigation.created_at.desc(), Investigation.id.desc())
        ).all()
        for kind, value, iid, level, score, created, raw in rows:
            bucket = related.setdefault((kind, value), [])
            if all(c.id != iid for c in bucket):
                bucket.append(CaseRef(id=iid, risk_level=level or "SAFE", risk_score=score or 0, created_at=created, preview=_preview(raw)))
    return build_graph(inv.id, analysis, related)


@router.get("/{investigation_id}", response_model=InvestigationDetail)
def get_investigation(investigation_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _detail(_owned(db, user, investigation_id))


@router.delete("/{investigation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_investigation(investigation_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_owned(db, user, investigation_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
