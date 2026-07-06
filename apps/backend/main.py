import os
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException, Response
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from supabase import create_client, Client
import uuid

from auth import get_current_user, User
from db import get_db, SessionLocal
from models import Document, Project, Result, ContractOutcome, ModelRegistry
from document_parser import extract_text_and_tables
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import agent
from ml.features import FeatureExtractor
from ml.predictor import predict_project_risk
from ml.retrain import retrain_model_from_real_data, MIN_RETRAIN_THRESHOLD

app = FastAPI(title="ProcureMind AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Supabase credentials not configured")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/projects/{project_id}/documents")
async def upload_document(
    project_id: str,
    vendor_name: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify project exists and user has access
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        # Create it if it doesn't exist just for the sake of the API flow
        # In a real app we'd have a separate POST /projects endpoint
        project = Project(id=project_id, name="Test Project", user_id=current_user.id)
        db.add(project)
        db.commit()
    
    file_bytes = await file.read()
    
    # Upload to Supabase Storage
    try:
        supabase = get_supabase()
        file_path = f"{project_id}/{uuid.uuid4()}_{file.filename}"
        supabase.storage.from_("proposals").upload(
            path=file_path,
            file=file_bytes,
            file_options={"content-type": file.content_type}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to storage: {str(e)}")

    # Parse document
    extracted_text = extract_text_and_tables(file_bytes, file.content_type)
    
    # Save to database
    document = Document(
        project_id=project.id,
        user_id=current_user.id,
        file_name=file.filename,
        file_path=file_path,
        file_type=file.content_type,
        raw_text=extracted_text
    )
    db.add(document)
    db.flush() # Populate document.id immediately
    
    # Instantly add the vendor to the Results JSON so it appears in Vendor Directory immediately
    result = db.query(models.Result).filter_by(project_id=project.id, user_id=current_user.id).first()
    if not result:
        result = models.Result(
            project_id=project.id, 
            user_id=current_user.id,
            structured_proposal={"vendors": []},
            cost_breakdown={"total_spend": "$0", "discrepancies": "$0", "items": []},
            risk_flags={"high": 0, "medium": 0, "low": 0, "items": []},
            policy_rules={"items": []}
        )
        db.add(result)
    
    if not result.structured_proposal:
        result.structured_proposal = {"vendors": []}
    if "vendors" not in result.structured_proposal:
        result.structured_proposal["vendors"] = []
        
    vendors = result.structured_proposal["vendors"]
    # Check if this vendor name already exists
    if not any(v.get("name") == vendor_name for v in vendors):
        vendors.append({
            "id": str(document.id), # Tie vendor ID to doc ID
            "name": vendor_name,
            "category": "Pending Analysis",
            "owner": "Unassigned",
            "spend": "$0",
            "risk": "low"
        })
        # SQLAlchemy JSON mutations might need to be explicitly flagged or re-assigned
        result.structured_proposal = {"vendors": vendors}
        
    db.commit()
    db.refresh(document)
    
    return {
        "id": str(document.id),
        "file_name": document.file_name,
        "vendor_name": vendor_name
    }

# Dummy status storage for simplicity in this phase
pipeline_status = {}

@app.post("/projects")
def create_project(name: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = Project(name=name, user_id=current_user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return {"id": str(project.id), "name": project.name}

@app.get("/projects")
def list_projects(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    projects = db.query(Project).filter(Project.user_id == current_user.id).all()
    return projects

@app.get("/projects/{project_id}/documents")
def list_documents(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = db.query(models.Document).filter_by(project_id=project_id, user_id=current_user.id).all()
    result = db.query(models.Result).filter_by(project_id=project_id, user_id=current_user.id).first()
    
    vendor_map = {}
    if result and result.structured_proposal and "vendors" in result.structured_proposal:
        for v in result.structured_proposal["vendors"]:
            if "id" in v:
                vendor_map[v["id"]] = v.get("name", "Unknown")
                
    return [
        {
            "id": str(d.id),
            "vendor": vendor_map.get(str(d.id), "Pending Extraction..."), 
            "name": d.file_name,
            "type": d.file_type or "Unknown",
            "date": d.created_at.strftime("%Y-%m-%d"),
            "status": "Active"
        }
        for d in docs
    ]
@app.delete("/projects/{project_id}/documents/{document_id}")
def delete_document(project_id: str, document_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter_by(id=document_id, project_id=project_id, user_id=current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Try to delete from supabase storage
    try:
        supabase = get_supabase()
        supabase.storage.from_("proposals").remove([doc.file_path])
    except Exception as e:
        print(f"Failed to delete from storage: {e}")
        
    # Also delete the vendor from Result structured_proposal if it exists
    result = db.query(models.Result).filter_by(project_id=project_id, user_id=current_user.id).first()
    if result and result.structured_proposal and "vendors" in result.structured_proposal:
        vendors = result.structured_proposal["vendors"]
        updated_vendors = [v for v in vendors if v.get("id") != document_id]
        result.structured_proposal = {"vendors": updated_vendors}
        
    db.delete(doc)
    db.commit()
    return {"status": "deleted"}
@app.get("/projects/{project_id}/documents/{document_id}/download")
def download_document(project_id: str, document_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter_by(id=document_id, project_id=project_id, user_id=current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    try:
        supabase = get_supabase()
        # Create a signed URL valid for 60 seconds
        res = supabase.storage.from_("proposals").create_signed_url(doc.file_path, 60)
        return RedirectResponse(url=res["signedURL"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate download link: {e}")

@app.delete("/projects/{project_id}/vendors/{vendor_name}")
def delete_vendor(project_id: str, vendor_name: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = db.query(models.Result).filter_by(project_id=project_id, user_id=current_user.id).first()
    if result and result.structured_proposal and "vendors" in result.structured_proposal:
        vendors = result.structured_proposal["vendors"]
        updated_vendors = [v for v in vendors if v.get("name") != vendor_name]
        result.structured_proposal = {"vendors": updated_vendors}
        db.commit()
    return {"status": "deleted"}

@app.post("/projects/{project_id}/weights")
def set_weights(project_id: str, weights: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Save weights to the result record for this project
    result = db.query(models.Result).filter_by(project_id=project_id, user_id=current_user.id).first()
    if result and result.recommendation:
        rec = dict(result.recommendation)
        rec["weights_used"] = weights
        result.recommendation = rec
        db.commit()
    return {"status": "success", "weights": weights}

class UserPreference(BaseModel):
    view_mode: str = "simple"

@app.get("/user-preferences")
def get_user_preferences(current_user: User = Depends(get_current_user)):
    # Return from Supabase directly - the frontend handles this via the Supabase client
    return {"view_mode": "simple"}

@app.put("/user-preferences")
def update_user_preferences(prefs: UserPreference, current_user: User = Depends(get_current_user)):
    return {"view_mode": prefs.view_mode}

@app.post("/projects/{project_id}/policy-rules")
def set_policy_rules(project_id: str, rules: list, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"status": "success", "rules": rules}

import asyncio

@app.post("/projects/{project_id}/run")
async def run_pipeline(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Start a background task for the pipeline
    pipeline_status[project_id] = {
        "status": "running",
        "current_step": "Document Parsing",
        "steps": [
            {"name": "Document Parsing", "status": "pending"},
            {"name": "Information Extraction", "status": "pending"},
            {"name": "Cost Analysis", "status": "pending"},
            {"name": "Risk Assessment", "status": "pending"},
            {"name": "Feature Comparison", "status": "pending"},
            {"name": "Compliance Validation", "status": "pending"},
            {"name": "Vendor Scoring", "status": "pending"},
            {"name": "Timeline Analysis", "status": "pending"},
            {"name": "Insight Detection", "status": "pending"},
            {"name": "Red-Team Review", "status": "pending"},
            {"name": "Executive Summary", "status": "pending"}
        ]
    }
    
    async def mock_pipeline():
        for step in pipeline_status[project_id]["steps"]:
            step["status"] = "running"
            pipeline_status[project_id]["current_step"] = step["name"]
            
            if step["name"] == "Information Extraction":
                # Build the FAISS index during extraction
                session = SessionLocal()
                try:
                    db_docs = session.query(models.Document).filter_by(project_id=project_id).all()
                    if db_docs:
                        agent.build_project_index(project_id, db_docs)
                except Exception as e:
                    print("Error building index:", e)
                finally:
                    session.close()

            await asyncio.sleep(2) # Simulate processing time
            step["status"] = "done"
            
        pipeline_status[project_id]["status"] = "completed"
        
        # Save mock results to DB
        session = SessionLocal()
        try:
            db_docs = session.query(models.Document).filter_by(project_id=project_id).all()
            analysis = await agent.analyze_all_documents(db_docs)
            
            # Extract feature snapshots for all vendors
            feature_snapshot = {}
            for v in analysis.get("structured_proposal", {}).get("vendors", []):
                doc = next((d for d in db_docs if str(d.id) == v.get("id")), None)
                raw_text = doc.raw_text if doc else ""
                
                v_costs = [c for c in analysis.get("cost_breakdown", {}).get("items", []) if c.get("vendor") == v.get("name")]
                
                v_risks_items = [r for r in analysis.get("risk_flags", {}).get("items", []) if r.get("vendor") == v.get("name")]
                v_risk_data = {}
                if v_risks_items:
                    first_r = v_risks_items[0]
                    v_risk_data = {
                        "financialRisk": first_r.get("financialRisk", "low"),
                        "securityRisk": first_r.get("securityRisk", "low"),
                        "operationalRisk": first_r.get("operationalRisk", "low")
                    }
                
                v_compliance = [c for c in analysis.get("policy_rules", {}).get("items", []) if c.get("vendor") == v.get("name")]
                
                v_sla = []
                if "sla_metrics" in analysis:
                    v_sla = [s for s in analysis["sla_metrics"].get("items", []) if s.get("vendor") == v.get("name")]
                elif "score_results" in analysis and "sla_metrics" in analysis["score_results"]:
                    v_sla = [s for s in analysis["score_results"]["sla_metrics"].get("items", []) if s.get("vendor") == v.get("name")]

                v_features = FeatureExtractor.extract_features(
                    vendor_data=v,
                    cost_items=v_costs,
                    risk_data=v_risk_data,
                    compliance_items=v_compliance,
                    sla_items=v_sla,
                    raw_text=raw_text
                )
                feature_snapshot[v.get("id")] = v_features
                
            score_results = analysis["score_results"]
            
            result = session.query(models.Result).filter_by(project_id=project_id).first()
            if not result:
                result = models.Result(
                    project_id=project_id, 
                    user_id=current_user.id,
                    structured_proposal=analysis["structured_proposal"],
                    cost_breakdown=analysis["cost_breakdown"],
                    risk_flags=analysis["risk_flags"],
                    policy_rules=analysis["policy_rules"],
                    score_results=score_results,
                    plain_language=analysis.get("plain_language", {}),
                    timeline_events=analysis.get("timeline_events", []),
                    recommendation=analysis.get("recommendation", {}),
                    insight=analysis.get("insight", {}),
                    red_team=analysis.get("red_team", {}),
                    feature_snapshot=feature_snapshot
                )
                session.add(result)
            else:
                result.structured_proposal = analysis["structured_proposal"]
                result.cost_breakdown = analysis["cost_breakdown"]
                result.risk_flags = analysis["risk_flags"]
                result.policy_rules = analysis["policy_rules"]
                result.score_results = score_results
                result.plain_language = analysis.get("plain_language", {})
                result.timeline_events = analysis.get("timeline_events", [])
                result.recommendation = analysis.get("recommendation", {})
                result.insight = analysis.get("insight", {})
                result.red_team = analysis.get("red_team", {})
                result.feature_snapshot = feature_snapshot
            session.commit()
        except Exception as e:
            print("Error saving analysis results:", e)
            session.rollback()
        finally:
            session.close()
            
    asyncio.create_task(mock_pipeline())
    return {"status": "started"}
 
@app.get("/projects/{project_id}/status")
def get_status(project_id: str, current_user: User = Depends(get_current_user)):
    return pipeline_status.get(project_id, {"status": "not_started", "steps": []})
 
import models
@app.get("/projects/{project_id}/results")
def get_results(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = db.query(models.Result).filter_by(project_id=project_id, user_id=current_user.id).first()
    if not result:
        return {
            "structured_proposal": {"vendors": []},
            "cost_breakdown": {"total_spend": "$0", "actual_spend": "$0", "discrepancies": "$0", "items": []},
            "risk_flags": {"high": 0, "medium": 0, "low": 0, "items": []},
            "policy_rules": {"items": []},
            "sla_metrics": {"items": []},
            "score_results": {},
            "summary": {"totalStated": "$0", "totalActual": "$0", "variance": "$0"}
        }
        
    sla_metrics = result.score_results.get("sla_metrics", {"items": []}) if result.score_results else {"items": []}
    
    summary = {
        "totalStated": result.cost_breakdown.get("total_spend", "$0") if result.cost_breakdown else "$0",
        "totalActual": result.cost_breakdown.get("actual_spend", "$0") if result.cost_breakdown else "$0",
        "variance": result.cost_breakdown.get("discrepancies", "$0") if result.cost_breakdown else "$0"
    }
    
    return {
        "structured_proposal": result.structured_proposal,
        "cost_breakdown": result.cost_breakdown,
        "risk_flags": result.risk_flags,
        "policy_rules": result.policy_rules,
        "score_results": result.score_results,
        "sla_metrics": sla_metrics,
        "summary": summary,
        "plain_language": result.plain_language or {},
        "timeline_events": result.timeline_events or [],
        "recommendation": result.recommendation or {},
        "insight": result.insight or {},
        "red_team": result.red_team or {}
    }

class AskRequest(BaseModel):
    question: str

@app.post("/projects/{project_id}/ask")
def ask_question_endpoint(project_id: str, request: AskRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        response = agent.ask_question(project_id, request.question, db)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from weasyprint import HTML
from jinja2 import Template

@app.get("/projects/{project_id}/export/pdf")
def export_pdf(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = db.query(models.Result).filter_by(project_id=project_id, user_id=current_user.id).first()
    project = db.query(models.Project).filter_by(id=project_id, user_id=current_user.id).first()
    
    if not result or not project:
        raise HTTPException(status_code=404, detail="Project or results not found")

    # Prepare data for template
    total_recoverable = result.cost_breakdown.get("discrepancies", "$0") if result.cost_breakdown else "$0"
    vendors_audited = len(result.structured_proposal.get("vendors", [])) if result.structured_proposal else 0
    critical_alerts = result.risk_flags.get("high", 0) if result.risk_flags else 0
    
    exec_summary = result.score_results.get("executive_summary", {}) if result.score_results else {}
    key_findings = exec_summary.get("key_findings", [])
    recommended_actions = exec_summary.get("recommended_actions", [])

    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,600&display=swap');
            
            body {
                font-family: 'IBM Plex Sans', sans-serif;
                background-color: #F6F5F1;
                color: #161A1E;
                padding: 40px;
            }
            h1, h2, h3 {
                font-family: 'Source Serif 4', serif;
                font-weight: 600;
                color: #1D3557;
            }
            .number {
                font-family: 'IBM Plex Mono', monospace;
            }
            .text-red {
                color: #A6402E;
            }
            .divider {
                border-bottom: 2px solid #1D3557;
                margin-top: 10px;
                margin-bottom: 20px;
            }
            .card {
                border: 1px solid #DAD5C8;
                background-color: #FFFFFF;
                padding: 20px;
                margin-bottom: 20px;
            }
            .stat-value {
                font-size: 24px;
                font-weight: bold;
            }
            ul {
                padding-left: 20px;
                margin: 0;
            }
            li {
                margin-bottom: 8px;
                line-height: 1.4;
            }
        </style>
    </head>
    <body>
        <h1>Executive Summary: {{ project.name }}</h1>
        <div class="divider"></div>
        
        <div class="card">
            <h3>Total Recoverable Cost</h3>
            <div class="stat-value number">{{ total_recoverable }}</div>
        </div>
        
        <div class="card">
            <h3>Vendors Audited</h3>
            <div class="stat-value number">{{ vendors_audited }}</div>
        </div>
        
        <div class="card">
            <h3 class="text-red">Critical Risk Alerts</h3>
            <div class="stat-value number text-red">{{ critical_alerts }}</div>
        </div>
        
        <h2>Key Strategic Findings</h2>
        <div class="divider"></div>
        <div class="card">
            {% if key_findings %}
                <ul>
                {% for finding in key_findings %}
                    <li>{{ finding }}</li>
                {% endfor %}
                </ul>
            {% else %}
                <p>No findings generated yet.</p>
            {% endif %}
        </div>

        <h2>Recommended Actions</h2>
        <div class="divider"></div>
        <div class="card">
            {% if recommended_actions %}
                <ul>
                {% for action in recommended_actions %}
                    <li>{{ action }}</li>
                {% endfor %}
                </ul>
            {% else %}
                <p>No actions required.</p>
            {% endif %}
        </div>
    </body>
    </html>
    """
    
    template = Template(html_content)
    rendered_html = template.render(
        project=project,
        total_recoverable=total_recoverable,
        vendors_audited=vendors_audited,
        critical_alerts=critical_alerts,
        key_findings=key_findings,
        recommended_actions=recommended_actions
    )
    
    pdf_bytes = HTML(string=rendered_html).write_pdf()
    
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=executive_summary_{project_id}.pdf"})


# --- PHASE 6 OUTCOME LOGGING & MACHINE LEARNING ENDPOINTS ---

class OutcomeSubmitSchema(BaseModel):
    vendor_id: str
    delivered_on_time: Optional[bool] = None
    actual_delivery_days: Optional[int] = None
    hidden_costs_materialized: Optional[bool] = None
    actual_total_cost: Optional[float] = None
    negotiation_asks_succeeded: Optional[Dict[str, bool]] = None
    overall_satisfaction: Optional[int] = None
    notes: Optional[str] = None

@app.post("/projects/{project_id}/outcomes")
def log_contract_outcome(
    project_id: str,
    payload: OutcomeSubmitSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify project exists and belongs to user
    project = db.query(models.Project).filter_by(id=project_id, user_id=current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Check if an outcome already exists for this vendor
    existing = db.query(models.ContractOutcome).filter_by(project_id=project.id, vendor_id=payload.vendor_id).first()
    
    if existing:
        # Update existing
        existing.delivered_on_time = payload.delivered_on_time
        existing.actual_delivery_days = payload.actual_delivery_days
        existing.hidden_costs_materialized = payload.hidden_costs_materialized
        existing.actual_total_cost = payload.actual_total_cost
        existing.negotiation_asks_succeeded = payload.negotiation_asks_succeeded
        existing.overall_satisfaction = payload.overall_satisfaction
        existing.notes = payload.notes
        existing.logged_by = current_user.id
    else:
        # Create new
        outcome = models.ContractOutcome(
            project_id=project.id,
            vendor_id=payload.vendor_id,
            delivered_on_time=payload.delivered_on_time,
            actual_delivery_days=payload.actual_delivery_days,
            hidden_costs_materialized=payload.hidden_costs_materialized,
            actual_total_cost=payload.actual_total_cost,
            negotiation_asks_succeeded=payload.negotiation_asks_succeeded or {},
            overall_satisfaction=payload.overall_satisfaction,
            notes=payload.notes,
            logged_by=current_user.id
        )
        db.add(outcome)
        
    db.commit()
    return {"status": "success", "message": "Contract outcome logged successfully"}

@app.get("/projects/{project_id}/outcomes")
def get_contract_outcomes(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(models.Project).filter_by(id=project_id, user_id=current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    outcomes = db.query(models.ContractOutcome).filter_by(project_id=project.id).all()
    return {
        "outcomes": [
            {
                "id": str(o.id),
                "vendor_id": o.vendor_id,
                "delivered_on_time": o.delivered_on_time,
                "actual_delivery_days": o.actual_delivery_days,
                "hidden_costs_materialized": o.hidden_costs_materialized,
                "actual_total_cost": o.actual_total_cost,
                "negotiation_asks_succeeded": o.negotiation_asks_succeeded,
                "overall_satisfaction": o.overall_satisfaction,
                "notes": o.notes,
                "logged_at": o.logged_at.isoformat() if o.logged_at else None
            } for o in outcomes
        ]
    }

def check_is_admin(user_id: str, db: Session) -> bool:
    profile = db.query(models.Profile).filter_by(id=user_id).first()
    if profile:
        return profile.is_admin
    # Auto-bootstrap profile as non-admin if missing
    try:
        profile = models.Profile(id=uuid.UUID(user_id) if isinstance(user_id, str) else user_id, is_admin=False)
        db.add(profile)
        db.commit()
    except Exception as e:
        print("Failed to auto-create profile:", e)
        db.rollback()
    return False

@app.get("/auth/profile")
def get_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(models.Profile).filter_by(id=current_user.id).first()
    if not profile:
        try:
            profile = models.Profile(id=uuid.UUID(current_user.id), is_admin=False)
            db.add(profile)
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to create profile: {e}")
    return {"id": str(profile.id), "is_admin": profile.is_admin, "email": current_user.email}

@app.post("/projects/{project_id}/ml-risk-prediction")
def get_ml_risk_prediction(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(models.Project).filter_by(id=project_id, user_id=current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    result = db.query(models.Result).filter_by(project_id=project.id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Analysis results not found")
        
    prediction_payload = predict_project_risk(db, result)
    return prediction_payload

@app.get("/ml/status")
def get_ml_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not check_is_admin(current_user.id, db):
        raise HTTPException(status_code=403, detail="Admin access required")
        
    real_count = db.query(models.ContractOutcome).count()
    registry = db.query(models.ModelRegistry).order_by(models.ModelRegistry.trained_at.desc()).all()
    
    return {
        "real_outcomes_count": real_count,
        "threshold": MIN_RETRAIN_THRESHOLD,
        "needs_more": max(0, MIN_RETRAIN_THRESHOLD - real_count),
        "registry": [
            {
                "id": str(m.id),
                "version": m.version,
                "training_data_size": m.training_data_size,
                "validation_metrics": o_metrics if isinstance((o_metrics := m.validation_metrics), dict) else {},
                "is_active": m.is_active,
                "trained_at": m.trained_at.isoformat() if m.trained_at else None
            } for m in registry
        ]
    }

@app.post("/ml/retrain")
def trigger_ml_retraining(
    force: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    if not check_is_admin(current_user.id, db):
        raise HTTPException(status_code=403, detail="Admin access required")
        
    res = retrain_model_from_real_data(force=force)
    return res




