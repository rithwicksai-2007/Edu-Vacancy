import csv
import io
import logging
import os
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any
from urllib.parse import urlparse
from uuid import UUID

import httpx
import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient, PyJWKClientConnectionError, PyJWKClientError
from postgrest.exceptions import APIError
from storage3.exceptions import StorageApiError
from supabase_auth.errors import AuthApiError
from supabase import create_client

from .schemas import (
    AccountStatusUpdate,
    AdminNotificationCreate,
    AdminVacancyUpdate,
    ApplicationCreate,
    ApplicationUpdate,
    AuditEntry,
    ComplaintCreate,
    ComplaintUpdate,
    ConnectionCreate,
    ConnectionUpdate,
    InstitutionDetailsUpdate,
    InstitutionRegistration,
    JobSeekerRegistration,
    JobSeekerDetailsUpdate,
    PreferencesUpdate,
    ProfileUpdate,
    VacancyCreate,
    VacancyUpdate,
)

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)
SYNTHETIC_EMAIL_DOMAIN = "users.eduvacancy.invalid"


def username_auth_email(username: str) -> str:
    return f"{username.strip().lower()}@{SYNTHETIC_EMAIL_DOMAIN}"


class Settings:
    def __init__(self) -> None:
        self.supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")

        self.supabase_service_role_key = os.getenv(
            "SUPABASE_SERVICE_ROLE_KEY", ""
        ).strip()

        self.supabase_jwt_secret = os.getenv(
            "SUPABASE_JWT_SECRET", ""
            ).strip()

        self.admin_user_id = os.getenv("ADMIN_USER_ID", "").strip()

        configured_origins = os.getenv("FRONTEND_ORIGINS")
        self.frontend_origins = (
            [
                origin.strip()
                for origin in configured_origins.split(",")
                if origin.strip()
            ]
            if configured_origins is not None
            else ["http://localhost:5173", "http://127.0.0.1:5173"]
        )

    @property
    def issuer(self) -> str:
        return f"{self.supabase_url}/auth/v1"

    @property
    def admin_user_uuid(self) -> UUID | None:
        try:
            return UUID(self.admin_user_id)
        except ValueError:
            return None

    @property
    def supabase_configuration_error(self) -> str | None:
        if not self.supabase_url:
            return "Set SUPABASE_URL in Backend/.env."

        parsed_url = urlparse(self.supabase_url)
        if (
            parsed_url.scheme not in {"http", "https"}
            or not parsed_url.hostname
            or "your-project" in parsed_url.hostname.lower()
        ):
            return "Set SUPABASE_URL to the URL of your Supabase project."

        service_key = self.supabase_service_role_key.lower()
        if service_key.startswith("sb_publishable_"):
            return (
                "SUPABASE_SERVICE_ROLE_KEY is a publishable browser key. Set it "
                "to a server-side service_role JWT or sb_secret_ key from this "
                "project's Supabase API settings."
            )
        if not (
            service_key.startswith("eyj")
            or service_key.startswith("sb_secret_")
        ):
            return (
                "Set SUPABASE_SERVICE_ROLE_KEY in Backend/.env to a server-side "
                "service_role JWT or sb_secret_ key from this Supabase project."
            )
        return None

    @property
    def supabase_configured(self) -> bool:
        return self.supabase_configuration_error is None


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_supabase_client() -> Any:
    settings = get_settings()
    if not settings.supabase_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=settings.supabase_configuration_error,
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def execute_response(query: Any) -> Any:
    try:
        response = query.execute()
    except APIError as error:
        logger.error("Supabase rejected an API request: %s", error.code)
        if error.message and error.message.lower() == "unregistered api key":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Supabase rejected the configured server key. Set "
                    "SUPABASE_SERVICE_ROLE_KEY in Backend/.env to a valid key "
                    "for the configured project, then restart the backend."
                ),
            ) from error
        if error.code in {"PGRST204", "PGRST205", "42P01", "42703"}:
            detail = (
                "The Supabase database schema is missing or out of date. "
                "Run Backend/supabase/schema.sql in the Supabase SQL Editor, "
                "then try again."
            )
        else:
            detail = "The database request failed."
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        ) from error
    except httpx.HTTPError as error:
        logger.error("Supabase could not be reached: %s", type(error).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The database service is temporarily unavailable.",
        ) from error
    return response


def execute(query: Any) -> list[dict[str, Any]]:
    return execute_response(query).data or []


def count_rows(query: Any) -> int:
    return int(execute_response(query).count or 0)


def first_row(query: Any) -> dict[str, Any] | None:
    rows = execute(query.limit(1))
    return rows[0] if rows else None


