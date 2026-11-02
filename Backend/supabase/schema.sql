create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role text not null check (role in ('job_seeker', 'institution', 'admin')),
    username text not null,
    full_name text not null,
    email text not null unique,
    phone text not null default '',
    security_question text not null default '',
    security_answer_hash text not null default '',
    status text not null default 'Pending'
        check (status in ('Pending', 'Verified', 'Rejected', 'Suspended')),
    status_reason text,
    created_at timestamptz not null default now(),
    constraint profiles_username_format
        check (username ~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$')
);

alter table public.profiles
    add column if not exists status text not null default 'Pending',
    add column if not exists status_reason text,
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists username text;

with source_usernames as (
    select
        id,
        coalesce(nullif(split_part(email, '@', 1), ''), 'user') as source_name
    from public.profiles
    where username is null
), cleaned_usernames as (
    select
        id,
        coalesce(
            nullif(
                regexp_replace(
                    left(lower(regexp_replace(source_name, '[^a-z0-9._-]', '', 'g')), 20),
                    '^[._-]+|[._-]+$',
                    '',
                    'g'
                ),
                ''
            ),
            'user'
        ) as cleaned_name
    from source_usernames
), valid_usernames as (
    select
        id,
        case
            when length(cleaned_name) < 3 then cleaned_name || 'user'
            else cleaned_name
        end as base_username
    from cleaned_usernames
), ranked_usernames as (
    select
        id,
        base_username,
        row_number() over (
            partition by base_username
            order by created_at, id
        ) as username_rank
    from valid_usernames
    join public.profiles using (id)
)
update public.profiles as profile
set username = case
    when ranked.username_rank = 1 then ranked.base_username
    else left(ranked.base_username, 20) || '-' || left(ranked.id::text, 8)
end
from ranked_usernames as ranked
where profile.id = ranked.id;

alter table public.profiles alter column username set not null;
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'profiles_username_format'
          and conrelid = 'public.profiles'::regclass
    ) then
        alter table public.profiles
            add constraint profiles_username_format
            check (username ~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$');
    end if;
end;
$$;
create unique index if not exists profiles_username_unique_idx
    on public.profiles (username);

create table if not exists public.account_preferences (
    profile_id uuid primary key references public.profiles(id) on delete cascade,
    preferences jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'profiles_role_valid'
          and conrelid = 'public.profiles'::regclass
    ) then
        alter table public.profiles
            add constraint profiles_role_valid
            check (role in ('job_seeker', 'institution', 'admin'));
    end if;
    if not exists (
        select 1 from pg_constraint
        where conname = 'profiles_status_valid'
          and conrelid = 'public.profiles'::regclass
    ) then
        alter table public.profiles
            add constraint profiles_status_valid
            check (status in ('Pending', 'Verified', 'Rejected', 'Suspended'));
    end if;
end;
$$;

create table if not exists public.job_seeker_details (
    id uuid primary key references public.profiles(id) on delete cascade,
    subject text not null default '',
    qualification text not null default '',
    years_experience integer not null default 0 check (years_experience >= 0),
    preferred_location text not null default '',
    professional_summary text not null default '',
    resume_url text,
    profile_photo_url text
);

alter table public.job_seeker_details
    add column if not exists professional_summary text not null default '';

create table if not exists public.institution_details (
    id uuid primary key references public.profiles(id) on delete cascade,
    institution_name text not null,
    institution_type text not null,
    address text not null,
    contact_person text not null,
    contact_designation text not null,
    registration_number text not null,
    city text not null,
    state text not null,
    pincode text not null,
    website text,
    description text not null default '',
    verified boolean not null default false
);

alter table public.institution_details
    add column if not exists description text not null default '';

create table if not exists public.institution_certificates (
    id uuid primary key default gen_random_uuid(),
    institution_id uuid not null references public.profiles(id) on delete cascade,
    file_url text not null,
    cert_type text not null default 'registration_certificate',
    created_at timestamptz not null default now()
);

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.job_seeker_details'::regclass
          and contype = 'f'
          and confrelid = 'public.profiles'::regclass
    ) then
        alter table public.job_seeker_details
            add constraint job_seeker_details_id_fkey
            foreign key (id) references public.profiles(id) on delete cascade;
    end if;
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.institution_details'::regclass
          and contype = 'f'
          and confrelid = 'public.profiles'::regclass
    ) then
        alter table public.institution_details
            add constraint institution_details_id_fkey
            foreign key (id) references public.profiles(id) on delete cascade;
    end if;
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.institution_certificates'::regclass
          and contype = 'f'
          and confrelid = 'public.profiles'::regclass
    ) then
        alter table public.institution_certificates
            add constraint institution_certificates_institution_id_fkey
            foreign key (institution_id) references public.profiles(id) on delete cascade;
    end if;
end;
$$;

