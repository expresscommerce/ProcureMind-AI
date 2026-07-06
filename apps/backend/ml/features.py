import re

def extract_numeric_value(s: str, default: float = 0.0) -> float:
    if not s:
        return default
    cleaned = re.sub(r"[^\d.]", "", s)
    try:
        return float(cleaned) if cleaned else default
    except ValueError:
        return default

def get_risk_severity(level: str) -> str:
    level = str(level).strip().lower()
    if level in ["high", "critical", "red"]:
        return "high"
    elif level in ["medium", "moderate", "yellow"]:
        return "medium"
    else:
        return "low"

class FeatureExtractor:
    @staticmethod
    def extract_features(
        vendor_data: dict,
        cost_items: list,
        risk_data: dict,
        compliance_items: list,
        sla_items: list,
        raw_text: str = ""
    ) -> dict:
        text = raw_text or ""
        
        # 1. payment_upfront_pct
        payment_upfront_pct = 0.0
        # Check upfront percentage pattern
        upfront_match = re.search(r"(\d+)\s*%\s*(?:upfront|in advance|deposit|down\s*payment)", text, re.IGNORECASE)
        if upfront_match:
            payment_upfront_pct = float(upfront_match.group(1))
        else:
            # Heuristics based on frequency terms
            if re.search(r"\bannually\b|\bannual payment\b|\bpaid annually\b", text, re.IGNORECASE):
                payment_upfront_pct = 100.0
            elif re.search(r"\bquarterly\b|\bpaid quarterly\b", text, re.IGNORECASE):
                payment_upfront_pct = 25.0
            elif re.search(r"\bmonthly\b|\bpaid monthly\b", text, re.IGNORECASE):
                payment_upfront_pct = 8.33

        # 2. warranty_years
        warranty_years = 0.0
        warranty_match = re.search(r"(\d+)\s*-?\s*year\s+(?:warranty|guarantee)", text, re.IGNORECASE)
        if warranty_match:
            warranty_years = float(warranty_match.group(1))
        elif re.search(r"\bwarranty\b|\bguarantee\b", text, re.IGNORECASE):
            warranty_years = 1.0

        # 3. delivery_days
        delivery_days = 30.0  # standard procurement default
        delivery_match = re.search(r"(\d+)\s*(?:business\s+)?days?\s*(?:delivery|shipment|lead\s*time)", text, re.IGNORECASE)
        if delivery_match:
            delivery_days = float(delivery_match.group(1))

        # 4. sla_uptime_pct
        sla_uptime_pct = 99.0
        sla_uptime_raw = vendor_data.get("slaUptime", "") or ""
        if "%" in sla_uptime_raw:
            sla_uptime_pct = extract_numeric_value(sla_uptime_raw, 99.0)
        else:
            # Look in sla items
            uptime_slas = [s for s in sla_items if "uptime" in str(s.get("metric", "")).lower()]
            if uptime_slas:
                sla_uptime_pct = extract_numeric_value(uptime_slas[0].get("target", ""), 99.0)
        
        # 5. has_penalty_clause
        has_penalty_clause = False
        if re.search(r"\bpenalty\b|\bliquidated damages\b|\bservice credits?\b|\bremedy\b", text, re.IGNORECASE):
            has_penalty_clause = True

        # 6. hidden_cost_ratio
        hidden_cost_ratio = 0.0
        # Calculate from costs
        stated_cost = 0.0
        actual_cost = 0.0
        
        # We can sum up stated and actual costs from the cost items
        vendor_cost_items = [c for c in cost_items if c.get("vendor") == vendor_data.get("name")]
        if vendor_cost_items:
            for item in vendor_cost_items:
                stated_cost += extract_numeric_value(item.get("statedPrice", ""))
                actual_cost += extract_numeric_value(item.get("actualPrice", ""))
        else:
            stated_cost = extract_numeric_value(vendor_data.get("annualCost", ""))
            actual_cost = stated_cost # fallback
            
        if stated_cost > 0:
            hidden_cost_ratio = (actual_cost - stated_cost) / stated_cost
        
        # 7. num_risk_flags_by_severity
        low_risks = 0
        medium_risks = 0
        high_risks = 0
        
        if risk_data:
            for risk_key in ["financialRisk", "securityRisk", "operationalRisk"]:
                val = risk_data.get(risk_key, "low")
                sev = get_risk_severity(val)
                if sev == "high":
                    high_risks += 1
                elif sev == "medium":
                    medium_risks += 1
                else:
                    low_risks += 1

        # 8. compliance_pass_rate
        compliance_pass_rate = 1.0
        vendor_comp_items = [c for c in compliance_items if c.get("vendor") == vendor_data.get("name")]
        if vendor_comp_items:
            passed = sum(1 for c in vendor_comp_items if str(c.get("status", "")).lower() in ["compliant", "pass", "active"])
            compliance_pass_rate = passed / len(vendor_comp_items)

        # 9. proposal_hedge_language_score
        proposal_hedge_language_score = 0.0
        hedge_words = ["approximately", "subject to change", "estimate", "reasonable efforts", 
                       "target", "may vary", "subject to", "anticipate", "conditional", "foreseeable"]
        if text:
            words = text.lower().split()
            word_count = len(words)
            if word_count > 0:
                matches = sum(text.lower().count(hw) for hw in hedge_words)
                proposal_hedge_language_score = (matches / word_count) * 1000.0  # scale it
                proposal_hedge_language_score = min(10.0, proposal_hedge_language_score) # cap at 10.0

        return {
            "payment_upfront_pct": float(payment_upfront_pct),
            "warranty_years": float(warranty_years),
            "delivery_days": float(delivery_days),
            "sla_uptime_pct": float(sla_uptime_pct),
            "has_penalty_clause": bool(has_penalty_clause),
            "hidden_cost_ratio": float(hidden_cost_ratio),
            "num_risk_flags_by_severity_low": int(low_risks),
            "num_risk_flags_by_severity_medium": int(medium_risks),
            "num_risk_flags_by_severity_high": int(high_risks),
            "compliance_pass_rate": float(compliance_pass_rate),
            "proposal_hedge_language_score": float(proposal_hedge_language_score),
        }
