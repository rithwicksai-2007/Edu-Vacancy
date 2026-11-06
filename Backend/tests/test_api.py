import asyncio
import unittest
import time
from unittest.mock import patch

import httpx
import jwt
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from postgrest.exceptions import APIError
from pydantic import ValidationError

from Backend.main import (
    app,
    admin_send_notification,
    admin_overview,
    admin_accounts,
    admin_vacancies,
    create_username_account,
    execute_response,
    get_settings,
    get_user_claims,
    read_current_user,
    require_admin,
    username_auth_email,
)
from Backend.schemas import (
    AdminNotificationCreate,
    InstitutionRegistration,
    JobSeekerRegistration,
)


class ApiContractTests(unittest.TestCase):
    def test_job_seeker_registration_requires_ten_digit_phone(self) -> None:
        registration = {
            "username": "sample.user",
            "password": "long-password",
            "full_name": "Sample User",
            "security_question": "First school you attended?",
            "security_answer_hash": "a" * 64,
        }

        payload = JobSeekerRegistration(**registration, phone="9876543210")
        self.assertEqual(payload.phone, "9876543210")

        for phone in ("123456789", "12345678901", "12345abc90", "+9198765432"):
            with self.subTest(phone=phone), self.assertRaises(ValidationError):
                JobSeekerRegistration(**registration, phone=phone)

    def test_institution_registration_requires_ten_digit_phone(self) -> None:
        registration = {
            "username": "sample.school",
            "password": "long-password",
            "full_name": "Sample School",
            "security_question": "Year the institution was established?",
            "security_answer_hash": "a" * 64,
            "institution_name": "Sample School",
            "institution_type": "School",
            "address": "Main Road",
            "contact_person": "Sample Contact",
            "contact_designation": "Principal",
            "registration_number": "REG-123",
            "city": "Hyderabad",
            "state": "Telangana",
            "pincode": "500001",
        }

        payload = InstitutionRegistration(**registration, phone="9876543210")
        self.assertEqual(payload.phone, "9876543210")

        for phone in ("123456789", "12345678901", "12345abc90", "+9198765432"):
            with self.subTest(phone=phone), self.assertRaises(ValidationError):
                InstitutionRegistration(**registration, phone=phone)

    @patch.dict("os.environ", {"ADMIN_USER_ID": "00000000-0000-0000-0000-000000000001"})
    def test_admin_accounts_query_does_not_depend_on_optional_document_tables(self) -> None:
        get_settings.cache_clear()
        self.addCleanup(get_settings.cache_clear)

        class Query:
            selected_columns = ""

            def select(self, columns: str) -> "Query":
                self.selected_columns = columns
                return self

            def eq(self, *_args: object) -> "Query":
                return self

            def order(self, *_args: object, **_kwargs: object) -> "Query":
                return self

            def range(self, *_args: object) -> "Query":
                return self

            def execute(self) -> object:
                return type("Response", (), {"data": []})()

        query = Query()

        class Database:
            def table(self, name: str) -> Query:
                if name != "profiles":
                    raise AssertionError(f"Unexpected table: {name}")
                return query

        accounts = admin_accounts(
            role=None,
            account_status=None,
            limit=50,
            offset=0,
            claims={
                "sub": "00000000-0000-0000-0000-000000000001",
                "app_metadata": {"platform_role": "admin"},
            },
            db=Database(),
        )

        self.assertEqual(accounts, [])
        self.assertIn("institution_certificates", query.selected_columns)
        self.assertNotIn("job_seeker_documents", query.selected_columns)
        self.assertNotIn("institution_documents", query.selected_columns)

    def test_username_login_address_uses_private_synthetic_domain(self) -> None:
        self.assertEqual(
            username_auth_email("My.User"),
            "my.user@users.eduvacancy.invalid",
        )

    def test_username_registration_creates_confirmed_auth_user(self) -> None:
        class ProfileQuery:
            def select(self, *_args: object) -> "ProfileQuery":
                return self

            def eq(self, *_args: object) -> "ProfileQuery":
                return self

            def limit(self, *_args: object) -> "ProfileQuery":
                return self

            def execute(self) -> object:
                return type("Response", (), {"data": []})()

        class Database:
            def table(self, _name: str) -> ProfileQuery:
                return ProfileQuery()

        class Admin:
            def __init__(self) -> None:
                self.attributes: dict[str, object] | None = None

            def create_user(self, attributes: dict[str, object]) -> object:
                self.attributes = attributes
                return type("Result", (), {"user": type("User", (), {"id": "user-id"})()})()

        admin = Admin()
        client = type(
            "Client",
            (),
            {"auth": type("Auth", (), {"admin": admin})()},
        )()
        with patch("Backend.main.get_supabase_client", return_value=client):
            result = create_username_account(
                "sample.user",
                "long-password",
                "job_seeker",
                {"full_name": "Sample User"},
                Database(),
            )

        self.assertEqual(result, {"id": "user-id", "username": "sample.user"})
        self.assertIsNotNone(admin.attributes)
        assert admin.attributes is not None
        self.assertEqual(
            admin.attributes["email"],
            "sample.user@users.eduvacancy.invalid",
        )
        self.assertIs(admin.attributes["email_confirm"], True)
        self.assertEqual(
            admin.attributes["user_metadata"],
            {"role": "job_seeker", "username": "sample.user", "full_name": "Sample User"},
        )

    @patch.dict("os.environ", {"ADMIN_USER_ID": "00000000-0000-0000-0000-000000000001"})
    def test_admin_notification_broadcasts_and_records_audit(self) -> None:
        get_settings.cache_clear()
        self.addCleanup(get_settings.cache_clear)

        class Query:
            def __init__(self, table_name: str, db: "Database") -> None:
                self.table_name = table_name
                self.db = db
                self.rows: list[dict[str, object]] = []

            def select(self, *_args: object, **_kwargs: object) -> "Query":
                return self

            def order(self, *_args: object, **_kwargs: object) -> "Query":
                return self

            def eq(self, *_args: object) -> "Query":
                return self

            def range(self, *_args: object) -> "Query":
                return self

            def insert(
                self, rows: list[dict[str, object]] | dict[str, object]
            ) -> "Query":
                self.rows = rows if isinstance(rows, list) else [rows]
                self.db.inserts[self.table_name] = self.rows
                return self

            def execute(self) -> object:
                rows = (
                    [{"id": "user-1"}, {"id": "user-2"}]
                    if self.table_name == "profiles"
                    else self.rows
                )
                return type("Response", (), {"data": rows})()

        class Database:
            def __init__(self) -> None:
                self.inserts: dict[str, list[dict[str, object]]] = {}

            def table(self, name: str) -> Query:
                return Query(name, self)

        db = Database()
        admin_id = "00000000-0000-0000-0000-000000000001"
        result = admin_send_notification(
            AdminNotificationCreate(title="Update", message="New message"),
            {"sub": admin_id, "app_metadata": {"platform_role": "admin"}},
            db,
        )

        self.assertEqual(result, {"recipient_count": 2})
        self.assertEqual(
            [row["recipient_id"] for row in db.inserts["notifications"]],
            ["user-1", "user-2"],
        )
        self.assertEqual(
            db.inserts["audit_log"][0]["action"],
            "Sent notification",
        )

    @patch.dict("os.environ", {"ADMIN_USER_ID": "00000000-0000-0000-0000-000000000001"})
    def test_admin_notification_requires_server_managed_admin_claim(self) -> None:
        get_settings.cache_clear()
        self.addCleanup(get_settings.cache_clear)

        class Database:
            def table(self, _name: str) -> None:
                raise AssertionError("Database must not be accessed before admin check")

        with self.assertRaises(HTTPException) as raised:
            admin_send_notification(
                AdminNotificationCreate(title="Update", message="New message"),
                {"sub": "user-id", "app_metadata": {}},
                Database(),
            )

        self.assertEqual(raised.exception.status_code, 403)

    @patch.dict("os.environ", {"ADMIN_USER_ID": "00000000-0000-0000-0000-000000000001"})
    def test_admin_vacancies_returns_pending_submissions(self) -> None:
        get_settings.cache_clear()
        self.addCleanup(get_settings.cache_clear)

        pending_vacancy = {
            "id": "vacancy-id",
            "title": "Teacher",
            "status": "Pending",
        }

        class Query:
            def select(self, *_args: object) -> "Query":
                return self

            def eq(self, *_args: object) -> "Query":
                return self

            def order(self, *_args: object, **_kwargs: object) -> "Query":
                return self

            def range(self, *_args: object) -> "Query":
                return self

            def execute(self) -> object:
                return type("Response", (), {"data": [pending_vacancy]})()

        class Database:
            def table(self, _name: str) -> Query:
                return Query()

        result = admin_vacancies(
            vacancy_status=None,
            limit=50,
            offset=0,
            claims={
                "sub": "00000000-0000-0000-0000-000000000001",
                "app_metadata": {"platform_role": "admin"},
            },
            db=Database(),
        )

        self.assertEqual(result, [pending_vacancy])

    def test_missing_database_schema_returns_actionable_error(self) -> None:
        class MissingProfilesQuery:
            def execute(self) -> None:
                raise APIError(
                    {
                        "code": "PGRST205",
                        "message": "Could not find the table 'public.profiles'.",
                    }
                )

        with self.assertRaises(HTTPException) as raised:
            execute_response(MissingProfilesQuery())

        self.assertEqual(raised.exception.status_code, 502)
        self.assertIn("Backend/supabase/schema.sql", raised.exception.detail)

    def test_unregistered_supabase_key_returns_actionable_error(self) -> None:
        class InvalidKeyQuery:
            def execute(self) -> None:
                raise APIError({"message": "Unregistered API key"})

        with self.assertRaises(HTTPException) as raised:
            execute_response(InvalidKeyQuery())

        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("SUPABASE_SERVICE_ROLE_KEY", raised.exception.detail)
        self.assertIn("Backend/.env", raised.exception.detail)

    @patch.dict("os.environ", {"ADMIN_USER_ID": "00000000-0000-0000-0000-000000000001"})
    def test_admin_overview_returns_counts_without_account_update_payload(self) -> None:
        get_settings.cache_clear()
        self.addCleanup(get_settings.cache_clear)

        class CountQuery:
            def select(self, *_args: object, **_kwargs: object) -> "CountQuery":
                return self

            def eq(self, *_args: object, **_kwargs: object) -> "CountQuery":
                return self

            def execute(self) -> object:
                return type("Response", (), {"count": 0})()

        class Database:
            def table(self, _name: str) -> CountQuery:
                return CountQuery()

        result = admin_overview(
            {
                "sub": "00000000-0000-0000-0000-000000000001",
                "app_metadata": {"platform_role": "admin"},
            },
            Database(),
        )

        self.assertEqual(
            result,
            {
                "total_accounts": 0,
                "pending_accounts": 0,
                "verified_accounts": 0,
                "institution_count": 0,
                "job_seeker_count": 0,
                "pending_vacancies": 0,
            },
        )

    def test_health_endpoint(self) -> None:
        async def get_health() -> httpx.Response:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                return await client.get("/health")

        response = asyncio.run(get_health())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    @patch.dict(
        "os.environ",
        {"SUPABASE_URL": "", "SUPABASE_SERVICE_ROLE_KEY": ""},
    )
    def test_readiness_endpoint_reports_missing_supabase_configuration(self) -> None:
        get_settings.cache_clear()

        async def get_readiness() -> httpx.Response:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                return await client.get("/ready")

        response = asyncio.run(get_readiness())

        self.assertEqual(response.status_code, 503)
        self.assertIn("SUPABASE_URL", response.json()["detail"])
        get_settings.cache_clear()

    @patch.dict(
        "os.environ",
        {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "sb_secret_server-side-key",
        },
    )
    def test_readiness_endpoint_accepts_configured_supabase(self) -> None:
        get_settings.cache_clear()

        async def get_readiness() -> httpx.Response:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                return await client.get("/ready")

        response = asyncio.run(get_readiness())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ready"})
        get_settings.cache_clear()

    @patch.dict(
        "os.environ",
        {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "sb_publishable_browser-key",
        },
    )
    def test_readiness_endpoint_rejects_publishable_key_as_server_key(self) -> None:
        get_settings.cache_clear()

        async def get_readiness() -> httpx.Response:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                return await client.get("/ready")

        response = asyncio.run(get_readiness())

        self.assertEqual(response.status_code, 503)
        self.assertIn("publishable browser key", response.json()["detail"])
        self.assertIn("SUPABASE_SERVICE_ROLE_KEY", response.json()["detail"])
        get_settings.cache_clear()

    @patch.dict(
        "os.environ",
        {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "not-a-server-key",
        },
    )
    def test_readiness_rejects_unrecognized_server_key(self) -> None:
        get_settings.cache_clear()

        async def get_readiness() -> httpx.Response:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                return await client.get("/ready")

        response = asyncio.run(get_readiness())

        self.assertEqual(response.status_code, 503)
        get_settings.cache_clear()

    @patch.dict(
        "os.environ",
        {
            "SUPABASE_URL": "not-a-url",
            "SUPABASE_SERVICE_ROLE_KEY": "server-side-key",
        },
    )
    def test_readiness_rejects_malformed_supabase_url(self) -> None:
        get_settings.cache_clear()

        async def get_readiness() -> httpx.Response:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                return await client.get("/ready")

        response = asyncio.run(get_readiness())

        self.assertEqual(response.status_code, 503)
        get_settings.cache_clear()

    def test_authenticated_routes_reject_missing_tokens(self) -> None:
        async def get_current_user() -> httpx.Response:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                return await client.get("/api/v1/auth/me")

        response = asyncio.run(get_current_user())

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers["www-authenticate"], "Bearer")

    @patch.dict("os.environ", {"ADMIN_USER_ID": "00000000-0000-0000-0000-000000000001"})
    def test_admin_requires_privileged_app_metadata(self) -> None:
        get_settings.cache_clear()
        with self.assertRaises(HTTPException) as raised:
            require_admin(
                {
                    "sub": "00000000-0000-0000-0000-000000000001",
                    "app_metadata": {"role": "admin"},
                }
            )

        self.assertEqual(raised.exception.status_code, 403)
        get_settings.cache_clear()

    @patch.dict("os.environ", {"ADMIN_USER_ID": "00000000-0000-0000-0000-000000000001"})
    def test_admin_claim_allows_only_configured_user_with_server_role(self) -> None:
        get_settings.cache_clear()
        require_admin(
            {
                "sub": "00000000-0000-0000-0000-000000000001",
                "app_metadata": {"platform_role": "admin"},
            }
        )
        with self.assertRaises(HTTPException) as raised:
            require_admin(
                {
                    "sub": "00000000-0000-0000-0000-000000000002",
                    "app_metadata": {"platform_role": "admin"},
                }
            )
        self.assertEqual(raised.exception.status_code, 403)
        get_settings.cache_clear()

    @patch.dict("os.environ", {"ADMIN_USER_ID": ""})
    def test_admin_access_fails_closed_without_configured_owner(self) -> None:
        get_settings.cache_clear()
        with self.assertRaises(HTTPException) as raised:
            require_admin(
                {
                    "sub": "00000000-0000-0000-0000-000000000001",
                    "app_metadata": {"platform_role": "admin"},
                }
            )
        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("ADMIN_USER_ID", raised.exception.detail)
        get_settings.cache_clear()

    @patch.dict("os.environ", {"ADMIN_USER_ID": "00000000-0000-0000-0000-000000000001"})
    def test_current_user_exposes_admin_role_only_for_configured_owner(self) -> None:
        get_settings.cache_clear()
        self.addCleanup(get_settings.cache_clear)

        class ProfileQuery:
            def select(self, *_args: object) -> "ProfileQuery":
                return self

            def eq(self, *_args: object) -> "ProfileQuery":
                return self

            def limit(self, _value: int) -> "ProfileQuery":
                return self

            def execute(self) -> object:
                return type(
                    "Response",
                    (),
                    {
                        "data": [
                            {
                                "id": "00000000-0000-0000-0000-000000000001",
                                "role": "admin",
                                "username": "owner",
                                "full_name": "Platform Owner",
                                "phone": "",
                                "status": "Verified",
                                "status_reason": None,
                                "created_at": "2026-01-01T00:00:00Z",
                            }
                        ]
                    },
                )()

        class Database:
            def table(self, _name: str) -> ProfileQuery:
                return ProfileQuery()

        owner_claims = {
            "sub": "00000000-0000-0000-0000-000000000001",
            "app_metadata": {"platform_role": "admin"},
        }
        other_admin_claims = {
            "sub": "00000000-0000-0000-0000-000000000002",
            "app_metadata": {"platform_role": "admin"},
        }

        self.assertEqual(read_current_user(owner_claims, Database())["platform_role"], "admin")
        self.assertIsNone(
            read_current_user(other_admin_claims, Database())["platform_role"]
        )

    @patch.dict(
        "os.environ",
        {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_JWT_SECRET": "test-signing-secret-long-enough-for-sha256",
        },
    )
    def test_hs256_access_token_is_signature_and_claim_validated(self) -> None:
        get_settings.cache_clear()
        token = jwt.encode(
            {
                "sub": "8a7e63f2-71a1-47b1-a940-3670c4bdfec4",
                "aud": "authenticated",
                "iss": "https://example.supabase.co/auth/v1",
                "exp": int(time.time()) + 60,
            },
            "test-signing-secret-long-enough-for-sha256",
            algorithm="HS256",
        )

        claims = get_user_claims(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        )

        self.assertEqual(claims["aud"], "authenticated")
        get_settings.cache_clear()

    @patch.dict(
        "os.environ",
        {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_JWT_SECRET": "correct-signing-secret-long-enough-for-sha256",
        },
    )
    def test_hs256_access_token_rejects_invalid_signature(self) -> None:
        get_settings.cache_clear()
        token = jwt.encode(
            {
                "sub": "8a7e63f2-71a1-47b1-a940-3670c4bdfec4",
                "aud": "authenticated",
                "iss": "https://example.supabase.co/auth/v1",
                "exp": int(time.time()) + 60,
            },
            "invalid-signing-secret-long-enough-for-sha256",
            algorithm="HS256",
        )

        with self.assertRaises(HTTPException) as raised:
            get_user_claims(
                HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
            )

        self.assertEqual(raised.exception.status_code, 401)
        get_settings.cache_clear()

    @patch.dict(
        "os.environ",
        {
            "SUPABASE_URL": "https://configured-project.supabase.co",
            "SUPABASE_JWT_SECRET": "test-signing-secret-long-enough-for-sha256",
        },
    )
    def test_access_token_from_different_project_returns_actionable_error(self) -> None:
        get_settings.cache_clear()
        token = jwt.encode(
            {
                "sub": "8a7e63f2-71a1-47b1-a940-3670c4bdfec4",
                "aud": "authenticated",
                "iss": "https://another-project.supabase.co/auth/v1",
                "exp": int(time.time()) + 60,
            },
            "test-signing-secret-long-enough-for-sha256",
            algorithm="HS256",
        )

        with self.assertRaises(HTTPException) as raised:
            get_user_claims(
                HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
            )

        self.assertEqual(raised.exception.status_code, 401)
        self.assertIn("different Supabase project", raised.exception.detail)
        get_settings.cache_clear()


if __name__ == "__main__":
    unittest.main()
