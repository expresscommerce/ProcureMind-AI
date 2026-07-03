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
from db import get_db
from models import Document, Project
from document_parser import extract_text_and_tables
from pydantic import BaseModel
import agent

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
    return {"status": "success", "weights": weights}

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
                    score_results=score_results
                )
                session.add(result)
            else:
                result.structured_proposal = analysis["structured_proposal"]
                result.cost_breakdown = analysis["cost_breakdown"]
                result.risk_flags = analysis["risk_flags"]
                result.policy_rules = analysis["policy_rules"]
                result.score_results = score_results
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
        "summary": summary
    }

class AskRequest(BaseModel):
    question: str

@app.post("/projects/{project_id}/ask")
def ask_question_endpoint(project_id: str, request: AskRequest, current_user: User = Depends(get_current_user)):
    try:
        response = agent.ask_question(project_id, request.question)
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