def get_user_claims(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A Supabase access token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    settings = get_settings()
    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Set SUPABASE_URL before using authenticated endpoints.",
        )

    token = credentials.credentials
    try:
        algorithm = jwt.get_unverified_header(token).get("alg")
        if algorithm == "HS256":
            if not settings.supabase_jwt_secret:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Set SUPABASE_JWT_SECRET to validate legacy HS256 access tokens.",
                )
            key: Any = settings.supabase_jwt_secret
            algorithms = ["HS256"]
        else:
            signing_key = PyJWKClient(
                f"{settings.supabase_url}/auth/v1/.well-known/jwks.json",
                cache_jwk_set=True,
                lifespan=300,
            ).get_signing_key_from_jwt(token)
            key = signing_key.key
            algorithms = [signing_key.algorithm_name]
        claims = jwt.decode(
            token,
            key,
            algorithms=algorithms,
            audience="authenticated",
            issuer=settings.issuer,
            options={"require": ["exp", "sub"]},
        )
    except HTTPException:
        raise
    except PyJWKClientConnectionError as error:
        logger.error("Supabase signing keys could not be fetched.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase token verification is temporarily unavailable.",
        ) from error
    except jwt.InvalidIssuerError as error:
        logger.warning(
            "Rejected Supabase access token with an issuer that does not match the configured project."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "This access token belongs to a different Supabase project. "
                "Set SUPABASE_URL in Backend/.env to the same project URL as "
                "VITE_SUPABASE_URL in .env, restart the backend, and sign in again."
            ),
            headers={"WWW-Authenticate": "Bearer"},
        ) from error
    except jwt.InvalidSignatureError as error:
        logger.warning("Rejected Supabase access token with an invalid signature.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "The access token signature is invalid for this Supabase project. "
                "Confirm Backend/.env SUPABASE_URL matches the frontend project; "
                "if the project uses legacy HS256 tokens, also set its "
                "SUPABASE_JWT_SECRET."
            ),
            headers={"WWW-Authenticate": "Bearer"},
        ) from error
    except jwt.ExpiredSignatureError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The access token has expired. Sign out and sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error
    except (PyJWKClientError, jwt.PyJWTError, ValueError) as error:
        logger.warning(
            "Rejected invalid Supabase access token (%s).", type(error).__name__
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The access token is invalid or expired.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    if not isinstance(claims.get("sub"), str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The access token has no valid user identity.",
        )
    return claims


def require_admin(claims: dict[str, Any]) -> None:
    settings = get_settings()
    if settings.admin_user_uuid is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Administrator access is disabled. Set ADMIN_USER_ID in "
                "Backend/.env to the authorized Supabase Auth user UUID."
            ),
        )

    app_metadata = claims.get("app_metadata")
    if (
        not isinstance(app_metadata, dict)
        or app_metadata.get("platform_role") != "admin"
        or claims.get("sub") != str(settings.admin_user_uuid)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access is required.",
        )


def get_profile(user_id: str, db: Any) -> dict[str, Any]:
    profile = first_row(
        db.table("profiles")
        .select(
            "id,role,username,full_name,phone,status,status_reason,created_at"
        )
        .eq("id", user_id)
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The account profile has not been created.",
        )
    return profile


def require_profile_role(
    claims: dict[str, Any], db: Any, expected_role: str, verified: bool = False
) -> dict[str, Any]:
    profile = get_profile(claims["sub"], db)
    if profile["role"] != expected_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"A {expected_role.replace('_', ' ')} account is required.",
        )
    if profile["status"] == "Suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is suspended.",
        )
    if verified and profile["status"] != "Verified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account must be verified before using this feature.",
        )
    return profile


def require_active_profile(claims: dict[str, Any], db: Any) -> dict[str, Any]:
    profile = get_profile(claims["sub"], db)
    if profile["status"] == "Suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is suspended.",
        )
    return profile


def record_audit(
    db: Any,
    actor_id: str,
    action: str,
    target_type: str,
    target_id: str,
    details: dict[str, Any] | None = None,
) -> None:
    entry = AuditEntry(
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details or {},
    )
    execute(db.table("audit_log").insert(entry.model_dump(mode="json")))


def page_query(query: Any, offset: int, limit: int) -> Any:
    return query.range(offset, offset + limit - 1)


app = FastAPI(
    title="EduVacancy API",
    description="Supabase-backed API for accounts, recruitment, and administration.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().frontend_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "apikey"],
)


@app.get("/", tags=["service"])
def read_root() -> dict[str, str]:
    return {"name": "EduVacancy API", "status": "running"}


@app.get("/health", tags=["service"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready", tags=["service"])
def readiness_check() -> dict[str, str]:
    settings = get_settings()
    if not settings.supabase_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=settings.supabase_configuration_error,
        )
    return {"status": "ready"}


def create_username_account(
    username: str,
    password: str,
    role: str,
    metadata: dict[str, Any],
    db: Any,
) -> dict[str, str]:
    existing = first_row(
        db.table("profiles").select("id").eq("username", username)
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That username is already in use.",
        )

    try:
        result = get_supabase_client().auth.admin.create_user(
            {
                "email": username_auth_email(username),
                "password": password,
                "email_confirm": True,
                "user_metadata": {"role": role, "username": username, **metadata},
            }
        )
    except AuthApiError as error:
        if error.code in {"user_already_exists", "email_exists"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That username is already in use.",
            ) from error
        logger.error("Supabase could not create a username account: %s", error.code)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The account could not be created. Please try again.",
        ) from error
    except httpx.HTTPError as error:
        logger.error("Supabase Auth could not be reached: %s", type(error).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The account service is temporarily unavailable.",
        ) from error

    return {"id": result.user.id, "username": username}


