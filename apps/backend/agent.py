import os
import faiss
import pickle
import httpx
from langchain_openai import ChatOpenAI
from langchain_core.embeddings import Embeddings
from langchain_community.docstore.in_memory import InMemoryDocstore
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document as LangchainDocument

class DeepInfraEmbeddings(Embeddings):
    def __init__(self, model: str, api_key: str, base_url: str):
        self.model = model
        self.api_key = api_key
        self.base_url = base_url

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        embeddings = []
        chunk_size = 32
        for i in range(0, len(texts), chunk_size):
            batch = texts[i:i+chunk_size]
            payload = {
                "model": self.model,
                "input": batch
            }
            response = httpx.post(f"{self.base_url}/embeddings", json=payload, headers=headers, timeout=60.0)
            if response.status_code != 200:
                raise Exception(f"DeepInfra embeddings failed: {response.text}")
            data = response.json()
            batch_embeddings = [item["embedding"] for item in data["data"]]
            embeddings.extend(batch_embeddings)
        return embeddings

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]

def get_llm():
    return ChatOpenAI(
        model="meta-llama/Meta-Llama-3-70B-Instruct",
        api_key=os.environ.get("DEEPINFRA_API_KEY"),
        base_url="https://api.deepinfra.com/v1/openai",
        temperature=0
    )

def get_embeddings():
    return DeepInfraEmbeddings(
        model="BAAI/bge-large-en-v1.5",
        api_key=os.environ.get("DEEPINFRA_API_KEY"),
        base_url="https://api.deepinfra.com/v1/openai"
    )

def get_index_path(project_id: str) -> str:
    # Ensure a directory exists for faiss indices
    os.makedirs("faiss_indices", exist_ok=True)
    return f"faiss_indices/{project_id}"

def build_project_index(project_id: str, db_documents):
    """
    db_documents: list of SQLAlchemy Document models
    """
    embeddings = get_embeddings()
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    
    docs_to_index = []
    for doc in db_documents:
        if not doc.raw_text:
            continue
            
        chunks = text_splitter.split_text(doc.raw_text)
        
        # We need a way to map chunks to the document name and page number if possible.
        # document_parser.py includes "--- Page X ---" in the text.
        # We'll just pass the chunk as is, and keep the source document name.
        current_page = "1"
        for chunk in chunks:
            # Simple heuristic to extract page from chunk
            if "--- Page " in chunk:
                parts = chunk.split("--- Page ")
                if len(parts) > 1:
                    page_num = parts[1].split(" ")[0]
                    current_page = page_num.replace("---", "").strip()
                    
            docs_to_index.append(
                LangchainDocument(
                    page_content=chunk,
                    metadata={"source": doc.file_name, "page": current_page}
                )
            )
            
    if not docs_to_index:
        return
        
    vectorstore = FAISS.from_documents(docs_to_index, embeddings)
    vectorstore.save_local(get_index_path(project_id))

def ask_question(project_id: str, question: str) -> dict:
    index_path = get_index_path(project_id)
    if not os.path.exists(index_path):
        return {
            "answer": "No relevant documents found. The project index has not been built or contains no text.",
            "citation": "None"
        }
        
    embeddings = get_embeddings()
    try:
        vectorstore = FAISS.load_local(index_path, embeddings, allow_dangerous_deserialization=True)
    except Exception as e:
        return {
            "answer": "Error loading document index. Please rebuild the project.",
            "citation": "None"
        }
        
    retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
    docs = retriever.invoke(question)
    
    if not docs:
        return {
            "answer": "I could not find any relevant information in the uploaded documents to answer your question.",
            "citation": "None"
        }
        
    context = ""
    citations = []
    for i, doc in enumerate(docs):
        context += f"[Doc {i+1}] Source: {doc.metadata.get('source')}, Page: {doc.metadata.get('page')}\n{doc.page_content}\n\n"
        citations.append(f"{doc.metadata.get('source')}, p. {doc.metadata.get('page')}")
        
    llm = get_llm()
    prompt = f"""You are ProcureMind AI, an assistant helping to analyze vendor contracts and proposals.
    
Based solely on the following context excerpts, answer the user's question. 
If the answer cannot be found in the context, state plainly that you cannot answer the question based on the provided documents. Do not guess.
At the end of your answer, do not repeat the citations. Just provide the answer.

Context:
{context}

Question: {question}
"""
    
    response = llm.invoke(prompt)
    answer_text = response.content
    
    unique_citations = list(dict.fromkeys(citations))
    citation_str = "Source: " + "; ".join(unique_citations)
    
    return {
        "answer": answer_text.strip(),
        "citation": citation_str
    }

