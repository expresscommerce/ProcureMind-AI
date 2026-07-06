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

def ask_question(project_id: str, question: str, db=None) -> dict:
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
    
    if not docs and not db:
        return {
            "answer": "I could not find any relevant information in the uploaded documents to answer your question.",
            "citation": "None"
        }
        
    summary_context = ""
    if db is not None:
        try:
            import models
            result = db.query(models.Result).filter_by(project_id=project_id).first()
            if result:
                rec = result.recommendation or {}
                rec_vendor = rec.get("recommended_vendor")
                rec_rationale = rec.get("recommendation_rationale")
                if rec_vendor:
                    summary_context += f"[System Analysis] Recommended Vendor: {rec_vendor}. Rationale: {rec_rationale}.\n"
                scores = rec.get("vendor_scores", [])
                if scores:
                    scores_str = ", ".join([f"{s.get('vendor_name')}: {s.get('weighted_total')}" for s in scores])
                    summary_context += f"[System Analysis] Vendor Scores/Rankings: {scores_str}.\n"
        except Exception as e:
            print(f"Error loading system context for QA: {e}")

    context = ""
    if summary_context:
        context += summary_context + "\n"
        
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
    if not unique_citations and summary_context:
        citation_str = "Source: System Analysis Results"
    else:
        citation_str = "Source: " + "; ".join(unique_citations)
        if summary_context:
            citation_str += "; System Analysis Results"
    
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


async def generate_plain_language(all_cost_items, all_risks, all_compliance, all_sla) -> dict:
    """Generate plain-language explanations for each risk/cost/compliance/SLA item."""
    llm = get_llm()
    items_data = {
        "costs": all_cost_items[:10],  # Limit to avoid token overflow
        "risks": all_risks[:10],
        "compliance": all_compliance[:10],
        "sla": all_sla[:10]
    }
    
    prompt = f"""You are ProcureMind AI. Your job is to translate technical procurement data into plain English that someone who has never seen a vendor proposal would understand.

For each item below, write a clear, specific 1-2 sentence explanation of what it means and why it matters to the buyer. Ground every sentence in the actual values — do not generalize.

Return strictly as valid JSON without markdown wrapping. Format:
{{
  "cost_explanations": [
    {{"id": "item-id", "plain_language": "You'd be paying $X for Y, but the audit found the real cost is $Z — that's $N more than expected."}}
  ],
  "risk_explanations": [
    {{"id": "item-id", "plain_language": "This vendor's financial health score is X/100, meaning there's a real chance they could have trouble meeting obligations."}}
  ],
  "compliance_explanations": [
    {{"id": "item-id", "plain_language": "This vendor's SOC 2 certification expires on X — after that date, you'd have no assurance their security practices are audited."}}
  ],
  "sla_explanations": [
    {{"id": "item-id", "plain_language": "The vendor promised 99.95% uptime but actually delivered 99.8% — that's roughly 8 more hours of downtime per year than agreed."}}
  ]
}}

Data:
{json.dumps(items_data, indent=2)}
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
        print("Failed to generate plain language:", e)
        return {"cost_explanations": [], "risk_explanations": [], "compliance_explanations": [], "sla_explanations": []}


async def generate_timeline_events(all_vendors, all_cost_items, all_risks, all_compliance, db_documents) -> list:
    """TimelineAgent: extract contract timeline events per vendor."""
    llm = get_llm()
    
    doc_texts = {}
    for doc in db_documents:
        if doc.raw_text:
            doc_texts[doc.file_name] = doc.raw_text[:4000]
    
    context = {
        "vendors": [{"name": v["name"], "category": v.get("category", "")} for v in all_vendors],
        "cost_items": all_cost_items[:10],
        "risks": all_risks[:10],
        "compliance": all_compliance[:10],
        "document_excerpts": doc_texts
    }
    
    prompt = f"""You are ProcureMind AI TimelineAgent. Extract contract timeline events for each vendor.

For each vendor, identify key dates and milestones across the contract term. Look for:
1. Go-live / delivery dates
2. Warranty expiration dates
3. Fees that start in later years (e.g. Year-2 maintenance fees)
4. Renewal / auto-renewal windows
5. Price cap expirations
6. Compliance certificate expiration dates
7. Any other time-sensitive contractual events

For each event, classify it as "positive" (protects the buyer) or "negative" (risk to the buyer).
Also provide a plain_language explanation of what happens at that point.

If a contract term is not explicitly stated, assume 3 years from today's date.
Today's date: 2026-07-06.

Return strictly as valid JSON without markdown wrapping. Format:
{{
  "vendors": [
    {{
      "vendor_name": "Vendor A",
      "contract_start": "2026-07-06",
      "contract_end": "2029-07-06",
      "events": [
        {{
          "date": "2026-09-01",
          "label": "Go-live",
          "type": "positive",
          "plain_language": "The vendor's solution goes live in your environment.",
          "source_page": "1"
        }}
      ]
    }}
  ]
}}

