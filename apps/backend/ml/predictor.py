import os
import joblib
import pandas as pd
from sqlalchemy.orm import Session
from models import ModelRegistry, Result

# Path to local artifacts
MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MODEL_PATH = os.path.join(MODEL_DIR, "artifacts", "risk_model_v0_synthetic.joblib")

_cached_model = None
_cached_version = None

def get_predictor_model(db: Session):
    global _cached_model, _cached_version
    
    try:
        # Check active model in registry
        active_model = db.query(ModelRegistry).filter_by(is_active=True).first()
        version = active_model.version if active_model else "v0_synthetic"
        
        # If cached, return cache
        if _cached_model is not None and _cached_version == version:
            return _cached_model, version
            
        # Load from disk
        model_filename = f"risk_model_{version}.joblib"
        model_path = os.path.join(MODEL_DIR, "artifacts", model_filename)
        
        if not os.path.exists(model_path):
            # Fallback to default
            model_path = DEFAULT_MODEL_PATH
            version = "v0_synthetic"
            
        if os.path.exists(model_path):
            print(f"Loading ML model from {model_path}...")
            model_dict = joblib.load(model_path)
            _cached_model = model_dict
            _cached_version = version
            return model_dict, version
        else:
            print("No model artifact found on disk.")
            return None, "none"
    except Exception as e:
        print("Error loading ML model:", e)
        # Try loading default directly as emergency fallback
        try:
            if os.path.exists(DEFAULT_MODEL_PATH):
                model_dict = joblib.load(DEFAULT_MODEL_PATH)
                return model_dict, "v0_synthetic"
        except:
            pass
        return None, "none"

def predict_project_risk(db: Session, result: Result) -> dict:
    if not result:
        return {"model_version": "none", "predictions": {}}
        
    model_dict, version = get_predictor_model(db)
    if not model_dict:
        return {"model_version": "none", "predictions": {}}
        
    feature_snapshot = result.feature_snapshot or {}
    if not feature_snapshot:
        # No features snapshot, return empty
        return {"model_version": version, "predictions": {}}
        
    features_list = model_dict["features"]
    late_model = model_dict["late_delivery_model"]
    hidden_model = model_dict["hidden_costs_model"]
    risk_model = model_dict["risk_realized_model"]
    
    predictions = {}
    
    # Each entry in feature_snapshot represents a vendor
    for vendor_id, v_features in feature_snapshot.items():
        # Ensure all required features are present
        row_dict = {}
        for f in features_list:
            # Cast booleans to int for sklearn
            val = v_features.get(f, 0.0)
            if isinstance(val, bool):
                val = 1 if val else 0
            row_dict[f] = float(val) if val is not None else 0.0
            
        df_row = pd.DataFrame([row_dict])
        
        # Predict probability of late delivery (class 1)
        late_prob = float(late_model.predict_proba(df_row)[0][1])
        
        # Predict probability of hidden costs materializing (class 1)
        hidden_prob = float(hidden_model.predict_proba(df_row)[0][1])
        
        # Predict risk realized score (continuous 0-10)
        risk_score = float(risk_model.predict(df_row)[0])
        risk_score = min(10.0, max(0.0, risk_score))
        
        # Find vendor name
        vendor_name = "Unknown Vendor"
        for v in result.structured_proposal.get("vendors", []):
            if str(v.get("id")) == str(vendor_id):
                vendor_name = v.get("name", "Unknown Vendor")
                break
                
        predictions[vendor_id] = {
            "vendor_name": vendor_name,
            "late_delivery_prob": round(late_prob, 4),
            "hidden_costs_prob": round(hidden_prob, 4),
            "risk_realized_score": round(risk_score, 2)
        }
        
    return {
        "model_version": version,
        "predictions": predictions
    }
