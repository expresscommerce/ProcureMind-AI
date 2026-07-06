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
from models import ContractOutcome, Result, ModelRegistry

MIN_RETRAIN_THRESHOLD = 50

def retrain_model_from_real_data(force=False) -> dict:
    db = SessionLocal()
    try:
        # 1. Fetch real outcomes joined with feature snapshots
        outcomes = db.query(ContractOutcome).all()
        logged_count = len(outcomes)
        print(f"Retraining pipeline started. Real outcomes logged so far: {logged_count}")
        
        if logged_count < MIN_RETRAIN_THRESHOLD and not force:
            status = f"Threshold not met. Minimum {MIN_RETRAIN_THRESHOLD} real outcomes required, but only {logged_count} have been logged."
            print(status)
            return {"status": "error", "message": status, "logged_count": logged_count, "threshold": MIN_RETRAIN_THRESHOLD}
            
        # Parse feature snapshots and targets
        data_list = []
        features_list = [
            "payment_upfront_pct", "warranty_years", "delivery_days", "sla_uptime_pct",
            "has_penalty_clause", "hidden_cost_ratio", "num_risk_flags_by_severity_low",
            "num_risk_flags_by_severity_medium", "num_risk_flags_by_severity_high",
            "compliance_pass_rate", "proposal_hedge_language_score"
        ]
        
        for outcome in outcomes:
            # Find the corresponding result feature snapshot for this vendor
            result = db.query(Result).filter_by(project_id=outcome.project_id).first()
            if not result or not result.feature_snapshot:
                continue
            
            v_features = result.feature_snapshot.get(str(outcome.vendor_id))
            if not v_features:
                # Fallback: check if we can key by name or raw vendor string
                continue
                
            row = {}
            for f in features_list:
                val = v_features.get(f, 0.0)
                if isinstance(val, bool):
                    val = 1 if val else 0
                row[f] = float(val) if val is not None else 0.0
                
            # Add targets
            # Predict late delivery: 1 if delivered_on_time is False, 0 if True
            row["late_delivery"] = 1 if outcome.delivered_on_time == False else 0
            row["hidden_costs_materialized"] = 1 if outcome.hidden_costs_materialized == True else 0
            
            # For risk score, construct a continuous value or use overall satisfaction
            # We can use overall satisfaction (inverted) + late/hidden cost occurrences:
            # General Risk Realized = (6 - overall_satisfaction) + (1.0 - on_time) * 3.0 + hidden * 3.0
            satisfaction = outcome.overall_satisfaction or 3
            risk_realized = (6 - satisfaction) + (1.0 - float(outcome.delivered_on_time or True)) * 3.0 + float(outcome.hidden_costs_materialized or False) * 3.0
            row["risk_realized_score"] = min(10.0, max(0.0, risk_realized))
            
            data_list.append(row)
            
        if len(data_list) < MIN_RETRAIN_THRESHOLD and not force:
            status = f"Insufficient features snapshots. Only {len(data_list)} valid feature outcomes resolved."
            print(status)
            return {"status": "error", "message": status, "logged_count": len(data_list), "threshold": MIN_RETRAIN_THRESHOLD}

        df = pd.DataFrame(data_list)
        X = df[features_list]
        y_late = df["late_delivery"]
        y_hidden = df["hidden_costs_materialized"]
        y_risk = df["risk_realized_score"]
        
        # Split into train/validation
        X_train, X_val, y_train_late, y_val_late = train_test_split(X, y_late, test_size=0.2, random_state=42)
        _, _, y_train_hidden, y_val_hidden = train_test_split(X, y_hidden, test_size=0.2, random_state=42)
        _, _, y_train_risk, y_val_risk = train_test_split(X, y_risk, test_size=0.2, random_state=42)
        
        # Train classifiers and regressor
        late_model = GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=42)
        late_model.fit(X_train, y_train_late)
        
        hidden_model = GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=42)
        hidden_model.fit(X_train, y_train_hidden)
        
        risk_model = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=42)
        risk_model.fit(X_train, y_train_risk)
        
        # Validation Metrics
        late_preds = late_model.predict(X_val)
        late_probs = late_model.predict_proba(X_val)[:, 1]
        late_acc = accuracy_score(y_val_late, late_preds)
        try:
            late_auc = roc_auc_score(y_val_late, late_probs)
        except ValueError:
            late_auc = 0.5
            
        hidden_preds = hidden_model.predict(X_val)
        hidden_probs = hidden_model.predict_proba(X_val)[:, 1]
        hidden_acc = accuracy_score(y_val_hidden, hidden_preds)
        try:
            hidden_auc = roc_auc_score(y_val_hidden, hidden_probs)
        except ValueError:
            hidden_auc = 0.5
            
        risk_preds = risk_model.predict(X_val)
        risk_mae = mean_absolute_error(y_val_risk, risk_preds)
        risk_r2 = r2_score(y_val_risk, risk_preds)
        
        new_metrics = {
            "late_delivery": {"accuracy": float(late_acc), "auc": float(late_auc)},
            "hidden_costs": {"accuracy": float(hidden_acc), "auc": float(hidden_auc)},
            "risk_realized": {"mae": float(risk_mae), "r2": float(risk_r2)}
        }
        
        # Model Registry Comparison
        # Fetch current active model metrics
        active_model = db.query(ModelRegistry).filter_by(is_active=True).first()
        should_promote = True
        
        if active_model and active_model.version.startswith("v") and not active_model.version.endswith("synthetic"):
            # Compare metrics on validation set
            # For simplicity, promote if general risk MAE is lower or AUC is higher
            old_metrics = active_model.validation_metrics or {}
            old_mae = old_metrics.get("risk_realized", {}).get("mae", 999.0)
            if risk_mae > old_mae:
                should_promote = False
                print(f"New model MAE ({risk_mae:.4f}) is worse than current active model MAE ({old_mae:.4f}). Skipping promotion.")
                
        if should_promote:
            # Create version name
            version_num = 1
            all_real_models = db.query(ModelRegistry).filter(ModelRegistry.version.like("v%_real")).all()
            if all_real_models:
                version_num = len(all_real_models) + 1
                
            new_version = f"v{version_num}_real"
            
            # Save artifact
            model_artifact = {
                "late_delivery_model": late_model,
                "hidden_costs_model": hidden_model,
                "risk_realized_model": risk_model,
                "features": features_list
            }
            
            MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
            artifact_path = os.path.join(MODEL_DIR, "artifacts", f"risk_model_{new_version}.joblib")
            joblib.dump(model_artifact, artifact_path)
            
            # Deactivate previous active models
            db.query(ModelRegistry).update({ModelRegistry.is_active: False})
            
            # Register new model
            registry_entry = ModelRegistry(
                id=uuid.uuid4(),
                version=new_version,
                training_data_size=len(data_list),
                validation_metrics=new_metrics,
                is_active=True
            )
            db.add(registry_entry)
            db.commit()
            
            msg = f"Successfully trained and promoted new real-data model version '{new_version}'."
            print(msg)
            return {"status": "success", "message": msg, "version": new_version, "metrics": new_metrics}
        else:
            return {"status": "skipped", "message": "Model not promoted (metrics did not improve).", "metrics": new_metrics}
            
    except Exception as e:
        db.rollback()
        print("Error in retraining pipeline:", e)
        return {"status": "error", "message": str(e)}
    finally:
        db.close()

if __name__ == "__main__":
    retrain_model_from_real_data()