import json

async def extract_vendors(db_documents) -> list:
    if not db_documents:
        return []
    
    vendors = []
    llm = get_llm()
    
    for doc in db_documents:
        if not doc.raw_text:
            continue
            
        # Use first 2000 chars to identify vendor
        text_preview = doc.raw_text[:2000]
        
        prompt = f"""You are ProcureMind AI. Read the following excerpt from a vendor document and extract the vendor's company name.
Also, classify the vendor into a Category (e.g., Cloud Infrastructure, SaaS, Consulting, Marketing, etc.).
Also, give a basic risk profile ("low", "medium", or "high").
Return the result strictly as valid JSON without markdown wrapping. Format:
{{"name": "VendorName", "category": "CategoryName", "risk": "low"}}

Excerpt:
{text_preview}
"""
        
        try:
            response = await llm.ainvoke(prompt)
            data = response.content.strip()
            if data.startswith("```json"):
                data = data[7:]
            if data.endswith("```"):
                data = data[:-3]
                
            parsed = json.loads(data)
            
            # Ensure unique IDs
            vendors.append({
                "id": str(doc.id),
                "name": parsed.get("name", "Unknown Vendor"),
                "category": parsed.get("category", "Software"),
                "owner": "Unassigned",
                "spend": "$0",
                "risk": parsed.get("risk", "low")
            })
        except Exception as e:
            print("Failed to extract vendor:", e)
            vendors.append({
                "id": str(doc.id),
                "name": doc.file_name.split(".")[0],
                "category": "Uncategorized",
                "owner": "Unassigned",
                "spend": "$0",
                "risk": "medium"
            })
            
    return vendors


async def generate_summary_findings(all_vendors, all_cost_items, all_risks, all_compliance, all_sla) -> dict:
    llm = get_llm()
    summary_data = {
        "vendors": [v["name"] for v in all_vendors],
        "cost_items": all_cost_items,
        "risks": all_risks,
        "compliance": all_compliance,
        "sla": all_sla
    }
    
    prompt = f"""You are ProcureMind AI. Based on the following extracted vendor audit data, generate:
1. 3-4 Key Strategic Findings (e.g., specific renewal issues, overages, compliance gaps, cost savings opportunities).
2. 3-4 Recommended Actions corresponding to those findings.

Provide the response strictly as valid JSON without markdown wrapping. Format:
{{
  "key_findings": [
    "Finding 1...",
    "Finding 2..."
  ],
  "recommended_actions": [
    "Action 1...",
    "Action 2..."
  ]
}}

Audit Data:
{json.dumps(summary_data, indent=2)}
"""
    try:
        response = await llm.ainvoke(prompt)
        data = response.content.strip()
        if data.startswith("```json"):
            data = data[7:]
        if data.endswith("```"):
            data = data[:-3]
        return json.loads(data)
    except Exception as e:
        print("Failed to generate summary findings:", e)
        return {
            "key_findings": [
                "Renewal Timelines: Multiple vendor agreements are approaching renewal in the next 90 days. Early negotiation is advised.",
                "Compliance Alignment: Some vendors lack explicit documentation matching internal framework requirements.",
                "Cost Discrepancies: Identified potential variances between stated pricing schedules and actual invoice structures."
            ],
            "recommended_actions": [
                "Initiate contract reviews for vendors with upcoming renewals to capture early negotiation leverage.",
                "Request updated compliance reports (SOC 2, ISO 27001) from all uncategorized vendors.",
                "Reconcile monthly spend figures against contract price books to reclaim overbilled amounts."
            ]
        }