@app.post(
    "/api/v1/auth/register/job-seeker",
    status_code=status.HTTP_201_CREATED,
    tags=["authentication"],
)
def register_job_seeker(
    payload: JobSeekerRegistration,
    db: Any = Depends(get_supabase_client),
) -> dict[str, str]:
    metadata = payload.model_dump(exclude={"username", "password", "security_answer_hash"})
    metadata["security_answer_hash"] = payload.security_answer_hash
    return create_username_account(
        payload.username,
        payload.password,
        "job_seeker",
        metadata,
        db,
    )


@app.post(
    "/api/v1/auth/register/institution",
    status_code=status.HTTP_201_CREATED,
    tags=["authentication"],
)
def register_institution(
    payload: InstitutionRegistration,
    db: Any = Depends(get_supabase_client),
) -> dict[str, str]:
    metadata = payload.model_dump(exclude={"username", "password", "security_answer_hash"})
    metadata["security_answer_hash"] = payload.security_answer_hash
    return create_username_account(
        payload.username,
        payload.password,
        "institution",
        metadata,
        db,
    )


@app.get("/api/v1/auth/me", tags=["authentication"])
def read_current_user(
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    profile = get_profile(claims["sub"], db)
    is_authorized_admin = (
        get_settings().admin_user_uuid is not None
        and claims.get("sub") == str(get_settings().admin_user_uuid)
        and (claims.get("app_metadata") or {}).get("platform_role") == "admin"
    )
    return {
        "id": claims["sub"],
        "username": profile["username"],
        "platform_role": "admin" if is_authorized_admin else None,
        "profile": profile,
    }


@app.get("/api/v1/profiles/me", tags=["profiles"])
def read_my_profile(
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    profile = get_profile(claims["sub"], db)
    details_table = (
        "job_seeker_details"
        if profile["role"] == "job_seeker"
        else "institution_details"
    )
    details = first_row(
        db.table(details_table).select("*").eq("id", claims["sub"])
    )
    return {"profile": profile, "details": details}


@app.patch("/api/v1/profiles/me", tags=["profiles"])
def update_my_profile(
    payload: ProfileUpdate,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_active_profile(claims, db)
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide at least one profile field.")
    return first_row(
        db.table("profiles")
        .update(changes)
        .eq("id", claims["sub"])
        .select("id,role,username,full_name,phone,status,status_reason,created_at")
    ) or {}


@app.get("/api/v1/profiles/me/preferences", tags=["profiles"])
def read_my_preferences(
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_active_profile(claims, db)
    row = first_row(
        db.table("account_preferences")
        .select("preferences")
        .eq("profile_id", claims["sub"])
    )
    return {"preferences": row["preferences"] if row else {}}


@app.put("/api/v1/profiles/me/preferences", tags=["profiles"])
def update_my_preferences(
    payload: PreferencesUpdate,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_active_profile(claims, db)
    row = first_row(
        db.table("account_preferences")
        .upsert(
            {"profile_id": claims["sub"], "preferences": payload.preferences},
            on_conflict="profile_id",
        )
        .select("preferences")
    )
    return {"preferences": row["preferences"] if row else {}}


@app.get("/api/v1/notifications/mine", tags=["notifications"])
def read_my_notifications(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> list[dict[str, Any]]:
    require_active_profile(claims, db)
    return execute(
        page_query(
            db.table("notifications")
            .select("id,title,message,created_at,read_at")
            .eq("recipient_id", claims["sub"])
            .order("created_at", desc=True),
            offset,
            limit,
        )
    )


@app.patch("/api/v1/notifications/{notification_id}/read", tags=["notifications"])
def mark_notification_read(
    notification_id: UUID,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_active_profile(claims, db)
    notification = first_row(
        db.table("notifications")
        .update({"read_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", str(notification_id))
        .eq("recipient_id", claims["sub"])
        .select("id,title,message,created_at,read_at")
    )
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return notification


@app.patch("/api/v1/profiles/me/job-seeker", tags=["profiles"])
def update_job_seeker_details(
    payload: JobSeekerDetailsUpdate,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_profile_role(claims, db, "job_seeker")
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide at least one detail field.")
    return first_row(
        db.table("job_seeker_details")
        .update(changes)
        .eq("id", claims["sub"])
        .select("*")
    ) or {}


@app.patch("/api/v1/profiles/me/institution", tags=["profiles"])
def update_institution_details(
    payload: InstitutionDetailsUpdate,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_profile_role(claims, db, "institution", verified=True)
    changes = payload.model_dump(exclude_unset=True, exclude_none=True, mode="json")
    if not changes:
        raise HTTPException(status_code=422, detail="Provide at least one detail field.")
    return first_row(
        db.table("institution_details")
        .update(changes)
        .eq("id", claims["sub"])
        .select("*")
    ) or {}


@app.get("/api/v1/directory/job-seekers", tags=["directory"])
def list_job_seekers(
    q: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> list[dict[str, Any]]:
    require_profile_role(claims, db, "institution", verified=True)
    query = (
        db.table("profiles")
        .select("id,full_name,job_seeker_details(subject,qualification,years_experience,preferred_location)")
        .eq("role", "job_seeker")
        .eq("status", "Verified")
    )
    if q:
        query = query.ilike("full_name", f"%{q}%")
    return execute(page_query(query.order("created_at", desc=True), offset, limit))


@app.get("/api/v1/vacancies", tags=["vacancies"])
def list_vacancies(
    q: str | None = Query(default=None, max_length=100),
    location: str | None = Query(default=None, max_length=160),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Any = Depends(get_supabase_client),
) -> list[dict[str, Any]]:
    query = (
        db.table("vacancies")
        .select("*,institution:profiles!vacancies_institution_id_fkey(full_name,status)")
        .eq("status", "Verified")
        .eq("institution.status", "Verified")
    )
    if q:
        query = query.ilike("title", f"%{q}%")
    if location:
        query = query.ilike("location", f"%{location}%")
    return execute(page_query(query.order("created_at", desc=True), offset, limit))


@app.get("/api/v1/vacancies/mine", tags=["vacancies"])
def list_my_vacancies(
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> list[dict[str, Any]]:
    require_profile_role(claims, db, "institution")
    return execute(
        db.table("vacancies")
        .select("*")
        .eq("institution_id", claims["sub"])
        .order("created_at", desc=True)
    )


@app.get("/api/v1/saved-vacancies/mine", tags=["vacancies"])
def list_my_saved_vacancies(
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> list[dict[str, Any]]:
    require_profile_role(claims, db, "job_seeker")
    return execute(
        db.table("saved_vacancies")
        .select("vacancy_id")
        .eq("job_seeker_id", claims["sub"])
        .order("created_at", desc=True)
    )


@app.post(
    "/api/v1/saved-vacancies/{vacancy_id}",
    status_code=status.HTTP_201_CREATED,
    tags=["vacancies"],
)
def save_vacancy(
    vacancy_id: UUID,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_profile_role(claims, db, "job_seeker")
    vacancy = first_row(
        db.table("vacancies")
        .select("id,status,institution:profiles!vacancies_institution_id_fkey(status)")
        .eq("id", str(vacancy_id))
        .eq("status", "Verified")
    )
    if vacancy is None or vacancy["institution"]["status"] != "Verified":
        raise HTTPException(status_code=404, detail="The vacancy is not available.")
    return first_row(
        db.table("saved_vacancies")
        .upsert(
            {"job_seeker_id": claims["sub"], "vacancy_id": str(vacancy_id)},
            on_conflict="job_seeker_id,vacancy_id",
        )
        .select("*")
    ) or {}


@app.delete(
    "/api/v1/saved-vacancies/{vacancy_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["vacancies"],
)
def unsave_vacancy(
    vacancy_id: UUID,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> None:
    require_profile_role(claims, db, "job_seeker")
    execute_response(
        db.table("saved_vacancies")
        .delete()
        .eq("job_seeker_id", claims["sub"])
        .eq("vacancy_id", str(vacancy_id))
    )


@app.get("/api/v1/saved-teachers/mine", tags=["directory"])
def list_my_saved_teachers(
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> list[dict[str, Any]]:
    require_profile_role(claims, db, "institution")
    return execute(
        db.table("saved_teachers")
        .select("job_seeker_id")
        .eq("institution_id", claims["sub"])
        .order("created_at", desc=True)
    )


@app.post(
    "/api/v1/saved-teachers/{job_seeker_id}",
    status_code=status.HTTP_201_CREATED,
    tags=["directory"],
)
def save_teacher(
    job_seeker_id: UUID,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_profile_role(claims, db, "institution", verified=True)
    teacher = get_profile(str(job_seeker_id), db)
    if teacher["role"] != "job_seeker" or teacher["status"] != "Verified":
        raise HTTPException(status_code=404, detail="The verified teacher was not found.")
    return first_row(
        db.table("saved_teachers")
        .upsert(
            {"institution_id": claims["sub"], "job_seeker_id": str(job_seeker_id)},
            on_conflict="institution_id,job_seeker_id",
        )
        .select("*")
    ) or {}


@app.delete(
    "/api/v1/saved-teachers/{job_seeker_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["directory"],
)
def unsave_teacher(
    job_seeker_id: UUID,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> None:
    require_profile_role(claims, db, "institution")
    execute_response(
        db.table("saved_teachers")
        .delete()
        .eq("institution_id", claims["sub"])
        .eq("job_seeker_id", str(job_seeker_id))
    )


@app.post("/api/v1/vacancies", status_code=status.HTTP_201_CREATED, tags=["vacancies"])
def create_vacancy(
    payload: VacancyCreate,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_profile_role(claims, db, "institution", verified=True)
    if (
        payload.salary_min is not None
        and payload.salary_max is not None
        and payload.salary_min > payload.salary_max
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="salary_min cannot exceed salary_max.",
        )
    row = {
        **payload.model_dump(mode="json"),
        "institution_id": claims["sub"],
        "status": "Pending",
    }
    return first_row(db.table("vacancies").insert(row).select("*")) or {}


@app.patch("/api/v1/vacancies/{vacancy_id}", tags=["vacancies"])
def update_my_vacancy(
    vacancy_id: UUID,
    payload: VacancyUpdate,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_profile_role(claims, db, "institution")
    changes = payload.model_dump(exclude_unset=True, exclude_none=True, mode="json")
    if not changes:
        raise HTTPException(status_code=422, detail="Provide at least one vacancy field.")
    if (
        changes.get("salary_min") is not None
        and changes.get("salary_max") is not None
        and changes["salary_min"] > changes["salary_max"]
    ):
        raise HTTPException(status_code=422, detail="salary_min cannot exceed salary_max.")
    return first_row(
        db.table("vacancies")
        .update(changes)
        .eq("id", str(vacancy_id))
        .eq("institution_id", claims["sub"])
        .select("*")
    ) or {}


@app.post(
    "/api/v1/vacancies/{vacancy_id}/applications",
    status_code=status.HTTP_201_CREATED,
    tags=["applications"],
)
def apply_to_vacancy(
    vacancy_id: UUID,
    payload: ApplicationCreate,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_profile_role(claims, db, "job_seeker", verified=True)
    vacancy = first_row(
        db.table("vacancies")
        .select("id,status,institution:profiles!vacancies_institution_id_fkey(status)")
        .eq("id", str(vacancy_id))
        .eq("status", "Verified")
    )
    if vacancy is None or vacancy["institution"]["status"] != "Verified":
        raise HTTPException(status_code=404, detail="The vacancy is not available.")
    existing = first_row(
        db.table("applications")
        .select("id")
        .eq("vacancy_id", str(vacancy_id))
        .eq("applicant_id", claims["sub"])
    )
    if existing:
        raise HTTPException(status_code=409, detail="You have already applied to this vacancy.")
    return first_row(
        db.table("applications")
        .insert(
            {
                "vacancy_id": str(vacancy_id),
                "applicant_id": claims["sub"],
                "cover_letter": payload.cover_letter,
                "status": "Applied",
            }
        )
        .select("*")
    ) or {}


@app.get("/api/v1/applications/mine", tags=["applications"])
def list_my_applications(
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> list[dict[str, Any]]:
    profile = require_active_profile(claims, db)
    if profile["role"] == "job_seeker":
        return execute(
            db.table("applications")
            .select("*,vacancy:vacancies(*)")
            .eq("applicant_id", claims["sub"])
            .order("created_at", desc=True)
        )
    if profile["role"] == "institution":
        return execute(
            db.table("applications")
            .select(
                "*,vacancy:vacancies!inner(*),"
                "applicant:profiles!applications_applicant_id_fkey("
                "id,full_name,username,phone,job_seeker_details(subject,qualification,years_experience))"
            )
            .eq("vacancy.institution_id", claims["sub"])
            .order("created_at", desc=True)
        )
    raise HTTPException(status_code=403, detail="This account cannot view applications.")


@app.patch("/api/v1/applications/{application_id}", tags=["applications"])
def update_application(
    application_id: UUID,
    payload: ApplicationUpdate,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_profile_role(claims, db, "institution")
    application = first_row(
        db.table("applications")
        .select("id,vacancy:vacancies!inner(institution_id)")
        .eq("id", str(application_id))
        .eq("vacancy.institution_id", claims["sub"])
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    return first_row(
        db.table("applications")
        .update({"status": payload.status})
        .eq("id", str(application_id))
        .select("*")
    ) or {}


@app.post("/api/v1/connections", status_code=status.HTTP_201_CREATED, tags=["connections"])
def create_connection(
    payload: ConnectionCreate,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    requester = require_active_profile(claims, db)
    other = get_profile(str(payload.other_user_id), db)
    if requester["status"] != "Verified" or other["status"] != "Verified":
        raise HTTPException(status_code=403, detail="Both accounts must be verified.")
    if {requester["role"], other["role"]} != {"institution", "job_seeker"}:
        raise HTTPException(
            status_code=422,
            detail="Connections must link one institution and one job seeker.",
        )
    teacher_id = claims["sub"] if requester["role"] == "job_seeker" else str(payload.other_user_id)
    institution_id = (
        claims["sub"] if requester["role"] == "institution" else str(payload.other_user_id)
    )
    approved_vacancy = first_row(
        db.table("vacancies")
        .select("id")
        .eq("institution_id", institution_id)
        .eq("status", "Verified")
    )
    if approved_vacancy is None:
        raise HTTPException(
            status_code=403,
            detail="The institution must have an approved vacancy before connecting.",
        )
    existing = first_row(
        db.table("connections")
        .select("id")
        .eq("teacher_id", teacher_id)
        .eq("institution_id", institution_id)
    )
    if existing:
        raise HTTPException(status_code=409, detail="A connection already exists.")
    return first_row(
        db.table("connections")
        .insert(
            {
                "teacher_id": teacher_id,
                "institution_id": institution_id,
                "status": "Pending",
                "requested_by": claims["sub"],
            }
        )
        .select("*")
    ) or {}


@app.get("/api/v1/connections/mine", tags=["connections"])
def list_my_connections(
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> list[dict[str, Any]]:
    profile = require_active_profile(claims, db)
    field = "teacher_id" if profile["role"] == "job_seeker" else "institution_id"
    return execute(
        db.table("connections")
        .select(
            "*,teacher:profiles!connections_teacher_id_fkey(id,full_name),"
            "institution:profiles!connections_institution_id_fkey(id,full_name)"
        )
        .eq(field, claims["sub"])
        .order("created_at", desc=True)
    )


@app.post(
    "/api/v1/complaints",
    status_code=status.HTTP_201_CREATED,
    tags=["complaints"],
)
def create_complaint(
    payload: ComplaintCreate,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_active_profile(claims, db)
    return first_row(
        db.table("complaints")
        .insert(
            {
                **payload.model_dump(mode="json"),
                "reporter_id": claims["sub"],
                "status": "Open",
            }
        )
        .select("*")
    ) or {}


@app.get("/api/v1/complaints/mine", tags=["complaints"])
def list_my_complaints(
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> list[dict[str, Any]]:
    require_active_profile(claims, db)
    return execute(
        db.table("complaints")
        .select("*")
        .eq("reporter_id", claims["sub"])
        .order("created_at", desc=True)
    )


@app.get("/api/v1/admin/overview", tags=["administration"])
def admin_overview(
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, int]:
    require_admin(claims)
    return {
        "total_accounts": count_rows(db.table("profiles").select("id", count="exact", head=True)),
        "pending_accounts": count_rows(
            db.table("profiles").select("id", count="exact", head=True).eq("status", "Pending")
        ),
        "verified_accounts": count_rows(
            db.table("profiles").select("id", count="exact", head=True).eq("status", "Verified")
        ),
        "institution_count": count_rows(
            db.table("profiles").select("id", count="exact", head=True).eq("role", "institution")
        ),
        "job_seeker_count": count_rows(
            db.table("profiles").select("id", count="exact", head=True).eq("role", "job_seeker")
        ),
        "pending_vacancies": count_rows(
            db.table("vacancies").select("id", count="exact", head=True).eq("status", "Pending")
        ),
    }


@app.post(
    "/api/v1/admin/notifications",
    status_code=status.HTTP_201_CREATED,
    tags=["notifications"],
)
def admin_send_notification(
    payload: AdminNotificationCreate,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, int]:
    require_admin(claims)
    title = payload.title.strip()
    message = payload.message.strip()
    if not title or not message:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A notification title and message are required.",
        )

    recipients: list[dict[str, Any]] = []
    if payload.recipient_id is not None:
        recipient = first_row(
            db.table("profiles")
            .select("id")
            .eq("id", str(payload.recipient_id))
        )
        if recipient is None:
            raise HTTPException(status_code=404, detail="Recipient account not found.")
        recipients.append(recipient)
    else:
        offset = 0
        while True:
            page = execute(
                db.table("profiles")
                .select("id")
                .order("created_at")
                .range(offset, offset + 499)
            )
            recipients.extend(page)
            if len(page) < 500:
                break
            offset += 500

    if not recipients:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="There are no accounts to notify.",
        )

    for offset in range(0, len(recipients), 500):
        batch = recipients[offset : offset + 500]
        execute(
            db.table("notifications").insert(
                [
                    {
                        "recipient_id": recipient["id"],
                        "sender_id": claims["sub"],
                        "title": title,
                        "message": message,
                    }
                    for recipient in batch
                ]
            )
        )

    record_audit(
        db,
        claims["sub"],
        "Sent notification",
        "notification",
        "all_accounts" if payload.recipient_id is None else str(payload.recipient_id),
        {"recipient_count": len(recipients), "title": title},
    )
    return {"recipient_count": len(recipients)}


@app.get("/api/v1/admin/accounts", tags=["administration"])
def admin_accounts(
    role: str | None = Query(default=None, pattern="^(institution|job_seeker|admin)$"),
    account_status: str | None = Query(
        default=None, alias="status", pattern="^(Pending|Verified|Rejected|Suspended)$"
    ),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> list[dict[str, Any]]:
    require_admin(claims)
    query = db.table("profiles").select(
        "id,role,username,full_name,phone,status,status_reason,created_at,"
        "job_seeker_details(*),institution_details(*),"
        "institution_certificates(cert_type)"
    )
    if role:
        query = query.eq("role", role)
    if account_status:
        query = query.eq("status", account_status)
    return execute(page_query(query.order("created_at", desc=True), offset, limit))


@app.patch("/api/v1/admin/accounts/{account_id}", tags=["administration"])
def admin_update_account(
    account_id: UUID,
    payload: AccountStatusUpdate,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_admin(claims)
    if payload.status == "Rejected" and not (payload.reason or "").strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A reason is required when rejecting an account.",
        )
    existing = first_row(
        db.table("profiles")
        .select("id,role")
        .eq("id", str(account_id))
    )
    if existing is None:
        raise HTTPException(status_code=404, detail="Account not found.")
    changes = {"status": payload.status, "status_reason": payload.reason}
    updated = first_row(
        db.table("profiles")
        .update(changes)
        .eq("id", str(account_id))
        .select("id,role,username,full_name,phone,status,status_reason,created_at")
    ) or {}
    if existing["role"] == "institution":
        execute(
            db.table("institution_details")
            .update({"verified": payload.status == "Verified"})
            .eq("id", str(account_id))
        )
    record_audit(
        db,
        claims["sub"],
        f"{payload.status} account",
        "account",
        str(account_id),
        {"reason": payload.reason},
    )
    return updated


@app.get(
    "/api/v1/admin/accounts/{account_id}/documents",
    tags=["administration"],
)
def admin_account_documents(
    account_id: UUID,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> list[dict[str, Any]]:
    require_admin(claims)
    profile = first_row(
        db.table("profiles").select("id,role").eq("id", str(account_id))
    )
    if profile is None:
        raise HTTPException(status_code=404, detail="Account not found.")

    documents: list[tuple[str, str, str]] = []
    if profile["role"] == "institution":
        certificates = execute(
            db.table("institution_certificates")
            .select("file_url,cert_type")
            .eq("institution_id", str(account_id))
        )
        documents.extend(
            (
                "certificates",
                item["file_url"],
                item["cert_type"].replace("_", " ").title(),
            )
            for item in certificates
        )
    elif profile["role"] == "job_seeker":
        details = first_row(
            db.table("job_seeker_details")
            .select("resume_url")
            .eq("id", str(account_id))
        )
        if details and details.get("resume_url"):
            documents.append(("resumes", details["resume_url"], "Resume"))

    signed_documents = []
    for bucket, path, name in documents:
        try:
            signed = db.storage.from_(bucket).create_signed_url(path, 300)
        except StorageApiError as error:
            logger.error("Supabase Storage could not create a signed link: %s", error.code)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to create a secure document link.",
            ) from error
        signed_url = signed.get("signedURL") or signed.get("signedUrl")
        if not signed_url:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The document service did not return a secure link.",
            )
        signed_documents.append(
            {"name": name, "url": signed_url, "expires_in": 300}
        )
    return signed_documents


@app.get("/api/v1/admin/vacancies", tags=["administration"])
def admin_vacancies(
    vacancy_status: str | None = Query(
        default=None, alias="status", pattern="^(Pending|Verified|Rejected|Suspended)$"
    ),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> list[dict[str, Any]]:
    require_admin(claims)
    query = db.table("vacancies").select(
        "*,institution:profiles!vacancies_institution_id_fkey(full_name,username),"
        "applications(count)"
    )
    if vacancy_status:
        query = query.eq("status", vacancy_status)
    return execute(page_query(query.order("created_at", desc=True), offset, limit))


@app.patch("/api/v1/admin/vacancies/{vacancy_id}", tags=["administration"])
def admin_update_vacancy(
    vacancy_id: UUID,
    payload: AdminVacancyUpdate,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_admin(claims)
    existing = first_row(
        db.table("vacancies")
        .select("id,title,institution_id")
        .eq("id", str(vacancy_id))
    )
    if existing is None:
        raise HTTPException(status_code=404, detail="Vacancy not found.")
    if payload.status == "Verified":
        institution = first_row(
            db.table("profiles")
            .select("status")
            .eq("id", existing["institution_id"])
        )
        if institution is None or institution["status"] != "Verified":
            raise HTTPException(
                status_code=409,
                detail="Verify the institution account before approving its vacancy.",
            )
    updated = first_row(
        db.table("vacancies")
        .update({"status": payload.status})
        .eq("id", str(vacancy_id))
        .select("*")
    ) or {}
    record_audit(
        db,
        claims["sub"],
        f"{payload.status} vacancy",
        "vacancy",
        str(vacancy_id),
        {"title": existing["title"]},
    )
    return updated


@app.get("/api/v1/admin/connections", tags=["administration"])
def admin_connections(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> list[dict[str, Any]]:
    require_admin(claims)
    query = db.table("connections").select(
        "*,teacher:profiles!connections_teacher_id_fkey(id,full_name),"
        "institution:profiles!connections_institution_id_fkey(id,full_name)"
    )
    return execute(page_query(query.order("created_at", desc=True), offset, limit))


@app.patch(
    "/api/v1/admin/connections/{connection_id}",
    tags=["administration"],
)
def admin_update_connection(
    connection_id: UUID,
    payload: ConnectionUpdate,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_admin(claims)
    connection = first_row(
        db.table("connections")
        .select(
            "id,teacher_id,institution_id,"
            "teacher:profiles!connections_teacher_id_fkey(status,full_name),"
            "institution:profiles!connections_institution_id_fkey(status,full_name)"
        )
        .eq("id", str(connection_id))
    )
    if connection is None:
        raise HTTPException(status_code=404, detail="Connection not found.")
    if payload.status == "Approved":
        if (
            connection["teacher"]["status"] != "Verified"
            or connection["institution"]["status"] != "Verified"
        ):
            raise HTTPException(
                status_code=409,
                detail="Both accounts must be verified before approving a connection.",
            )
        vacancy = first_row(
            db.table("vacancies")
            .select("id")
            .eq("institution_id", connection["institution_id"])
            .eq("status", "Verified")
        )
        if vacancy is None:
            raise HTTPException(
                status_code=409,
                detail="The institution must have an approved vacancy before approval.",
            )
    updated = first_row(
        db.table("connections")
        .update({"status": payload.status})
        .eq("id", str(connection_id))
        .select("*")
    ) or {}
    record_audit(
        db,
        claims["sub"],
        f"{payload.status} connection",
        "connection",
        str(connection_id),
        {
            "teacher": connection["teacher"]["full_name"],
            "institution": connection["institution"]["full_name"],
        },
    )
    return updated


@app.get("/api/v1/admin/complaints", tags=["administration"])
def admin_complaints(
    complaint_status: str | None = Query(
        default=None, alias="status", pattern="^(Open|Resolved|Escalated)$"
    ),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> list[dict[str, Any]]:
    require_admin(claims)
    query = db.table("complaints").select(
        "*,reporter:profiles!complaints_reporter_id_fkey(full_name,username)"
    )
    if complaint_status:
        query = query.eq("status", complaint_status)
    return execute(page_query(query.order("created_at", desc=True), offset, limit))


@app.patch("/api/v1/admin/complaints/{complaint_id}", tags=["administration"])
def admin_update_complaint(
    complaint_id: UUID,
    payload: ComplaintUpdate,
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> dict[str, Any]:
    require_admin(claims)
    existing = first_row(
        db.table("complaints")
        .select("id,subject")
        .eq("id", str(complaint_id))
    )
    if existing is None:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    updated = first_row(
        db.table("complaints")
        .update(payload.model_dump())
        .eq("id", str(complaint_id))
        .select("*")
    ) or {}
    record_audit(
        db,
        claims["sub"],
        f"{payload.status} complaint",
        "complaint",
        str(complaint_id),
        {"subject": existing["subject"], "resolution_note": payload.resolution_note},
    )
    return updated


@app.get("/api/v1/admin/audit", tags=["administration"])
def admin_audit(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> list[dict[str, Any]]:
    require_admin(claims)
    return execute(
        page_query(
            db.table("audit_log")
            .select("*,actor:profiles!audit_log_actor_id_fkey(full_name,username)")
            .order("created_at", desc=True),
            offset,
            limit,
        )
    )


@app.get("/api/v1/admin/reports/accounts.csv", tags=["administration"])
def export_accounts_csv(
    claims: dict[str, Any] = Depends(get_user_claims),
    db: Any = Depends(get_supabase_client),
) -> StreamingResponse:
    require_admin(claims)
    query = (
        db.table("profiles")
        .select("id,username,full_name,role,status,created_at")
        .order("created_at", desc=True)
    )
    accounts: list[dict[str, Any]] = []
    offset = 0
    while True:
        page = execute(query.range(offset, offset + 999))
        accounts.extend(page)
        if len(page) < 1000:
            break
        offset += 1000
    record_audit(
        db,
        claims["sub"],
        "Exported account report",
        "account_report",
        "all_accounts",
        {"account_count": len(accounts)},
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Username", "Name", "Role", "Status", "Created"])
    for account in accounts:
        values = [
            account["id"],
            account["username"],
            account["full_name"],
            account["role"],
            account["status"],
            account["created_at"],
        ]
        writer.writerow(
            [
                f"'{value}" if isinstance(value, str) and value[:1] in ("=", "+", "-", "@") else value
                for value in values
            ]
        )
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="educareer-accounts.csv"'},
    )
