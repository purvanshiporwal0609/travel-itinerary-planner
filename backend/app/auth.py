from fastapi import Header, HTTPException
from .db import sb


def current_user(authorization: str | None = Header(default=None)) -> str:
    """Validate the Supabase access token and return the user id."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    try:
        res = sb().auth.get_user(authorization[7:])
        return res.user.id
    except Exception as e:
        print("AUTH ERROR:", repr(e))
        raise HTTPException(401, "Invalid or expired token")