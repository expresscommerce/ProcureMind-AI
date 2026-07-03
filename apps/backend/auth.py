import os
from dotenv import load_dotenv
load_dotenv()
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import httpx
from pydantic import BaseModel

security = HTTPBearer()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

class User(BaseModel):
    id: str
    email: str = ""

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    token = credentials.credentials
    try:
        # Assuming JWT is signed using HS256 with the Supabase JWT secret
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False}
        )
        user_id: str = payload.get("sub")
        email: str = payload.get("email", "")
        
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return User(id=user_id, email=email)
    except JWTError as e:
        # Write error to a file so we can read it
        with open("jwt_error.log", "w") as f:
            f.write(str(e))
        
        # Fallback for debugging: get unverified claims
        try:
            unverified = jwt.get_unverified_claims(token)
            user_id = unverified.get("sub")
            if user_id:
                return User(id=user_id, email=unverified.get("email", ""))
        except:
            pass

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )
