from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


AccountStatus = Literal["Pending", "Verified", "Rejected", "Suspended"]
ApplicationStatus = Literal[
    "Applied", "Under Review", "Shortlisted", "Interview", "Rejected", "Hired"
]
ConnectionStatus = Literal["Pending", "Approved", "Blocked"]
ComplaintStatus = Literal["Open", "Resolved", "Escalated"]
ComplaintTarget = Literal["account", "vacancy", "application", "other"]
UserRole = Literal["job_seeker", "institution"]
VacancyStatus = Literal["Pending", "Verified", "Rejected", "Suspended"]


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None, min_length=1, max_length=160)
    phone: str | None = Field(default=None, max_length=40)


class PreferencesUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    preferences: dict[str, bool | str] = Field(max_length=32)


class JobSeekerDetailsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subject: str | None = Field(default=None, max_length=120)
    qualification: str | None = Field(default=None, max_length=240)
    years_experience: int | None = Field(default=None, ge=0, le=80)
    preferred_location: str | None = Field(default=None, max_length=160)
    professional_summary: str | None = Field(default=None, max_length=5000)


class InstitutionDetailsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    institution_name: str | None = Field(default=None, min_length=1, max_length=200)
    institution_type: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=500)
    village: str | None = Field(default=None, max_length=120)
    contact_person: str | None = Field(default=None, max_length=160)
    contact_designation: str | None = Field(default=None, max_length=120)
    registration_number: str | None = Field(default=None, max_length=120)
    city: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    pincode: str | None = Field(default=None, max_length=20)
    website: HttpUrl | None = None
    description: str | None = Field(default=None, max_length=5000)


class VacancyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=10000)
    category: str = Field(min_length=1, max_length=80)
    employment_type: str = Field(min_length=1, max_length=80)
    location: str = Field(min_length=1, max_length=160)
    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    experience: str | None = Field(default=None, max_length=100)
    deadline: datetime | None = None


class VacancyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, min_length=10, max_length=10000)
    category: str | None = Field(default=None, max_length=80)
    employment_type: str | None = Field(default=None, max_length=80)
    location: str | None = Field(default=None, max_length=160)
    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    experience: str | None = Field(default=None, max_length=100)
    deadline: datetime | None = None
    status: Literal["Suspended"] | None = None


class ApplicationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cover_letter: str | None = Field(default=None, max_length=5000)


class ApplicationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ApplicationStatus


class ConnectionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    other_user_id: UUID


class ConnectionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ConnectionStatus


class ComplaintCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subject: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=5000)
    target_type: ComplaintTarget = "other"
    target_id: UUID | None = None


class ComplaintUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ComplaintStatus
    resolution_note: str | None = Field(default=None, max_length=2000)


class AccountStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: AccountStatus
    reason: str | None = Field(default=None, max_length=2000)


class JobSeekerRegistration(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$")
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=160)
    phone: str = Field(pattern=r"^[0-9]{10}$")
    security_question: str = Field(min_length=1, max_length=240)
    security_answer_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    subject: str = Field(default="", max_length=120)
    qualification: str = Field(default="", max_length=240)
    years_experience: int = Field(default=0, ge=0, le=80)
    preferred_location: str = Field(default="", max_length=160)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.strip().lower()


class InstitutionRegistration(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$")
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=160)
    phone: str = Field(pattern=r"^[0-9]{10}$")
    security_question: str = Field(min_length=1, max_length=240)
    security_answer_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    institution_name: str = Field(min_length=1, max_length=200)
    institution_type: str = Field(min_length=1, max_length=80)
    address: str = Field(min_length=1, max_length=500)
    contact_person: str = Field(min_length=1, max_length=160)
    contact_designation: str = Field(min_length=1, max_length=120)
    registration_number: str = Field(min_length=1, max_length=120)
    city: str = Field(min_length=1, max_length=120)
    village: str = Field(default="", max_length=120)
    state: str = Field(min_length=1, max_length=120)
    pincode: str = Field(pattern=r"^\d{6}$")
    website: str | None = Field(default=None, max_length=500)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.strip().lower()


class AdminNotificationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=2000)
    recipient_id: UUID | None = None


class AdminVacancyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: VacancyStatus


class AuditEntry(BaseModel):
    actor_id: UUID
    action: str = Field(max_length=120)
    target_type: str = Field(max_length=80)
    target_id: str
    details: dict[str, object] = Field(default_factory=dict)
