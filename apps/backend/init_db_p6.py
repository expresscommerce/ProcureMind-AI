import sys
import os
from sqlalchemy import text

# Add current dir to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db import engine
from models import Base

def init_db():
    print("Initializing Phase 6 database upgrades...")
    
    # 1. Add feature_snapshot column to results if it doesn't exist
    with engine.connect() as conn:
        print("Checking/adding feature_snapshot column to results...")
        conn.execute(text("ALTER TABLE results ADD COLUMN IF NOT EXISTS feature_snapshot JSONB DEFAULT '{}'::jsonb;"))
        conn.commit()
    
    # 2. Create new tables
    print("Creating new tables (contract_outcomes, synthetic_training_data, model_registry)...")
    Base.metadata.create_all(bind=engine)
    print("Database initialization complete.")

if __name__ == "__main__":
    init_db()