alter table public.institution_certificates
    add column if not exists id uuid default gen_random_uuid(),
    add column if not exists created_at timestamptz not null default now();

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'institution_certificates_pkey'
          and conrelid = 'public.institution_certificates'::regclass
    ) then
        alter table public.institution_certificates
            add constraint institution_certificates_pkey primary key (id);
    end if;
end;
$$;

create table if not exists public.vacancies (
    id uuid primary key default gen_random_uuid(),
    institution_id uuid not null references public.profiles(id) on delete cascade,
    title text not null,
    description text not null,
    category text not null,
    employment_type text not null,
    location text not null,
    salary_min integer check (salary_min is null or salary_min >= 0),
    salary_max integer check (salary_max is null or salary_max >= 0),
    experience text,
    deadline timestamptz,
    status text not null default 'Pending'
        check (status in ('Pending', 'Verified', 'Rejected', 'Suspended')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (salary_min is null or salary_max is null or salary_min <= salary_max)
);

create table if not exists public.saved_vacancies (
    job_seeker_id uuid not null references public.profiles(id) on delete cascade,
    vacancy_id uuid not null references public.vacancies(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (job_seeker_id, vacancy_id)
);

create table if not exists public.saved_teachers (
    institution_id uuid not null references public.profiles(id) on delete cascade,
    job_seeker_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (institution_id, job_seeker_id)
);

create table if not exists public.applications (
    id uuid primary key default gen_random_uuid(),
    vacancy_id uuid not null references public.vacancies(id) on delete cascade,
    applicant_id uuid not null references public.profiles(id) on delete cascade,
    cover_letter text,
    status text not null default 'Applied'
        check (status in ('Applied', 'Under Review', 'Shortlisted', 'Interview', 'Rejected', 'Hired')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (vacancy_id, applicant_id)
);

create table if not exists public.connections (
    id uuid primary key default gen_random_uuid(),
    teacher_id uuid not null references public.profiles(id) on delete cascade,
    institution_id uuid not null references public.profiles(id) on delete cascade,
    requested_by uuid not null references public.profiles(id) on delete cascade,
    status text not null default 'Pending'
        check (status in ('Pending', 'Approved', 'Blocked')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (teacher_id, institution_id)
);

create table if not exists public.complaints (
    id uuid primary key default gen_random_uuid(),
    reporter_id uuid not null references public.profiles(id) on delete cascade,
    subject text not null,
    description text not null,
    target_type text not null default 'other'
        check (target_type in ('account', 'vacancy', 'application', 'other')),
    target_id uuid,
    status text not null default 'Open'
        check (status in ('Open', 'Resolved', 'Escalated')),
    resolution_note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid not null references public.profiles(id),
    action text not null,
    target_type text not null,
    target_id text not null,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    recipient_id uuid not null references public.profiles(id) on delete cascade,
    sender_id uuid not null references public.profiles(id),
    title text not null check (length(title) between 1 and 120),
    message text not null check (length(message) between 1 and 2000),
    created_at timestamptz not null default now(),
    read_at timestamptz
);

create index if not exists notifications_recipient_created_idx
    on public.notifications (recipient_id, created_at desc);

create or replace function public.create_platform_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    requested_role text := new.raw_user_meta_data ->> 'role';
    metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
    generated_username text;
begin
    if requested_role not in ('job_seeker', 'institution') then
        raise exception 'Unsupported account role';
    end if;

    generated_username := coalesce(
        nullif(metadata ->> 'username', ''),
        coalesce(
        nullif(
            regexp_replace(
                left(
                    regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9._-]', '', 'g'),
                    16
                ),
                '^[._-]+|[._-]+$',
                '',
                'g'
            ),
            ''
        ),
        'user'
        )
    );
    if length(generated_username) < 3 then
        generated_username := 'user-' || left(replace(new.id::text, '-', ''), 12);
    end if;

    insert into public.profiles (
        id, role, username, full_name, email, phone,
        security_question, security_answer_hash
    ) values (
        new.id,
        requested_role,
        generated_username,
        coalesce(nullif(trim(metadata ->> 'full_name'), ''), split_part(new.email, '@', 1)),
        new.email,
        coalesce(metadata ->> 'phone', ''),
        coalesce(metadata ->> 'security_question', ''),
        coalesce(metadata ->> 'security_answer_hash', '')
    );

    if requested_role = 'job_seeker' then
        insert into public.job_seeker_details (
            id, subject, qualification, years_experience, preferred_location,
            professional_summary
        ) values (
            new.id,
            coalesce(metadata ->> 'subject', ''),
            coalesce(metadata ->> 'qualification', ''),
            case
                when coalesce(metadata ->> 'years_experience', '') ~ '^\d{1,2}$'
                then (metadata ->> 'years_experience')::integer
                else 0
            end,
            coalesce(metadata ->> 'preferred_location', ''),
            coalesce(metadata ->> 'professional_summary', '')
        );
    else
        insert into public.institution_details (
            id, institution_name, institution_type, address, contact_person,
            contact_designation, registration_number, city, state, pincode,
            website, description
        ) values (
            new.id,
            coalesce(nullif(trim(metadata ->> 'institution_name'), ''), split_part(new.email, '@', 1)),
            coalesce(metadata ->> 'institution_type', ''),
            coalesce(metadata ->> 'address', ''),
            coalesce(metadata ->> 'contact_person', ''),
            coalesce(metadata ->> 'contact_designation', ''),
            coalesce(metadata ->> 'registration_number', ''),
            coalesce(metadata ->> 'city', ''),
            coalesce(metadata ->> 'state', ''),
            coalesce(metadata ->> 'pincode', ''),
            nullif(metadata ->> 'website', ''),
            coalesce(metadata ->> 'description', '')
        );
    end if;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created_platform_profile on auth.users;
create trigger on_auth_user_created_platform_profile
after insert on auth.users
for each row execute function public.create_platform_profile();

create index if not exists profiles_role_status_idx on public.profiles(role, status);
create index if not exists vacancies_status_created_idx on public.vacancies(status, created_at desc);
create index if not exists vacancies_institution_idx on public.vacancies(institution_id);
create index if not exists applications_applicant_idx on public.applications(applicant_id, created_at desc);
create index if not exists connections_teacher_idx on public.connections(teacher_id);
create index if not exists connections_institution_idx on public.connections(institution_id);
create index if not exists complaints_reporter_idx on public.complaints(reporter_id, created_at desc);
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists vacancies_set_updated_at on public.vacancies;
create trigger vacancies_set_updated_at before update on public.vacancies
for each row execute function public.set_updated_at();

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at before update on public.applications
for each row execute function public.set_updated_at();

drop trigger if exists connections_set_updated_at on public.connections;
create trigger connections_set_updated_at before update on public.connections
for each row execute function public.set_updated_at();

drop trigger if exists complaints_set_updated_at on public.complaints;
create trigger complaints_set_updated_at before update on public.complaints
for each row execute function public.set_updated_at();

create or replace function public.protect_moderated_fields()
returns trigger
language plpgsql
as $$
begin
    if coalesce(auth.jwt() -> 'app_metadata' ->> 'platform_role', '') <> 'admin'
       and coalesce(auth.role(), '') <> 'service_role' then
        if tg_table_name = 'vacancies' then
            new.status = old.status;
        elsif tg_table_name = 'institution_details' then
            new.verified = old.verified;
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists protect_vacancy_status on public.vacancies;
create trigger protect_vacancy_status before update on public.vacancies
for each row execute function public.protect_moderated_fields();

drop trigger if exists protect_institution_verified on public.institution_details;
create trigger protect_institution_verified before update on public.institution_details
for each row execute function public.protect_moderated_fields();

alter table public.profiles enable row level security;
alter table public.account_preferences enable row level security;
alter table public.job_seeker_details enable row level security;
alter table public.institution_details enable row level security;
alter table public.institution_certificates enable row level security;
alter table public.vacancies enable row level security;
alter table public.saved_vacancies enable row level security;
alter table public.saved_teachers enable row level security;
alter table public.applications enable row level security;
alter table public.connections enable row level security;
alter table public.complaints enable row level security;
alter table public.audit_log enable row level security;
alter table public.notifications enable row level security;
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
for select to authenticated
using (id = auth.uid() or (auth.jwt() -> 'app_metadata' ->> 'platform_role') = 'admin');

drop policy if exists "profiles_insert_self_non_admin" on public.profiles;
create policy "profiles_insert_self_non_admin" on public.profiles
for insert to authenticated
with check (
    id = auth.uid()
    and role in ('job_seeker', 'institution')
    and status = 'Pending'
);

drop policy if exists "account_preferences_self" on public.account_preferences;
create policy "account_preferences_self" on public.account_preferences
for all to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists "job_seeker_details_self" on public.job_seeker_details;
create policy "job_seeker_details_self" on public.job_seeker_details
for all to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "institution_details_self" on public.institution_details;
create policy "institution_details_self" on public.institution_details
for all to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "institution_certificates_self" on public.institution_certificates;
create policy "institution_certificates_self" on public.institution_certificates
for all to authenticated
using (institution_id = auth.uid())
with check (institution_id = auth.uid());

drop policy if exists "vacancies_read_verified_or_owner" on public.vacancies;
create policy "vacancies_read_verified_or_owner" on public.vacancies
for select to anon, authenticated
using (
    status = 'Verified'
    or institution_id = auth.uid()
    or (auth.jwt() -> 'app_metadata' ->> 'platform_role') = 'admin'
);

drop policy if exists "vacancies_insert_verified_institution" on public.vacancies;
create policy "vacancies_insert_verified_institution" on public.vacancies
for insert to authenticated
with check (
    institution_id = auth.uid()
    and status = 'Pending'
    and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'institution' and p.status = 'Verified'
    )
);

drop policy if exists "vacancies_update_owner" on public.vacancies;
create policy "vacancies_update_owner" on public.vacancies
for update to authenticated
using (institution_id = auth.uid())
with check (institution_id = auth.uid());

drop policy if exists "saved_vacancies_self" on public.saved_vacancies;
create policy "saved_vacancies_self" on public.saved_vacancies
    for all to authenticated
    using (
        job_seeker_id = auth.uid()
        and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'job_seeker'
        )
    )
    with check (
        job_seeker_id = auth.uid()
        and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'job_seeker'
        )
        and exists (
            select 1 from public.vacancies v
            where v.id = vacancy_id and v.status = 'Verified'
        )
    );

