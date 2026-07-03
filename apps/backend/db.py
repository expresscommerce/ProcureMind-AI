import os
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

SUPABASE_DB_URL = os.environ.get("SUPABASE_DB_URL", "postgresql://postgres:postgres@localhost:5432/postgres")

engine = create_engine(SUPABASE_DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