Context:
{json.dumps(context, indent=2)}
"""
    try:
        response = await llm.ainvoke(prompt)
        data = response.content.strip()
        if data.startswith("```json"):
            data = data[7:]
        if data.endswith("```"):
            data = data[:-3]
        parsed = json.loads(data)
        return parsed.get("vendors", [])
    except Exception as e:
        print("Failed to generate timeline events:", e)
        return []


async def generate_insight(all_vendors, all_cost_items, all_risks, all_compliance, all_sla) -> dict:
    """InsightAgent: find the single most non-obvious observation."""
    llm = get_llm()
    
    context = {
        "vendors": all_vendors,
        "cost_items": all_cost_items,
        "risks": all_risks,
        "compliance": all_compliance,
        "sla": all_sla
    }
    
    prompt = f"""You are ProcureMind AI InsightAgent. Your ONLY job is to find ONE genuinely non-obvious observation that a sharp human reviewer would catch but that standard cost/risk/compliance analysis might miss.

Look for:
- A mismatch in pricing units or basis between vendors (e.g. one quotes per-seat, another per-active-user)
- An inconsistency between two sections of the same proposal
- An assumption the standard analysis may have missed
- A comparison the raw data enables but nobody computed directly
- Something where the numbers don't add up across vendors when cross-referenced

CRITICAL RULES:
1. Do NOT repeat anything already identified as a risk, cost discrepancy, or compliance issue in the data below.
2. If you genuinely cannot find something new and non-obvious, respond with found=false. Do NOT manufacture a weak insight.
3. Base your insight ONLY on the actual data provided — no speculation or hallucination.

Return strictly as valid JSON without markdown wrapping:
{{
  "found": true,
  "insight": "One clear sentence describing the observation.",
  "explanation": "2-3 sentences explaining why this matters and what the buyer should do about it.",
  "evidence": "The specific data points that support this observation."
}}

OR if nothing genuinely new is found:
{{
  "found": false,
  "insight": "No additional non-obvious issues were found beyond what the standard analysis already covers.",
  "explanation": "The cost, risk, and compliance analyses appear to have captured the key considerations.",
  "evidence": ""
}}

Data:
{json.dumps(context, indent=2)}
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
        print("Failed to generate insight:", e)
        return {"found": False, "insight": "Insight generation encountered an error.", "explanation": "", "evidence": ""}


async def generate_recommendation(all_vendors, all_cost_items, all_risks, all_compliance, all_sla) -> dict:
    """Recommendation Agent: score vendors and produce a recommendation."""
    llm = get_llm()
    
    context = {
        "vendors": all_vendors,
        "cost_items": all_cost_items,
        "risks": all_risks,
        "compliance": all_compliance,
        "sla": all_sla
    }
    
    prompt = f"""You are ProcureMind AI Recommendation Agent. Based on the full analysis data, score each vendor and produce a recommendation.

For each vendor, produce scores (0-100) for these criteria:
- cost: How competitive and transparent is their pricing?
- security: How strong is their security posture and compliance?
- support: How good are their SLA commitments and track record?
- warranty: How comprehensive are their warranty and indemnification terms?
- delivery: How reasonable and reliable are their delivery timelines?

Then recommend the top vendor with a clear justification.

Return strictly as valid JSON without markdown wrapping:
{{
  "vendor_scores": [
    {{
      "vendor_name": "Vendor A",
      "scores": {{
        "cost": 85,
        "security": 90,
        "support": 75,
        "warranty": 80,
        "delivery": 70
      }},
      "weighted_total": 80,
      "rank": 1
    }}
  ],
  "recommended_vendor": "Vendor A",
  "recommendation_rationale": "Vendor A scores highest overall because...",
  "runner_up": "Vendor B",
  "weights_used": {{
    "cost": 30,
    "security": 25,
    "support": 20,
    "warranty": 15,
    "delivery": 10
  }}
}}

Data:
{json.dumps(context, indent=2)}
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
        print("Failed to generate recommendation:", e)
        return {
            "vendor_scores": [],
            "recommended_vendor": "",
            "recommendation_rationale": "Unable to generate recommendation.",
            "runner_up": "",
            "weights_used": {"cost": 30, "security": 25, "support": 20, "warranty": 15, "delivery": 10}
        }


async def generate_red_team(recommendation_data, all_vendors, all_cost_items, all_risks, all_compliance, all_sla) -> dict:
    """RedTeamAgent: argue for the runner-up vendor against the recommendation."""
    llm = get_llm()
    
    runner_up = recommendation_data.get("runner_up", "")
    recommended = recommendation_data.get("recommended_vendor", "")
    
    if not runner_up or not recommended:
        return {
            "runner_up_case": "Not enough vendors to perform red-team analysis.",
            "strongest_point": "",
            "recommendation_response": "",
            "runner_up_vendor": ""
        }
    
    context = {
        "recommendation": recommendation_data,
        "vendors": all_vendors,
        "cost_items": all_cost_items,
        "risks": all_risks,
        "compliance": all_compliance,
        "sla": all_sla
    }
    
    prompt = f"""You are ProcureMind AI RedTeamAgent. Your job is to construct the STRONGEST possible case for choosing {runner_up} over the recommended vendor {recommended}.