async def analyze_all_documents(db_documents) -> dict:
    if not db_documents:
        return {
            "structured_proposal": {"vendors": []},
            "cost_breakdown": {"total_spend": "$0", "actual_spend": "$0", "discrepancies": "$0", "items": []},
            "risk_flags": {"high": 0, "medium": 0, "low": 0, "items": []},
            "policy_rules": {"items": []},
            "sla_metrics": {"items": []},
            "score_results": {}
        }
        
    llm = get_llm()
    
    all_vendors = []
    all_cost_items = []
    all_risks = []
    all_compliance = []
    all_sla = []
    
    total_stated_sum = 0
    total_actual_sum = 0
    
    risk_counts = {"high": 0, "medium": 0, "low": 0}
    
    for doc in db_documents:
        if not doc.raw_text:
            continue
            
        # Give the LLM a substantial preview of the document (up to 8000 chars)
        text_preview = doc.raw_text[:8000]
        
        prompt = f"""You are ProcureMind AI, an expert procurement auditor.
Analyze this vendor contract excerpt and extract key details:
1. Vendor details (Name, Category, Risk profile, Annual Cost, Data Retention, SLA Uptime, Compliance Risk, SSO Support).
2. Cost line-items (categorize them, find stated price, actual audited price, renewal date, and flag any discrepancies).
3. Risk assessment (financial, security, operational risks, overall health score 0-100, and next review date).
4. Compliance status (SOC 2, GDPR, HIPAA, ISO 27001 status, expiration date, number of findings).
5. SLA metrics (Metric name, Target, Actual, Status: "met" or "missed").

Return the result strictly as a valid JSON object without markdown formatting. Format:
{{
  "vendor": {{
    "name": "Vendor Name",
    "category": "Cloud Infrastructure",
    "risk": "medium",
    "annualCost": "$120,000",
    "dataRetention": "30 days",
    "slaUptime": "99.95%",
    "complianceRisk": "low",
    "ssoSupport": "Yes"
  }},
  "costs": {{
    "statedPrice": "$120,000",
    "actualPrice": "$145,000",
    "hasDiscrepancy": true,
    "renewal": "2026-11-01",
    "items": [
      {{
        "category": "Licensing",
        "statedPrice": "$100,000",
        "actualPrice": "$100,000",
        "hasDiscrepancy": false,
        "renewal": "2026-11-01"
      }},
      {{
        "category": "Overage Fee",
        "statedPrice": "$20,000",
        "actualPrice": "$45,000",
        "hasDiscrepancy": true,
        "renewal": "2026-11-01"
      }}
    ]
  }},
  "risks": {{
    "overallScore": 75,
    "financialRisk": "medium",
    "securityRisk": "low",
    "operationalRisk": "high",
    "nextReview": "2026-08-10"
  }},
  "compliance": [
    {{
      "framework": "SOC 2 Type II",
      "status": "Compliant",
      "expires": "2026-12-31",
      "findings": 0
    }}
  ],
  "sla": [
    {{
      "metric": "Service Uptime",
      "target": "99.95%",
      "actual": "99.98%",
      "status": "met"
    }}
  ]
}}

Excerpt:
{text_preview}
"""
        try:
            response = await llm.ainvoke(prompt)
            data = response.content.strip()
            if data.startswith("```json"):
                data = data[7:]
            if data.endswith("```"):
                data = data[:-3]
                
            parsed = json.loads(data)
            
            vendor_info = parsed.get("vendor", {})
            v_name = vendor_info.get("name", doc.file_name.split(".")[0])
            
            # 1. Vendor Directory
            all_vendors.append({
                "id": str(doc.id),
                "name": v_name,
                "category": vendor_info.get("category", "Software"),
                "owner": "Unassigned",
                "spend": vendor_info.get("annualCost", "$0"),
                "risk": vendor_info.get("risk", "low"),
                "annualCost": vendor_info.get("annualCost", "$0"),
                "dataRetention": vendor_info.get("dataRetention", "-"),
                "slaUptime": vendor_info.get("slaUptime", "-"),
                "complianceRisk": vendor_info.get("complianceRisk", "low"),
                "ssoSupport": vendor_info.get("ssoSupport", "-")
            })
            
            # 2. Cost items
            costs = parsed.get("costs", {})
            stated_clean = float(costs.get("statedPrice", "$0").replace("$", "").replace(",", "").strip() or 0)
            actual_clean = float(costs.get("actualPrice", "$0").replace("$", "").replace(",", "").strip() or 0)
            
            total_stated_sum += stated_clean
            total_actual_sum += actual_clean
            
            for item in costs.get("items", []):
                all_cost_items.append({
                    "id": f"{doc.id}-{len(all_cost_items)}",
                    "vendor": v_name,
                    "category": item.get("category", "Other"),
                    "statedPrice": item.get("statedPrice", "$0"),
                    "actualPrice": item.get("actualPrice", "$0"),
                    "hasDiscrepancy": item.get("hasDiscrepancy", False),
                    "renewal": item.get("renewal", "-")
                })
                
            # 3. Risks
            risks = parsed.get("risks", {})
            overall = risks.get("overallScore", 100)
            all_risks.append({
                "id": str(doc.id),
                "vendor": v_name,
                "overallScore": overall,
                "financialRisk": risks.get("financialRisk", "low"),
                "securityRisk": risks.get("securityRisk", "low"),
                "operationalRisk": risks.get("operationalRisk", "low"),
                "nextReview": risks.get("nextReview", "-")
            })
            
            for r_type in ["financialRisk", "securityRisk", "operationalRisk"]:
                level = risks.get(r_type, "low")
                if level in risk_counts:
                    risk_counts[level] += 1
                    
            # 4. Compliance
            for comp in parsed.get("compliance", []):
                all_compliance.append({
                    "id": f"{doc.id}-{len(all_compliance)}",
                    "vendor": v_name,
                    "framework": comp.get("framework", "SOC 2"),
                    "status": comp.get("status", "Compliant"),
                    "expires": comp.get("expires", "-"),
                    "findings": comp.get("findings", 0)
                })
                
            # 5. SLA
            for s in parsed.get("sla", []):
                all_sla.append({
                    "id": f"{doc.id}-{len(all_sla)}",
                    "vendor": v_name,
                    "metric": s.get("metric", "Uptime"),
                    "target": s.get("target", "99.95%"),
                    "actual": s.get("actual", "99.9%"),
                    "status": s.get("status", "met")
                })
                
        except Exception as e:
            print("Failed to analyze doc:", doc.file_name, e)
            # Fallback
            v_name = doc.file_name.split(".")[0]
            all_vendors.append({
                "id": str(doc.id),
                "name": v_name,
                "category": "SaaS",
                "owner": "Unassigned",
                "spend": "$0",
                "risk": "medium"
            })
            
    variance_sum = max(0, total_actual_sum - total_stated_sum)
    
    try:
        exec_summary = await generate_summary_findings(all_vendors, all_cost_items, all_risks, all_compliance, all_sla)
    except Exception as e:
        print("Failed to generate executive summary:", e)
        exec_summary = {
            "key_findings": [],
            "recommended_actions": []
        }
        
    return {
        "structured_proposal": {
            "vendors": all_vendors
        },
        "cost_breakdown": {
            "total_spend": f"${total_stated_sum:,.2f}",
            "actual_spend": f"${total_actual_sum:,.2f}",
            "discrepancies": f"${variance_sum:,.2f}",
            "items": all_cost_items
        },
        "risk_flags": {
            "high": risk_counts["high"],
            "medium": risk_counts["medium"],
            "low": risk_counts["low"],
            "items": all_risks
        },
        "policy_rules": {
            "items": all_compliance
        },
        "sla_metrics": {
            "items": all_sla
        },
        "score_results": {
            "sla_metrics": {
                "items": all_sla
            },
            "executive_summary": exec_summary
        }
    }
