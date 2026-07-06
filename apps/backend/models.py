from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON, Boolean, Integer, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)  # References auth.users(id)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    results = relationship("Result", back_populates="project", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False) # Supabase storage path
    file_type = Column(String)
    raw_text = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="documents")

class Result(Base):
    __tablename__ = "results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    
    # JSONB columns matching §5 data models
    structured_proposal = Column(JSON, default=dict)
    cost_breakdown = Column(JSON, default=dict)
    risk_flags = Column(JSON, default=list)
    policy_rules = Column(JSON, default=list)
    score_results = Column(JSON, default=dict)
    
    # Phase 5 columns
    plain_language = Column(JSON, default=dict)
    timeline_events = Column(JSON, default=list)
    recommendation = Column(JSON, default=dict)
    insight = Column(JSON, default=dict)
    red_team = Column(JSON, default=dict)
    feature_snapshot = Column(JSON, default=dict)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="results")

class ContractOutcome(Base):
    __tablename__ = "contract_outcomes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    vendor_id = Column(String, nullable=False)
    delivered_on_time = Column(Boolean, nullable=True)
    actual_delivery_days = Column(Integer, nullable=True)
    hidden_costs_materialized = Column(Boolean, nullable=True)
    actual_total_cost = Column(Float, nullable=True)
    negotiation_asks_succeeded = Column(JSON, default=dict)
    overall_satisfaction = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    logged_at = Column(DateTime(timezone=True), server_default=func.now())
    logged_by = Column(UUID(as_uuid=True), nullable=False)

class SyntheticTrainingData(Base):
    __tablename__ = "synthetic_training_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_upfront_pct = Column(Float, nullable=False)
    warranty_years = Column(Float, nullable=False)
    delivery_days = Column(Float, nullable=False)
    sla_uptime_pct = Column(Float, nullable=False)
    has_penalty_clause = Column(Boolean, nullable=False)
    hidden_cost_ratio = Column(Float, nullable=False)
    num_risk_flags_by_severity_low = Column(Integer, nullable=False)
    num_risk_flags_by_severity_medium = Column(Integer, nullable=False)
    num_risk_flags_by_severity_high = Column(Integer, nullable=False)
    compliance_pass_rate = Column(Float, nullable=False)
    proposal_hedge_language_score = Column(Float, nullable=False)
    delivered_on_time = Column(Boolean, nullable=False)
    hidden_costs_materialized = Column(Boolean, nullable=False)
    risk_realized_score = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ModelRegistry(Base):
    __tablename__ = "model_registry"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    version = Column(String, nullable=False)
    training_data_size = Column(Integer, nullable=False)
    validation_metrics = Column(JSON, default=dict)
    is_active = Column(Boolean, default=False)
    trained_at = Column(DateTime(timezone=True), server_default=func.now())

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), primary_key=True)
    is_admin = Column(Boolean, default=False, nullable=False)
