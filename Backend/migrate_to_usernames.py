import re
from typing import Any

from .main import get_supabase_client, username_auth_email


USERNAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$")


def migrate_existing_users() -> tuple[int, int]:
    supabase = get_supabase_client()
    profiles: dict[str, dict[str, Any]] = {}
    offset = 0
    while True:
        page = (
            supabase.table("profiles")
            .select("id,username,email")
            .range(offset, offset + 999)
            .execute()
            .data
            or []
        )
        profiles.update({row["id"]: row for row in page})
        if len(page) < 1000:
            break
        offset += 1000

    users = []
    page_number = 1
    while True:
        page = supabase.auth.admin.list_users(page=page_number, per_page=1000)
        users.extend(page)
        if len(page) < 1000:
            break
        page_number += 1

    targets: dict[str, str] = {}
    for user in users:
        profile = profiles.get(str(user.id))
        if profile is None:
            continue
        username = str(profile["username"]).strip().lower()
        if not USERNAME_PATTERN.fullmatch(username):
            raise RuntimeError(
                f"Profile {user.id} has an invalid username. Fix it before migration."
            )
        targets[str(user.id)] = username_auth_email(username)

    occupied_emails = {
        str(user.email).lower(): str(user.id)
        for user in users
        if user.email is not None
    }
    collisions = [
        (user_id, target, occupied_emails[target.lower()])
        for user_id, target in targets.items()
        if target.lower() in occupied_emails
        and occupied_emails[target.lower()] != user_id
    ]
    if collisions:
        raise RuntimeError(
            "A target synthetic login address is already assigned to another "
            "Auth user. Resolve the username/email collision before migration."
        )
    profile_emails = {
        str(row["email"]).lower(): str(row["id"])
        for row in profiles.values()
        if row.get("email")
    }
    profile_collisions = [
        (user_id, target, profile_emails[target.lower()])
        for user_id, target in targets.items()
        if target.lower() in profile_emails
        and profile_emails[target.lower()] != user_id
    ]
    if profile_collisions:
        raise RuntimeError(
            "A target synthetic login address is already assigned to another "
            "profile. Resolve the username/email collision before migration."
        )

    migrated = 0
    already_migrated = 0
    for user in users:
        user_id = str(user.id)
        target_email = targets.get(user_id)
        if target_email is None:
            continue
        if (user.email or "").lower() == target_email.lower() and user.email_confirmed_at:
            supabase.table("profiles").update({"email": target_email}).eq(
                "id", user_id
            ).execute()
            already_migrated += 1
            continue
        supabase.auth.admin.update_user_by_id(
            user_id,
            {"email": target_email, "email_confirm": True},
        )
        supabase.table("profiles").update({"email": target_email}).eq(
            "id", user_id
        ).execute()
        migrated += 1

    skipped = len(users) - len(targets)
    if skipped:
        print(
            f"Skipped {skipped} Auth account(s) without a matching app profile. "
            "Assign an application role and create its profile before migrating it."
        )
    return migrated, already_migrated


if __name__ == "__main__":
    migrated_count, already_migrated_count = migrate_existing_users()
    print(
        f"Username migration complete: {migrated_count} migrated, "
        f"{already_migrated_count} already migrated."
    )
