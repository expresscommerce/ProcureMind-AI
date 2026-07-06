import sys
import os
import pandas as pd
import numpy as np
import joblib
import uuid
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.metrics import accuracy_score, roc_auc_score, mean_absolute_error, r2_score

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import SessionLocal
from models import SyntheticTrainingData, ModelRegistry

def train_cold_start_model():
    db = SessionLocal()
    try:
        # Load synthetic training data
        records = db.query(SyntheticTrainingData).all()
        if not records:
            print("No synthetic training data found in database. Run generate_synthetic.py first.")
            return
        
        data_list = []
        for r in records:
            data_list.append({
                "payment_upfront_pct": r.payment_upfront_pct,
                "warranty_years": r.warranty_years,
                "delivery_days": r.delivery_days,
                "sla_uptime_pct": r.sla_uptime_pct,
                "has_penalty_clause": int(r.has_penalty_clause),
                "hidden_cost_ratio": r.hidden_cost_ratio,
                "num_risk_flags_by_severity_low": r.num_risk_flags_by_severity_low,
                "num_risk_flags_by_severity_medium": r.num_risk_flags_by_severity_medium,
                "num_risk_flags_by_severity_high": r.num_risk_flags_by_severity_high,
                "compliance_pass_rate": r.compliance_pass_rate,
                "proposal_hedge_language_score": r.proposal_hedge_language_score,
                # Targets
                # Note: Target for model is "late_delivery" which is not delivered_on_time
                "late_delivery": 0 if r.delivered_on_time else 1,
                "hidden_costs_materialized": 1 if r.hidden_costs_materialized else 0,
                "risk_realized_score": r.risk_realized_score
            })
            
        df = pd.DataFrame(data_list)
        
        features = [
            "payment_upfront_pct", "warranty_years", "delivery_days", "sla_uptime_pct",
            "has_penalty_clause", "hidden_cost_ratio", "num_risk_flags_by_severity_low",
            "num_risk_flags_by_severity_medium", "num_risk_flags_by_severity_high",
            "compliance_pass_rate", "proposal_hedge_language_score"
        ]
        
        X = df[features]
        y_late = df["late_delivery"]
        y_hidden = df["hidden_costs_materialized"]
        y_risk = df["risk_realized_score"]
        
        # Split into train/validation
        X_train, X_val, y_train_late, y_val_late = train_test_split(X, y_late, test_size=0.2, random_state=42)
        _, _, y_train_hidden, y_val_hidden = train_test_split(X, y_hidden, test_size=0.2, random_state=42)
        _, _, y_train_risk, y_val_risk = train_test_split(X, y_risk, test_size=0.2, random_state=42)
        
        # 1. Train Late Delivery Classifier
        late_model = GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=42)
        late_model.fit(X_train, y_train_late)
        
        # Eval Late Delivery
        late_preds = late_model.predict(X_val)
        late_probs = late_model.predict_proba(X_val)[:, 1]
        late_acc = accuracy_score(y_val_late, late_preds)
        try:
            late_auc = roc_auc_score(y_val_late, late_probs)
        except ValueError:
            late_auc = 0.5
            
        # 2. Train Hidden Costs Classifier
        hidden_model = GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=42)
        hidden_model.fit(X_train, y_train_hidden)
        
        # Eval Hidden Costs
        hidden_preds = hidden_model.predict(X_val)
        hidden_probs = hidden_model.predict_proba(X_val)[:, 1]
        hidden_acc = accuracy_score(y_val_hidden, hidden_preds)
        try:
            hidden_auc = roc_auc_score(y_val_hidden, hidden_probs)
        except ValueError:
            hidden_auc = 0.5
            
        # 3. Train Risk Realized Regressor
        risk_model = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=42)
        risk_model.fit(X_train, y_train_risk)
        
        # Eval Risk Realized
        risk_preds = risk_model.predict(X_val)
        risk_mae = mean_absolute_error(y_val_risk, risk_preds)
        risk_r2 = r2_score(y_val_risk, risk_preds)
        
        # Output Metrics
        metrics = {
            "late_delivery": {
                "accuracy": float(late_acc),
                "auc": float(late_auc)
            },
            "hidden_costs": {
                "accuracy": float(hidden_acc),
                "auc": float(hidden_auc)
            },
            "risk_realized": {
                "mae": float(risk_mae),
                "r2": float(risk_r2)
            }
        }
        
        print("--- Cold-Start Model Validation Metrics ---")
        print(f"Late Delivery AUC: {late_auc:.4f} (Accuracy: {late_acc:.4f})")
        print(f"Hidden Costs AUC: {hidden_auc:.4f} (Accuracy: {hidden_acc:.4f})")
        print(f"Risk Realized Score MAE: {risk_mae:.4f} (R2: {risk_r2:.4f})")
        
        # Save model dictionary artifact
        model_artifact = {
            "late_delivery_model": late_model,
            "hidden_costs_model": hidden_model,
            "risk_realized_model": risk_model,
            "features": features
        }
        
        os.makedirs("ml/artifacts", exist_ok=True)
        artifact_path = "ml/artifacts/risk_model_v0_synthetic.joblib"
        joblib.dump(model_artifact, artifact_path)
        print(f"Saved model artifact to {artifact_path}")
        
        # Log to registry
        # Deactivate any previous active version
        db.query(ModelRegistry).update({ModelRegistry.is_active: False})
        
        registry_entry = ModelRegistry(
            id=uuid.uuid4(),
            version="v0_synthetic",
            training_data_size=len(records),
            validation_metrics=metrics,
            is_active=True
        )
        db.add(registry_entry)
        db.commit()
        print("Logged model version 'v0_synthetic' as active in Model Registry.")
        
        # Save metrics report file
        with open("ml/artifacts/v0_synthetic_metrics.txt", "w") as f:
            f.write("ProcureMind AI Cold-Start Model v0 (Synthetic Training Data)\n")
            f.write("============================================================\n")
            f.write(f"Training samples: {len(records)}\n")
            f.write(f"Validation samples: {len(X_val)}\n\n")
            f.write("Metrics:\n")
            f.write(f"  - Late Delivery Probability Prediction:\n")
            f.write(f"      Accuracy: {late_acc:.4f}\n")
            f.write(f"      AUC:      {late_auc:.4f}\n")
            f.write(f"  - Hidden Costs Materialized Prediction:\n")
            f.write(f"      Accuracy: {hidden_acc:.4f}\n")
            f.write(f"      AUC:      {hidden_auc:.4f}\n")
            f.write(f"  - General Risk Realized Score Prediction (0-10):\n")
            f.write(f"      MAE:      {risk_mae:.4f}\n")
            f.write(f"      R2:       {risk_r2:.4f}\n")
            
    except Exception as e:
        db.rollback()
        print("Error training model:", e)
    finally:
        db.close()

if __name__ == "__main__":
    train_cold_start_model()
