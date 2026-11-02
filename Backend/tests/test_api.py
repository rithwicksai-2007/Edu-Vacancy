import asyncio
import unittest
import time
from unittest.mock import patch

import httpx
import jwt
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from postgrest.exceptions import APIError

from Backend.main import (
    app,
    admin_send_notification,
    admin_overview,
    admin_vacancies,
    create_username_account,
    execute_response,
    get_settings,
    get_user_claims,
    require_admin,
    username_auth_email,
)
from Backend.schemas import AdminNotificationCreate


class ApiContractTests(unittest.TestCase):
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

    def test_admin_notification_broadcasts_and_records_audit(self) -> None:
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

    def test_admin_notification_requires_server_managed_admin_claim(self) -> None:
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

    def test_admin_vacancies_returns_pending_submissions(self) -> None:
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
            claims={"sub": "admin-id", "app_metadata": {"platform_role": "admin"}},
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

    def test_admin_overview_returns_counts_without_account_update_payload(self) -> None:
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
            {"sub": "admin-id", "app_metadata": {"platform_role": "admin"}},
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

    def test_admin_requires_privileged_app_metadata(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            require_admin({"sub": "user-id", "app_metadata": {"role": "admin"}})

        self.assertEqual(raised.exception.status_code, 403)

    def test_admin_claim_uses_server_managed_platform_role(self) -> None:
        require_admin(
            {"sub": "user-id", "app_metadata": {"platform_role": "admin"}}
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