drop policy if exists "saved_teachers_self" on public.saved_teachers;
create policy "saved_teachers_self" on public.saved_teachers
    for all to authenticated
    using (
        institution_id = auth.uid()
        and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'institution'
        )
    )
    with check (
        institution_id = auth.uid()
        and exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'institution'
        )
        and exists (
            select 1 from public.profiles p
            where p.id = job_seeker_id
              and p.role = 'job_seeker'
              and p.status = 'Verified'
        )
    );

drop policy if exists "applications_read_participants_or_admin" on public.applications;
create policy "applications_read_participants_or_admin" on public.applications
for select to authenticated
using (
    applicant_id = auth.uid()
    or exists (
        select 1 from public.vacancies v
        where v.id = vacancy_id and v.institution_id = auth.uid()
    )
    or (auth.jwt() -> 'app_metadata' ->> 'platform_role') = 'admin'
);

drop policy if exists "applications_insert_verified_job_seeker" on public.applications;
create policy "applications_insert_verified_job_seeker" on public.applications
for insert to authenticated
with check (
    applicant_id = auth.uid()
    and status = 'Applied'
    and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'job_seeker' and p.status = 'Verified'
    )
    and exists (
        select 1 from public.vacancies v
        where v.id = vacancy_id and v.status = 'Verified'
    )
);

