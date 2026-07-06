import sys
import os
import random
import uuid
from sqlalchemy import text

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import SessionLocal
from models import SyntheticTrainingData

def generate_and_insert_synthetic_data(num_samples=250):
    db = SessionLocal()
    try:
        # Check if table already has data
        count = db.query(SyntheticTrainingData).count()
        if count >= num_samples:
            print(f"Synthetic training data table already contains {count} records. Skipping generation.")
            return

        print(f"Generating {num_samples} synthetic training records...")
        random.seed(42)  # For reproducibility

        records = []
        for _ in range(num_samples):
            # Generate plausible features
            payment_upfront_pct = random.choice([0.0, 8.33, 25.0, 50.0, 100.0])
            warranty_years = random.choice([0.0, 1.0, 2.0, 3.0, 5.0])
            delivery_days = random.choice([5.0, 10.0, 15.0, 30.0, 45.0, 60.0])
            sla_uptime_pct = random.choice([95.0, 99.0, 99.9, 99.95, 99.99])
            has_penalty_clause = random.choice([True, False])
            
            # Risk flags
            num_high = random.choice([0, 0, 1, 2])
            num_medium = random.choice([0, 1, 2, 3])
            num_low = random.choice([0, 1, 2, 3, 4])
            
            # Compliance pass rate
            compliance_pass_rate = random.choice([0.5, 0.75, 1.0])
            proposal_hedge_language_score = random.uniform(0.0, 8.0)
            
            # Stated and actual discrepancy heuristic
            hidden_cost_ratio = random.choice([0.0, 0.0, 0.05, 0.1, 0.2, 0.35])

            # --- Heuristics to assign outcomes ---
            # 1. Late Delivery Probability
            late_prob = 0.10  # base
            if payment_upfront_pct >= 50.0:
                late_prob += 0.15
            if not has_penalty_clause:
                late_prob += 0.20
            if delivery_days < 10.0:
                late_prob += 0.15
            if proposal_hedge_language_score > 3.0:
                late_prob += 0.10
            late_prob = min(0.95, max(0.02, late_prob))
            
            delivered_on_time = random.random() > late_prob

            # 2. Hidden Costs Materialized Probability
            hidden_prob = 0.15  # base
            if hidden_cost_ratio > 0.05:
                hidden_prob += 0.35
            if payment_upfront_pct == 100.0:
                hidden_prob += 0.10
            if compliance_pass_rate < 0.8:
                hidden_prob += 0.15
            if num_high > 0:
                hidden_prob += 0.15
            hidden_prob = min(0.95, max(0.05, hidden_prob))

            hidden_costs_materialized = random.random() < hidden_prob

            # 3. Risk Realized Score (continuous, 0.0 to 10.0)
            # Incorporates both probabilities and severe risk flags
            risk_realized_score = (
                (1.0 - float(delivered_on_time)) * 4.0 + 
                float(hidden_costs_materialized) * 4.0 + 
                min(2.0, num_high * 1.0 + num_medium * 0.3)
            )
            # Clip between 0 and 10
            risk_realized_score = min(10.0, max(0.0, risk_realized_score))

            record = SyntheticTrainingData(
                id=uuid.uuid4(),
                payment_upfront_pct=payment_upfront_pct,
                warranty_years=warranty_years,
                delivery_days=delivery_days,
                sla_uptime_pct=sla_uptime_pct,
                has_penalty_clause=has_penalty_clause,
                hidden_cost_ratio=hidden_cost_ratio,
                num_risk_flags_by_severity_low=num_low,
                num_risk_flags_by_severity_medium=num_medium,
                num_risk_flags_by_severity_high=num_high,
                compliance_pass_rate=compliance_pass_rate,
                proposal_hedge_language_score=proposal_hedge_language_score,
                delivered_on_time=delivered_on_time,
                hidden_costs_materialized=hidden_costs_materialized,
                risk_realized_score=risk_realized_score
            )
            records.append(record)

        db.bulk_save_objects(records)
        db.commit()
        print(f"Successfully inserted {len(records)} synthetic training records.")
    except Exception as e:
        db.rollback()
        print("Error generating synthetic data:", e)
    finally:
        db.close()

if __name__ == "__main__":
    generate_and_insert_synthetic_data()