Rules:
1. Use ONLY values already present in the data below — do not hallucinate or speculate.
2. Find the areas where {runner_up} genuinely outperforms {recommended}.
3. Identify the strongest single argument for {runner_up}.
4. Be fair but adversarial — your job is to pressure-test the recommendation.

Return strictly as valid JSON without markdown wrapping:
{{
  "runner_up_vendor": "{runner_up}",
  "runner_up_case": "A 2-3 sentence argument for why {runner_up} might be the better choice.",
  "strongest_point": "The single strongest data-backed point in favor of {runner_up}.",
  "areas_where_runner_up_wins": ["Area 1", "Area 2"]
}}

Data:
{json.dumps(context, indent=2)}
"""
    try:
        response = await llm.ainvoke(prompt)
        data = response.content.strip()
        if data.startswith("```json"):
            data = data[7:]
        if data.endswith("```"):
            data = data[:-3]
        red_team = json.loads(data)
    except Exception as e:
        print("Failed to generate red team analysis:", e)
        return {
            "runner_up_case": "Red-team analysis could not be generated.",
            "strongest_point": "",
            "recommendation_response": "",
            "runner_up_vendor": runner_up
        }
    
    # Second pass: recommendation responds to red-team's strongest point
    response_prompt = f"""You are ProcureMind AI Recommendation Agent. The red-team agent argued for {runner_up} over your recommended vendor {recommended}.

Their strongest argument: {red_team.get('strongest_point', 'N/A')}
Full case: {red_team.get('runner_up_case', 'N/A')}

Respond to this challenge. Either:
1. Concede it's a genuine consideration the buyer should weigh, OR
2. Explain why {recommended} still holds despite this point.

Be honest. If the red-team has a valid point, acknowledge it. Use ONLY data from the analysis.

Return strictly as valid JSON without markdown wrapping:
{{
  "response": "Your 2-3 sentence response addressing the red-team's strongest point.",
  "concedes_point": true or false,
  "final_recommendation_stands": true or false
}}

Original recommendation data:
{json.dumps(recommendation_data, indent=2)}
"""
    try:
        resp = await llm.ainvoke(response_prompt)
        resp_data = resp.content.strip()
        if resp_data.startswith("```json"):
            resp_data = resp_data[7:]
        if resp_data.endswith("```"):
            resp_data = resp_data[:-3]
        rec_response = json.loads(resp_data)
        red_team["recommendation_response"] = rec_response.get("response", "")
        red_team["concedes_point"] = rec_response.get("concedes_point", False)
        red_team["final_recommendation_stands"] = rec_response.get("final_recommendation_stands", True)
    except Exception as e:
        print("Failed to generate recommendation response:", e)
        red_team["recommendation_response"] = "Unable to generate response to red-team challenge."
    
    return red_team


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
    
    # Phase 5 agents — run in sequence after core extraction
    try:
        exec_summary = await generate_summary_findings(all_vendors, all_cost_items, all_risks, all_compliance, all_sla)
    except Exception as e:
        print("Failed to generate executive summary:", e)
        exec_summary = {
            "key_findings": [],
            "recommended_actions": []
        }
    
    # Plain language explanations for Simple mode
    try:
        plain_lang = await generate_plain_language(all_cost_items, all_risks, all_compliance, all_sla)
    except Exception as e:
        print("Failed to generate plain language:", e)
        plain_lang = {"cost_explanations": [], "risk_explanations": [], "compliance_explanations": [], "sla_explanations": []}
    
    # Timeline events
    try:
        timeline_events = await generate_timeline_events(all_vendors, all_cost_items, all_risks, all_compliance, db_documents)
    except Exception as e:
        print("Failed to generate timeline events:", e)
        timeline_events = []
    
    # Recommendation
    try:
        recommendation = await generate_recommendation(all_vendors, all_cost_items, all_risks, all_compliance, all_sla)
    except Exception as e:
        print("Failed to generate recommendation:", e)
        recommendation = {"vendor_scores": [], "recommended_vendor": "", "recommendation_rationale": "", "runner_up": "", "weights_used": {}}
    
    # Insight agent
    try:
        insight = await generate_insight(all_vendors, all_cost_items, all_risks, all_compliance, all_sla)
    except Exception as e:
        print("Failed to generate insight:", e)
        insight = {"found": False, "insight": "Insight generation failed.", "explanation": "", "evidence": ""}
    
    # Red-team agent
    try:
        red_team = await generate_red_team(recommendation, all_vendors, all_cost_items, all_risks, all_compliance, all_sla)
    except Exception as e:
        print("Failed to generate red team:", e)
        red_team = {"runner_up_case": "", "strongest_point": "", "recommendation_response": "", "runner_up_vendor": ""}
        
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
        },
        "plain_language": plain_lang,
        "timeline_events": timeline_events,
        "recommendation": recommendation,
        "insight": insight,
        "red_team": red_team
    }