drop policy if exists "applications_update_employer" on public.applications;
create policy "applications_update_employer" on public.applications
for update to authenticated
using (
    exists (
        select 1 from public.vacancies v
        where v.id = vacancy_id and v.institution_id = auth.uid()
    )
)
with check (
    exists (
        select 1 from public.vacancies v
        where v.id = vacancy_id and v.institution_id = auth.uid()
    )
);

drop policy if exists "connections_read_participants_or_admin" on public.connections;
create policy "connections_read_participants_or_admin" on public.connections
for select to authenticated
using (
    teacher_id = auth.uid()
    or institution_id = auth.uid()
    or (auth.jwt() -> 'app_metadata' ->> 'platform_role') = 'admin'
);

drop policy if exists "connections_insert_verified_participant" on public.connections;
create policy "connections_insert_verified_participant" on public.connections
for insert to authenticated
with check (
    requested_by = auth.uid()
    and status = 'Pending'
    and exists (
        select 1 from public.profiles t
        join public.profiles i on i.id = institution_id
        where t.id = teacher_id
          and t.role = 'job_seeker' and t.status = 'Verified'
          and i.role = 'institution' and i.status = 'Verified'
    )
);

drop policy if exists "complaints_read_reporter_or_admin" on public.complaints;
create policy "complaints_read_reporter_or_admin" on public.complaints
for select to authenticated
using (
    reporter_id = auth.uid()
    or (auth.jwt() -> 'app_metadata' ->> 'platform_role') = 'admin'
);

drop policy if exists "complaints_insert_self" on public.complaints;
create policy "complaints_insert_self" on public.complaints
for insert to authenticated
with check (reporter_id = auth.uid() and status = 'Open');

drop policy if exists "audit_log_admin_read" on public.audit_log;
create policy "audit_log_admin_read" on public.audit_log
for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'platform_role') = 'admin');

drop policy if exists "notifications_read_self" on public.notifications;
create policy "notifications_read_self" on public.notifications
for select to authenticated
using (recipient_id = auth.uid());

drop policy if exists "notifications_update_self" on public.notifications;
create policy "notifications_update_self" on public.notifications
for update to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
    ('resumes', 'resumes', false, 5242880, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    ('certificates', 'certificates', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "private_documents_owner_access" on storage.objects;
create policy "private_documents_owner_access" on storage.objects
for all to authenticated
using (
    bucket_id in ('resumes', 'certificates')
    and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
    bucket_id in ('resumes', 'certificates')
    and (storage.foldername(name))[1] = auth.uid()::text
);
