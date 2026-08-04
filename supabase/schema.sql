-- ============================================================
-- «Вместе» — схема для Supabase (PostgreSQL)
-- Выполните этот скрипт целиком в SQL Editor проекта Supabase.
-- Скрипт идемпотентен: можно перевыполнять после изменений.
-- ============================================================

-- SQL-функции проверяются при первом вызове, а не при создании:
-- иначе auth_couple_id (см. ниже) упадёт, если profiles ещё не создана.
set check_function_bodies = false;

-- ============================================================
-- Таблицы
-- ============================================================

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  bg text not null default '',
  created_at timestamptz not null default now()
);

alter table public.couples add column if not exists bg text default '';
alter table public.couples drop column if exists radius_m;
alter table public.couples drop column if exists window_min;
alter table public.couples drop column if exists grace_min;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Пользователь',
  avatar text not null default '🙂',
  avatar_url text default '',
  bio text default '',
  theme text not null default 'auto',
  accent text not null default '',
  autocheck boolean not null default true,
  telegram text default '',
  imessage text default '',
  couple_id uuid references public.couples(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists telegram text default '';
alter table public.profiles add column if not exists imessage text default '';
alter table public.profiles add column if not exists avatar_url text default '';
alter table public.profiles add column if not exists accent text default '';
alter table public.profiles add column if not exists autocheck boolean default true;

-- Юзернейм: начинается с @, только латиница/цифры/_/., уникален для каждого пользователя
alter table public.profiles add column if not exists username text;
create unique index if not exists idx_profiles_username on public.profiles (username) where username is not null;

-- Уникальный порядковый номер регистрации (никнейм вида #42). Выдаётся из
-- последовательности при создании профиля, потому не повторяется и не меняется.
create sequence if not exists public.profiles_reg_no_seq;
alter table public.profiles add column if not exists reg_no bigint;

-- Телефон для поиска и связи
alter table public.profiles add column if not exists phone text default '';

-- Админ-флаг: назначить админа можно только из SQL Editor, например:
--   update public.profiles set is_admin = true
--   where id = (select id from auth.users where lower(email) = 'admin@example.com');
alter table public.profiles add column if not exists is_admin boolean default false;

-- Аудит действий админа
create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_user_id uuid references public.profiles(id) on delete set null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_logs enable row level security;

-- Помощник: является ли текущий пользователь админом
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and is_admin = true
  )
$$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  title text not null,
  description text not null default '',
  scheduled_at timestamptz,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','missed','cancelled')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  edit_count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.tasks drop column if exists place_name;
alter table public.tasks drop column if exists address;
alter table public.tasks drop column if exists lat;
alter table public.tasks drop column if exists lng;
alter table public.tasks add column if not exists edit_count int not null default 0;

-- Закреплённые события (булавка) и ручной порядок в списке предстоящих.
-- Пинается любое событие: закреплённые всегда вверху; sort_order задаёт порядок
-- внутри группы (renumber выполняется на сервере при каждом действии).
alter table public.tasks add column if not exists is_pinned boolean not null default false;
alter table public.tasks add column if not exists sort_order double precision;

-- Комментарии к планам удалены (drop table после предыдущих версий)
drop table if exists public.comments cascade;

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  arrived_at timestamptz not null default now(),
  unique(task_id, user_id)
);

alter table public.checkins drop column if exists lat;
alter table public.checkins drop column if exists lng;
alter table public.checkins drop column if exists accuracy;

create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  type text not null check (type in ('delete','reschedule','edit')),
  proposed_value text,
  proposed_title text,
  proposed_description text,
  requested_by uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.agreements add column if not exists proposed_title text;
alter table public.agreements add column if not exists proposed_description text;
alter table public.agreements drop constraint if exists agreements_type_check;
alter table public.agreements add constraint agreements_type_check check (type in ('delete','reschedule','edit'));

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  score int not null check (score between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  unique(task_id, user_id)
);

create index if not exists idx_tasks_couple on public.tasks(couple_id);
create index if not exists idx_checkins_task on public.checkins(task_id);
create index if not exists idx_agreements_task on public.agreements(task_id);
create index if not exists idx_ratings_task on public.ratings(task_id);

-- Запросы на создание пары: один находит другого по имени и отправляет запрос,
-- второй соглашается или отказывается.
create table if not exists public.couple_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

alter table public.couple_requests add column if not exists responded_at timestamptz;
create index if not exists idx_requests_from on public.couple_requests(from_id);
create index if not exists idx_requests_to on public.couple_requests(to_id);
-- Не более одного активного запроса между парой (в любую сторону) — защита от гонки
create unique index if not exists idx_requests_pending_pair
  on public.couple_requests (greatest(from_id, to_id), least(from_id, to_id))
  where status = 'pending';

-- Чат между партнёрами удалён (drop table после предыдущих версий)
drop table if exists public.messages cascade;

-- id пары текущего пользователя
create or replace function public.auth_couple_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select couple_id from public.profiles where id = auth.uid()
$$;

-- ============================================================
-- RLS: читать можно только свою пару, писать — только через функции
-- ============================================================

alter table public.couples enable row level security;
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.checkins enable row level security;
alter table public.agreements enable row level security;
alter table public.ratings enable row level security;
alter table public.couple_requests enable row level security;

drop policy if exists "requests_select" on public.couple_requests;
create policy "requests_select" on public.couple_requests
  for select to authenticated using (from_id = auth.uid() or to_id = auth.uid());

drop policy if exists "couples_select" on public.couples;
create policy "couples_select" on public.couples
  for select to authenticated using (id = auth_couple_id());

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (id = auth.uid() or couple_id = auth_couple_id());

drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks
  for select to authenticated using (couple_id = auth_couple_id());

drop policy if exists "checkins_select" on public.checkins;
create policy "checkins_select" on public.checkins
  for select to authenticated using (task_id in (select id from public.tasks where couple_id = auth_couple_id()));

drop policy if exists "agreements_select" on public.agreements;
create policy "agreements_select" on public.agreements
  for select to authenticated using (task_id in (select id from public.tasks where couple_id = auth_couple_id()));

drop policy if exists "ratings_select" on public.ratings;
create policy "ratings_select" on public.ratings
  for select to authenticated using (task_id in (select id from public.tasks where couple_id = auth_couple_id()));

-- ============================================================
-- Представления (jsonb)
-- ============================================================

create or replace function public.profile_view(p_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'avatar', p.avatar, 'avatar_url', p.avatar_url,
    'username', p.username, 'nick', case when p.reg_no is not null then '#' || p.reg_no else null end,
    'phone', p.phone, 'is_admin', p.is_admin,
    'bio', p.bio, 'theme', p.theme,
    'accent', p.accent, 'autocheck', p.autocheck,
    'telegram', p.telegram, 'imessage', p.imessage
  )
  from public.profiles p where p.id = p_id
$$;

create or replace function public.couple_view(p_couple_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', c.id,
    'invite_code', c.invite_code,
    'bg', c.bg,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'avatar', p.avatar, 'avatar_url', p.avatar_url,
        'username', p.username, 'nick', case when p.reg_no is not null then '#' || p.reg_no else null end,
        'phone', p.phone,
        'bio', p.bio, 'theme', p.theme,
        'accent', p.accent, 'autocheck', p.autocheck,
        'telegram', p.telegram, 'imessage', p.imessage
      ) order by p.created_at)
      from public.profiles p where p.couple_id = c.id
    ), '[]'::jsonb)
  )
  from public.couples c where c.id = p_couple_id
$$;

create or replace function public.task_view(p_task_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', t.id,
    'couple_id', t.couple_id,
    'title', t.title,
    'description', t.description,
    'scheduled_at', t.scheduled_at,
    'status', t.status,
    'created_by', t.created_by,
    'created_at', t.created_at,
    'completed_at', t.completed_at,
    'updated_at', t.updated_at,
    'edit_count', t.edit_count,
    'is_pinned', t.is_pinned,
    'sort_order', t.sort_order,
    'checkins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', k.id, 'task_id', k.task_id, 'user_id', k.user_id, 'arrived_at', k.arrived_at
      ))
      from public.checkins k where k.task_id = t.id
    ), '[]'::jsonb),
    'agreements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'task_id', a.task_id, 'type', a.type,
        'proposed_value', a.proposed_value, 'proposed_title', a.proposed_title,
        'proposed_description', a.proposed_description, 'requested_by', a.requested_by,
        'status', a.status, 'decided_at', a.decided_at, 'created_at', a.created_at,
        'requester_name', p.name
      ) order by a.created_at desc)
      from public.agreements a join public.profiles p on p.id = a.requested_by
      where a.task_id = t.id
    ), '[]'::jsonb),
    'ratings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'task_id', r.task_id, 'user_id', r.user_id,
        'score', r.score, 'comment', r.comment, 'created_at', r.created_at
      ))
      from public.ratings r where r.task_id = t.id
    ), '[]'::jsonb)
  )
  from public.tasks t where t.id = p_task_id
$$;

-- ============================================================
-- Бизнес-функции (RPC)
-- ============================================================

-- Отметить просроченные планы как «пропущено».
-- НЕ привязано к auth.uid(): вызывается и pg_cron-планировщиком (там auth.uid() = null,
-- иначе функция «не видела» ни одной задачи), и из check_in. Правило глобальное:
-- задача в planned/in_progress, просроченная более чем на 2 часа, помечается missed.
create or replace function public.sweep_missed()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r record;
begin
  for r in
    update public.tasks t
    set status = 'missed', updated_at = now()
    where t.status in ('planned','in_progress')
      and t.scheduled_at is not null
      and t.scheduled_at + interval '2 hours' < now()
    returning t.id, t.title, t.created_by, t.couple_id
  loop
    -- уведомляем создателя (cron вызывает без auth.uid(), поэтому is distinct from)
    if r.created_by is distinct from auth.uid() then
      perform public.notify_user(
        r.created_by, r.couple_id, 'task_missed', r.id,
        r.title, format('⏰ Событие «%s» пропущено', r.title),
        jsonb_build_object('task_id', r.id)
      );
    end if;
  end loop;
end
$$;

create or replace function public.get_me()
returns jsonb
language sql security definer set search_path = public
as $$
  select jsonb_build_object(
    'user', public.profile_view(auth.uid()),
    'couple', case when public.auth_couple_id() is null then null else public.couple_view(public.auth_couple_id()) end
  )
$$;

-- Создание пары / присоединение по коду
create or replace function public.join_or_create_couple(p_invite text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_couple public.couples;
  v_count int;
  v_code text;
begin
  if public.auth_couple_id() is not null then
    raise exception 'Вы уже в паре. Чтобы сменить пару, напишите в поддержку';
  end if;
  if p_invite is not null and btrim(p_invite) <> '' then
    -- for update: исключаем гонку, когда двое одновременно присоединяются по коду
    select * into v_couple from public.couples where invite_code = upper(btrim(p_invite)) for update;
    if not found then
      raise exception 'Код приглашения не найден';
    end if;
    select count(*) into v_count from public.profiles where couple_id = v_couple.id;
    if v_count >= 2 then
      raise exception 'В этой паре уже два человека';
    end if;
    update public.profiles set couple_id = v_couple.id where id = auth.uid();
  else
    loop
      v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
      begin
        insert into public.couples (invite_code) values (upper(v_code)) returning * into v_couple;
        exit;
      exception when unique_violation then
        continue;
      end;
    end loop;
    update public.profiles set couple_id = v_couple.id where id = auth.uid();
  end if;
  return public.couple_view(v_couple.id);
end
$$;

-- Профиль (вызывается после signUp)
create or replace function public.create_profile(p_name text)
returns jsonb
language sql security definer set search_path = public
as $$
  insert into public.profiles (id, name, reg_no)
  values (
    auth.uid(),
    coalesce(nullif(btrim(p_name), ''), 'Пользователь'),
    nextval('public.profiles_reg_no_seq')
  )
  on conflict (id) do update set name = excluded.name
  returning public.profile_view(id)
$$;

-- Убираем все старые сигнатуры update_profile (с и без p_accent), иначе при
-- вызове с частью аргументов Postgres не сможет выбрать между перегрузками.
do $$ declare r record; begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'update_profile'
  loop
    execute 'drop function ' || r.sig || ' cascade';
  end loop;
end $$;

create or replace function public.update_profile(
  p_name text default null, p_avatar text default null,
  p_avatar_url text default null,
  p_bio text default null, p_theme text default null,
  p_accent text default null, p_autocheck boolean default null,
  p_telegram text default null, p_imessage text default null,
  p_username text default null, p_phone text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_username text;
begin
  if p_name is not null and btrim(p_name) <> '' and length(btrim(p_name)) > 40 then
    raise exception 'Имя слишком длинное (до 40 символов)';
  end if;
  if length(coalesce(p_bio, '')) > 200 then
    raise exception 'Описание слишком длинное (до 200 символов)';
  end if;
  if length(coalesce(p_avatar_url, '')) > 500 then
    raise exception 'Ссылка на фото слишком длинная';
  end if;
  if p_avatar_url is not null and p_avatar_url <> ''
     and not (p_avatar_url ~ '^https?://[^"''<>()\\ ]+$'
              or p_avatar_url ~ '^data:image/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$'
              or p_avatar_url ~ '^/object/public/')
  then
    raise exception 'Недопустимая ссылка на фото';
  end if;
  if length(coalesce(p_telegram, '')) > 60 or length(coalesce(p_imessage, '')) > 100 then
    raise exception 'Недопустимые контакты';
  end if;
  if length(coalesce(p_phone, '')) > 30 then
    raise exception 'Недопустимый номер телефона';
  end if;
  if p_username is not null then
    v_username := lower(btrim(p_username));
    if v_username = '' then
      raise exception 'Укажите юзернейм';
    end if;
    if v_username !~ '^@[a-z0-9_.]{1,24}$' then
      raise exception 'Юзернейм должен начинаться с @ и состоять из латинских букв, цифр, _ и .';
    end if;
    if exists (
      select 1 from public.profiles
      where username = v_username and id <> auth.uid()
    ) then
      raise exception 'Этот юзернейм уже занят';
    end if;
    update public.profiles set username = v_username where id = auth.uid();
  end if;

  update public.profiles set
    name = coalesce(nullif(btrim(p_name), ''), name),
    avatar = coalesce(p_avatar, avatar),
    avatar_url = coalesce(p_avatar_url, avatar_url),
    bio = coalesce(p_bio, bio),
    theme = coalesce(p_theme, theme),
    accent = coalesce(p_accent, accent),
    autocheck = case when p_autocheck is not null then p_autocheck else autocheck end,
    telegram = coalesce(btrim(p_telegram), telegram),
    imessage = coalesce(btrim(p_imessage), imessage),
    phone = coalesce(btrim(p_phone), phone)
  where id = auth.uid();

  return public.profile_view(auth.uid());
end
$$;

-- Проверка свободен ли юзернейм (для живой проверки в профиле)
create or replace function public.check_username(p_username text)
returns jsonb
language sql security definer set search_path = public
as $$
  select jsonb_build_object(
    'username', coalesce(lower(btrim(p_username)), ''),
    'available', not exists (
      select 1 from public.profiles
      where username = lower(btrim(p_username)) and id <> auth.uid()
    )
  )
$$;

create or replace function public.get_tasks()
returns jsonb
language sql security definer set search_path = public
as $$
  select coalesce(
    jsonb_agg(public.task_view(t.id)
      order by t.is_pinned desc, t.sort_order nulls last, t.scheduled_at asc, t.id),
    '[]'::jsonb
  )
  from public.tasks t
  where t.couple_id = public.auth_couple_id()
$$;

-- Одна задача (для обновления по Realtime)
create or replace function public.get_task(p_task_id uuid)
returns jsonb
language sql security definer set search_path = public
as $$
  select public.task_view(t.id)
  from public.tasks t
  where t.id = p_task_id and t.couple_id = public.auth_couple_id()
$$;

-- Удаление аккаунта: пара и общие данные партнёра НЕ удаляются. Пользователь
-- выходит из пары (couple_id = null), а события, созданные им, передаются партнёру,
-- чтобы не нарушить ссылки на profiles.created_by. Если партнёра в паре нет —
-- пара осиротела и удаляется вместе с каскадом данных.
create or replace function public.delete_account()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_couple_id uuid := public.auth_couple_id();
  v_partner uuid;
begin
  delete from public.couple_requests where from_id = auth.uid() or to_id = auth.uid();
  delete from public.checkins where user_id = auth.uid();
  delete from public.ratings where user_id = auth.uid();
  delete from public.agreements where requested_by = auth.uid();
  if v_couple_id is not null then
    select id into v_partner from public.profiles
    where couple_id = v_couple_id and id <> auth.uid()
    limit 1;
    if v_partner is not null then
      update public.tasks set created_by = v_partner where created_by = auth.uid();
      update public.profiles set couple_id = null where id = auth.uid();
    else
      delete from public.couples where id = v_couple_id;
    end if;
  end if;
  delete from auth.users where id = auth.uid();
end
$$;

create or replace function public.get_stats()
returns jsonb
language sql security definer set search_path = public
as $$
  select jsonb_build_object(
    'completed', count(*) filter (where t.status = 'completed'),
    'missed', count(*) filter (where t.status = 'missed'),
    'cancelled', count(*) filter (where t.status = 'cancelled'),
    'stale', count(*) filter (
      where t.status in ('planned','in_progress','missed')
        and t.scheduled_at is not null
        and t.scheduled_at < now() - interval '1 month'
    ),
    'edited', coalesce(sum(t.edit_count), 0),
    'avgRating', (
      select round(avg(r.score)::numeric, 1)
      from public.ratings r
      where r.task_id in (select id from public.tasks where couple_id = public.auth_couple_id())
    )
  )
  from public.tasks t
  where t.couple_id = public.auth_couple_id()
$$;

-- Убираем ВСЕ перегрузки create_task (и старую с гео-полями),
-- иначе Postgres не сможет выбрать между ними при вызове.
drop function if exists public.create_task(text, text, text, text, double precision, double precision, timestamptz) cascade;
drop function if exists public.create_task(text, text, text, text, double precision, double precision) cascade;
drop function if exists public.create_task(text, text, timestamptz) cascade;
drop function if exists public.create_task(text, text) cascade;
drop function if exists public.create_task(text) cascade;

-- Финальная страховка: удаляем все оставшиеся функции с именем create_task,
-- какие бы сигнатуры у них ни были.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_task'
  loop
    execute 'drop function ' || r.sig || ' cascade';
  end loop;
end $$;

create or replace function public.create_task(
  p_title text, p_description text default '', p_scheduled_at timestamptz default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_couple_id uuid := public.auth_couple_id();
  v_task public.tasks;
begin
  if v_couple_id is null then raise exception 'Вы не в паре'; end if;
  if p_title is null or btrim(p_title) = '' then raise exception 'Укажите название'; end if;
  if p_scheduled_at is not null and p_scheduled_at < now() - interval '1 minute' then
    raise exception 'Время уже прошло, выберите будущее';
  end if;
  insert into public.tasks (couple_id, title, description, scheduled_at, created_by)
  values (v_couple_id, btrim(p_title), coalesce(p_description,''), p_scheduled_at, auth.uid())
  returning * into v_task;
  perform public.notify_partner(
    v_couple_id, auth.uid(), 'task_created', v_task.id,
    v_task.title, format('📅 Новое событие: «%s»', v_task.title),
    jsonb_build_object('task_id', v_task.id)
  );
  return public.task_view(v_task.id);
end
$$;

-- Закрепление / открепление события. Переупорядочивает список предстоящих:
-- сперва идут закреплённые, затем остальные — по времени. После каждого действия
-- всей группе присваивается сквозной sort_order (1..n), чтобы порядок был
-- одинаковым у обоих партнёров и перемещения были стабильными.
create or replace function public.set_task_pin(p_task_id uuid, p_pinned boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_couple_id uuid := public.auth_couple_id();
  v_task public.tasks;
  v_pinned uuid[] := '{}';
  v_unpinned uuid[] := '{}';
  v_ids uuid[] := '{}';
  v_n int := 0;
  v_id uuid;
  r record;
begin
  select * into v_task from public.tasks where id = p_task_id and couple_id = v_couple_id;
  if not found then raise exception 'Задача не найдена'; end if;
  if v_task.status not in ('planned','in_progress') then
    raise exception 'Закрепить можно только предстоящее событие';
  end if;

  update public.tasks set is_pinned = p_pinned, updated_at = now() where id = p_task_id;

  -- стабильный порядок внутри каждой группы: сначала закреплённые, затем остальные
  for r in
    select id from public.tasks
    where couple_id = v_couple_id and status in ('planned','in_progress') and is_pinned
    order by sort_order nulls last, scheduled_at asc, id
  loop v_pinned := v_pinned || r.id; end loop;
  for r in
    select id from public.tasks
    where couple_id = v_couple_id and status in ('planned','in_progress') and not is_pinned
    order by sort_order nulls last, scheduled_at asc, id
  loop v_unpinned := v_unpinned || r.id; end loop;
  v_ids := v_pinned || v_unpinned;

  foreach v_id in array v_ids loop
    v_n := v_n + 1;
    update public.tasks set sort_order = v_n where id = v_id;
  end loop;

  return public.get_tasks();
end
$$;

-- Перемещение предстоящего события вверх/вниз на одну позицию (в пределах своей
-- группы закреплённых/незакреплённых). Стабильный промежуточный порядок: тот же,
-- что у get_tasks. Синхронизация с партнёром — через Realtime (task:update).
create or replace function public.move_task(p_task_id uuid, p_up boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_couple_id uuid := public.auth_couple_id();
  v_task public.tasks;
  v_ids uuid[] := '{}';
  v_i int := 0;
  v_j int;
  v_pos int;
  v_tmp uuid;
  v_n int := 0;
  v_id uuid;
  r record;
begin
  select * into v_task from public.tasks where id = p_task_id and couple_id = v_couple_id;
  if not found then raise exception 'Задача не найдена'; end if;
  if v_task.status not in ('planned','in_progress') then
    raise exception 'Переставлять можно только предстоящие события';
  end if;

  -- упорядоченный список предстоящих (пины первыми)
  for r in
    select id from public.tasks
    where couple_id = v_couple_id and status in ('planned','in_progress')
    order by is_pinned desc, sort_order nulls last, scheduled_at asc, id
  loop v_ids := v_ids || r.id; end loop;

  if array_length(v_ids, 1) < 2 then return public.get_tasks(); end if;

  -- позиция цели и соседа
  for v_pos in 1..array_length(v_ids, 1) loop
    if v_ids[v_pos] = p_task_id then v_i := v_pos; exit; end if;
  end loop;
  v_j := case when p_up then v_i - 1 else v_i + 1 end;
  if v_i = 0 or v_j < 1 or v_j > array_length(v_ids, 1) then
    return public.get_tasks();
  end if;

  -- не пересекаем границу закреплённых/незакреплённых
  if (select is_pinned from public.tasks where id = v_ids[v_i])
     <> (select is_pinned from public.tasks where id = v_ids[v_j]) then
    return public.get_tasks();
  end if;

  v_tmp := v_ids[v_i]; v_ids[v_i] := v_ids[v_j]; v_ids[v_j] := v_tmp;

  -- пересчитать сквозной порядок, чтобы он был одинаковым у обоих партнёров
  foreach v_id in array v_ids loop
    v_n := v_n + 1;
    update public.tasks set sort_order = v_n where id = v_id;
  end loop;

  return public.get_tasks();
end
$$;

-- Приход: просто кнопка, без геолокации. Когда оба отметились — план выполнен.
create or replace function public.check_in(p_task_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_couple_id uuid := public.auth_couple_id();
  v_task public.tasks;
  v_partner uuid;
  v_exists int;
  v_status text;
begin
  select * into v_task from public.tasks where id = p_task_id and couple_id = v_couple_id;
  if not found then raise exception 'Задача не найдена'; end if;

  perform public.sweep_missed();
  select * into v_task from public.tasks where id = p_task_id;

  if v_task.status = 'completed' then raise exception 'Вы уже встретились!'; end if;
  if v_task.status = 'cancelled' then raise exception 'Задача отменена'; end if;
  if v_task.status = 'missed' then raise exception 'План пропущен'; end if;

  insert into public.checkins (task_id, user_id)
  values (p_task_id, auth.uid())
  on conflict (task_id, user_id) do update set arrived_at = now();

  select id into v_partner from public.profiles
  where couple_id = v_couple_id and id <> auth.uid() limit 1;

  select count(*) into v_exists from public.checkins
  where task_id = p_task_id and user_id = v_partner;

  if v_exists > 0 then
    v_status := 'completed';
    update public.tasks set status = 'completed', completed_at = now(), updated_at = now() where id = p_task_id;
    perform public.notify_user(
      v_partner, v_couple_id, 'task_completed', p_task_id, v_task.title,
      format('✅ Событие «%s» выполнено!', v_task.title),
      jsonb_build_object('task_id', p_task_id)
    );
  else
    v_status := 'in_progress';
    update public.tasks set status = 'in_progress', updated_at = now() where id = p_task_id;
    perform public.notify_user(
      v_partner, v_couple_id, 'checkin', p_task_id, v_task.title,
      format('📍 %s на месте: «%s»', (select p2.name from public.profiles p2 where p2.id = auth.uid()), v_task.title),
      jsonb_build_object('task_id', p_task_id, 'user_id', auth.uid())
    );
  end if;

  return jsonb_build_object(
    'success', v_status = 'completed',
    'message', case when v_status = 'completed' then 'Вы встретились! План выполнен' else 'Вы отмечены как пришедший' end,
    'task', public.task_view(p_task_id)
  );
end
$$;

-- Запрос на перенос/удаление (нужно согласие второго)
create or replace function public.request_agreement(
  p_task_id uuid, p_type text, p_proposed_value timestamptz default null,
  p_proposed_title text default null, p_proposed_description text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_couple_id uuid := public.auth_couple_id();
  v_task public.tasks;
  v_pending int;
begin
  select * into v_task from public.tasks where id = p_task_id and couple_id = v_couple_id;
  if not found then raise exception 'Задача не найдена'; end if;
  if v_task.status in ('completed','cancelled') then raise exception 'Задачу нельзя изменить'; end if;
  if p_type not in ('delete','reschedule','edit') then raise exception 'Неверный тип'; end if;
  if p_type = 'reschedule' and p_proposed_value is null then raise exception 'Укажите новое время'; end if;
  if p_type = 'edit' then
    if (p_proposed_title is null or btrim(p_proposed_title) = '') and p_proposed_value is null then
      raise exception 'Нечего менять';
    end if;
  end if;
  select count(*) into v_pending from public.agreements where task_id = p_task_id and status = 'pending';
  if v_pending > 0 then raise exception 'Запрос уже отправлен и ждёт ответа'; end if;
  insert into public.agreements (task_id, type, proposed_value, proposed_title, proposed_description, requested_by)
  values (
    p_task_id, p_type,
    case when p_type in ('reschedule','edit') then p_proposed_value::text else null end,
    case when p_type = 'edit' then nullif(btrim(p_proposed_title), '') else null end,
    case when p_type = 'edit' then nullif(btrim(coalesce(p_proposed_description, '')), '') else null end,
    auth.uid()
  );
  update public.tasks set updated_at = now() where id = p_task_id;
  perform public.notify_partner(
    v_couple_id, auth.uid(), 'agreement', p_task_id, v_task.title,
    format('💬 %s предлагает %s: «%s»',
      (select p2.name from public.profiles p2 where p2.id = auth.uid()),
      case when p_type = 'delete' then 'удалить событие'
           when p_type = 'reschedule' then 'перенести событие'
           else 'изменить событие' end,
      v_task.title),
    jsonb_build_object('task_id', p_task_id)
  );
  return public.task_view(p_task_id);
end
$$;

create or replace function public.respond_agreement(p_agreement_id uuid, p_approve boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_couple_id uuid := public.auth_couple_id();
  v_agreement public.agreements;
  v_task public.tasks;
begin
  select * into v_agreement from public.agreements where id = p_agreement_id;
  if not found then raise exception 'Запрос не найден'; end if;
  select * into v_task from public.tasks where id = v_agreement.task_id;
  if v_task.couple_id <> v_couple_id then raise exception 'Запрос не найден'; end if;
  if v_agreement.requested_by = auth.uid() then raise exception 'Вы сами создали этот запрос'; end if;
  if v_agreement.status <> 'pending' then raise exception 'Запрос уже обработан'; end if;

  update public.agreements
  set status = case when p_approve then 'approved' else 'rejected' end, decided_at = now()
  where id = p_agreement_id;

  if p_approve then
    if v_agreement.type = 'delete' then
      update public.tasks set status = 'cancelled', updated_at = now() where id = v_task.id;
    elsif v_agreement.type = 'reschedule' then
      update public.tasks
      set scheduled_at = v_agreement.proposed_value::timestamptz, status = 'planned',
          edit_count = edit_count + 1, updated_at = now()
      where id = v_task.id;
    elsif v_agreement.type = 'edit' then
      update public.tasks
      set
        title = coalesce(v_agreement.proposed_title, v_task.title),
        description = coalesce(v_agreement.proposed_description, v_task.description),
        scheduled_at = case
          when v_agreement.proposed_value is not null then v_agreement.proposed_value::timestamptz
          else v_task.scheduled_at
        end,
        edit_count = edit_count + 1,
        updated_at = now()
      where id = v_task.id;
    end if;
  end if;

  update public.tasks set updated_at = now() where id = v_task.id;
  perform public.notify_user(
    v_agreement.requested_by, v_task.couple_id, 'agreement_decision', v_task.id, v_task.title,
    case
      when p_approve and v_agreement.type = 'delete' then format('✅ Событие «%s» удалено', v_task.title)
      when p_approve and v_agreement.type = 'reschedule' then format('✅ Событие «%s» перенесено', v_task.title)
      when p_approve then format('✅ Изменения по «%s» приняты', v_task.title)
      else format('❌ Запрос по «%s» отклонён', v_task.title)
    end,
    jsonb_build_object('task_id', v_task.id, 'approved', p_approve, 'type', v_agreement.type)
  );
  return public.task_view(v_task.id);
end
$$;

create or replace function public.cancel_agreement(p_agreement_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_agreement public.agreements;
begin
  select * into v_agreement from public.agreements where id = p_agreement_id;
  if not found then raise exception 'Запрос не найден'; end if;
  if v_agreement.requested_by <> auth.uid() then raise exception 'Отменить может только автор запроса'; end if;
  if v_agreement.status <> 'pending' then raise exception 'Запрос уже обработан'; end if;
  update public.agreements set status = 'cancelled', decided_at = now() where id = p_agreement_id;
  update public.tasks set updated_at = now() where id = v_agreement.task_id;
  return public.task_view(v_agreement.task_id);
end
$$;

create or replace function public.rate_task(p_task_id uuid, p_score int, p_comment text default '')
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_couple_id uuid := public.auth_couple_id();
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task_id and couple_id = v_couple_id;
  if not found then raise exception 'Задача не найдена'; end if;
  if v_task.status <> 'completed' then raise exception 'Можно оценить только после встречи'; end if;
  if p_score < 1 or p_score > 5 then raise exception 'Оценка от 1 до 5'; end if;
  insert into public.ratings (task_id, user_id, score, comment)
  values (p_task_id, auth.uid(), p_score, coalesce(p_comment, ''))
  on conflict (task_id, user_id) do update
    set score = excluded.score, comment = excluded.comment;
  update public.tasks set updated_at = now() where id = p_task_id;
  perform public.notify_partner(
    v_couple_id, auth.uid(), 'rating', p_task_id, v_task.title,
    format('⭐ %s оценил «%s»', (select p2.name from public.profiles p2 where p2.id = auth.uid()), v_task.title),
    jsonb_build_object('task_id', p_task_id, 'score', p_score)
  );
  return public.task_view(p_task_id);
end
$$;

-- Убираем старые сигнатуры с радиусом/окном/запасом (удалены вместе с геолокацией).
drop function if exists public.update_couple_settings(integer, integer, integer);
drop function if exists public.update_couple_settings(integer, integer, integer, text);

create or replace function public.update_couple_settings(p_bg text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_bg text := btrim(coalesce(p_bg, ''));
begin
  if v_bg <> '' then
    -- Фон вставляется в CSS как url("..."), поэтому не пускаем произвольные строки.
    -- Клиент всегда шлёт data: (jpeg из canvas) либо, при желании, https-ссылку.
    -- Разрешаем только строгий data-URL или https без кавычек/скобок/кавычек.
    if length(v_bg) > 200000 then
      raise exception 'Фон слишком большой';
    end if;
    if not (v_bg ~ '^data:image/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$')
       and not (v_bg ~ '^https?://[^"''<>()\\ ]+$')
    then
      raise exception 'Недопустимый фон';
    end if;
  end if;
  update public.couples set
    bg = v_bg
  where id = public.auth_couple_id()
  returning public.couple_view(id);
end
$$;

-- ============================================================
-- Поиск и создание пары по запросам (вместо кода приглашения)
-- ============================================================

create or replace function public.request_view(p_request_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id, 'from_id', r.from_id, 'to_id', r.to_id, 'status', r.status,
    'created_at', r.created_at,
    'from', jsonb_build_object('id', f.id, 'name', f.name, 'username', f.username, 'nick', case when f.reg_no is not null then '#' || f.reg_no else null end, 'avatar', f.avatar, 'avatar_url', f.avatar_url),
    'to', jsonb_build_object('id', t.id, 'name', t.name, 'username', t.username, 'nick', case when t.reg_no is not null then '#' || t.reg_no else null end, 'avatar', t.avatar, 'avatar_url', t.avatar_url)
  )
  from public.couple_requests r
  join public.profiles f on f.id = r.from_id
  join public.profiles t on t.id = r.to_id
  where r.id = p_request_id
$$;

create or replace function public.get_my_requests()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(public.request_view(r.id) order by r.created_at desc), '[]'::jsonb)
  from public.couple_requests r
  where (r.from_id = auth.uid() or r.to_id = auth.uid())
    and r.status = 'pending'
$$;

-- Поиск людей: по юзернейму (@login и потом после @), по имени, по телефону
-- и по порядковому номеру регистрации (#N). Исключаем себя и тех, кто уже в паре.
create or replace function public.search_users(p_query text default null)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_q text := lower(btrim(coalesce(p_query, '')));
  v_q_user text := replace(v_q, '@', '');
  v_q_digits text := regexp_replace(v_q, '\D', '', 'g');
begin
  if v_q = '' then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'username', p.username,
      'nick', case when p.reg_no is not null then '#' || p.reg_no else null end,
      'avatar', p.avatar, 'avatar_url', p.avatar_url
    ) order by p.reg_no nulls last)
    from public.profiles p
    where p.id <> auth.uid()
      and p.couple_id is null
      and (
        replace(lower(coalesce(p.username, '')), '@', '') ilike '%' || v_q_user || '%'
        or lower(p.name) ilike v_q_user || '%'
        or (v_q_digits <> '' and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || v_q_digits || '%')
        or (p.reg_no is not null and v_q_digits <> '' and p.reg_no::text = v_q_digits)
      )
    limit 20
  ), '[]'::jsonb);
end
$$;

create or replace function public.send_couple_request(p_to_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_target public.profiles;
  v_existing int;
  v_new public.couple_requests;
begin
  if p_to_id is null then raise exception 'Выберите пользователя'; end if;
  if p_to_id = auth.uid() then raise exception 'Нельзя отправить запрос себе'; end if;
  if public.auth_couple_id() is not null then raise exception 'Вы уже в паре'; end if;
  select * into v_target from public.profiles where id = p_to_id;
  if not found then raise exception 'Пользователь не найден'; end if;
  if v_target.couple_id is not null then raise exception 'Этот человек уже в паре'; end if;
  select count(*) into v_existing from public.couple_requests
  where ((from_id = auth.uid() and to_id = p_to_id) or (from_id = p_to_id and to_id = auth.uid()))
    and status = 'pending';
  if v_existing > 0 then raise exception 'Запрос уже отправлен'; end if;
  begin
    insert into public.couple_requests (from_id, to_id)
    values (auth.uid(), p_to_id)
    returning * into v_new;
  exception when unique_violation then
    -- гонка: параллельный запрос уже вставлен — отвечаем понятной ошибкой
    raise exception 'Запрос уже отправлен';
  end;
  perform public.notify_user(
    p_to_id, null, 'couple_request', null,
    (select p.name from public.profiles p where p.id = auth.uid()),
    format('💌 %s хочет быть в паре с вами', (select p.name from public.profiles p where p.id = auth.uid())),
    jsonb_build_object('from_id', auth.uid())
  );
  return public.request_view(v_new.id);
end
$$;

create or replace function public.respond_couple_request(p_request_id uuid, p_approve boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_req public.couple_requests;
  v_couple uuid;
begin
  select * into v_req from public.couple_requests where id = p_request_id;
  if not found then raise exception 'Запрос не найден'; end if;
  if v_req.to_id <> auth.uid() then raise exception 'Отвечать может только тот, кому отправили запрос'; end if;
  if v_req.status <> 'pending' then raise exception 'Запрос уже обработан'; end if;
  if p_approve then
    -- Сериализуем одновременные ответы: блокируем профили обеих сторон в
    -- фиксированном (лексикографическом) порядке, чтобы не было гонки/дедлоков.
    if auth.uid()::text < v_req.from_id::text then
      perform 1 from public.profiles where id = auth.uid() for update;
      perform 1 from public.profiles where id = v_req.from_id for update;
    else
      perform 1 from public.profiles where id = v_req.from_id for update;
      perform 1 from public.profiles where id = auth.uid() for update;
    end if;
    if public.auth_couple_id() is not null then raise exception 'Вы уже в паре'; end if;
    if (select couple_id from public.profiles where id = v_req.from_id) is not null then
      raise exception 'Отправитель уже в паре';
    end if;
    insert into public.couples (invite_code)
    values (upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)))
    returning id into v_couple;
    update public.profiles set couple_id = v_couple where id in (v_req.from_id, v_req.to_id);
    update public.couple_requests set status = 'accepted', responded_at = now() where id = p_request_id;
    update public.couple_requests set status = 'declined', responded_at = now()
    where status = 'pending' and (from_id in (v_req.from_id, v_req.to_id) or to_id in (v_req.from_id, v_req.to_id));
    perform public.notify_user(
      v_req.from_id, v_couple, 'couple_request_response', null,
      (select p.name from public.profiles p where p.id = auth.uid()),
      format('💚 %s принял(а) запрос — вы в паре!', (select p.name from public.profiles p where p.id = auth.uid())),
      jsonb_build_object('request_id', p_request_id)
    );
    return jsonb_build_object('couple', public.couple_view(v_couple));
  else
    update public.couple_requests set status = 'declined', responded_at = now() where id = p_request_id;
    perform public.notify_user(
      v_req.from_id, null, 'couple_request_response', null,
      (select p.name from public.profiles p where p.id = auth.uid()),
      format('💔 %s отклонил(а) ваш запрос', (select p.name from public.profiles p where p.id = auth.uid())),
      jsonb_build_object('request_id', p_request_id)
    );
    return jsonb_build_object('couple', null);
  end if;
end
$$;

create or replace function public.cancel_couple_request(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_req public.couple_requests;
begin
  select * into v_req from public.couple_requests where id = p_request_id;
  if not found then raise exception 'Запрос не найден'; end if;
  if v_req.from_id <> auth.uid() then raise exception 'Отменить может только отправитель'; end if;
  if v_req.status <> 'pending' then raise exception 'Запрос уже обработан'; end if;
  update public.couple_requests set status = 'cancelled', responded_at = now() where id = p_request_id;
  return jsonb_build_object('ok', true);
end
$$;

-- Разрыв пары: любой из двоих может. Планы и общие данные удаляются,
-- оба снова становятся «одиноки» и могут приглашать других.
create or replace function public.break_up_couple()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_couple_id uuid := public.auth_couple_id();
begin
  if v_couple_id is null then raise exception 'Вы не в паре'; end if;
  update public.couple_requests set status = 'declined', responded_at = now()
  where status = 'pending' and (from_id = auth.uid() or to_id = auth.uid());
  delete from public.couples where id = v_couple_id;
  return jsonb_build_object('ok', true);
end
$$;

-- ============================================================
-- Права
-- ============================================================

-- Доступ только для авторизованных: все функции и таблицы безопасны благодаря
-- security definer + явным проверкам auth.uid()/is_admin(). Анонимам (не вошедшим)
-- убираем право читать таблицы и вызывать функции — они аутентифицируются через
-- GoTrue, функционала в public им не нужно. Usage на схему оставляем (его требует
-- PostgREST при интроспекции).
grant usage on schema public to anon, authenticated;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
grant execute on all functions in schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant select, usage on all sequences in schema public to authenticated;

-- ============================================================
-- Планировщик: помечать просроченные планы как «пропущено»
-- (pg_cron доступен в Supabase; выполняется каждые 5 минут)
-- ============================================================

create extension if not exists pg_cron;
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'sweep-missed') then
    perform cron.schedule('sweep-missed', '*/5 * * * *', $cmd$ select public.sweep_missed() $cmd$);
  end if;
end
$$;

-- ============================================================
-- Realtime (для живой синхронизации между партнёрами)
-- Включите Realtime в Dashboard: Database → Replication,
-- либо выполните блок ниже (он сам проверит, что уже добавлено).
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'couples') then
    alter publication supabase_realtime add table public.couples;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks') then
    alter publication supabase_realtime add table public.tasks;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'checkins') then
    alter publication supabase_realtime add table public.checkins;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'couple_requests') then
    alter publication supabase_realtime add table public.couple_requests;
  end if;
end
$$;

-- ============================================================
-- Storage: бакет «avatars» для фото профиля (публичные URL)
-- Писать/удалять может только владелец файла.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_select" on storage.objects;
create policy "avatars_select" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');

drop policy if exists "avatars_insert" on storage.objects;
create policy "avatars_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars' and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars' and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatars' and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
-- ============================================================
-- Календарь свободных дней
-- ============================================================

create table if not exists public.free_days (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  unique (couple_id, user_id, day)
);

alter table public.free_days enable row level security;

drop policy if exists "free_days_select" on public.free_days;
create policy "free_days_select" on public.free_days
  for select to authenticated using (couple_id = auth_couple_id());

drop policy if exists "free_days_insert" on public.free_days;
create policy "free_days_insert" on public.free_days
  for insert to authenticated with check (
    couple_id = auth_couple_id() and user_id = auth.uid()
  );

drop policy if exists "free_days_delete" on public.free_days;
create policy "free_days_delete" on public.free_days
  for delete to authenticated using (
    couple_id = auth_couple_id() and user_id = auth.uid()
  );

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'free_days') then
    alter publication supabase_realtime add table public.free_days;
  end if;
end
$$;

create or replace function public.get_free_days()
returns jsonb
language sql security definer set search_path = public
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('user_id', f.user_id, 'day', f.day) order by f.day),
    '[]'::jsonb
  )
  from public.free_days f
  where f.couple_id = public.auth_couple_id()
$$;

create or replace function public.set_free_day(p_day date, p_free boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_couple_id uuid := public.auth_couple_id();
begin
  if v_couple_id is null then raise exception 'Вы не в паре'; end if;
  if p_free then
    insert into public.free_days (couple_id, user_id, day)
    values (v_couple_id, auth.uid(), p_day)
    on conflict (couple_id, user_id, day) do nothing;
  else
    delete from public.free_days
    where couple_id = v_couple_id and user_id = auth.uid() and day = p_day;
  end if;
end
$$;

-- ============================================================
-- Уведомления и Web Push
-- ============================================================

-- Уведомления: единственный источник того, что нужно показать партнёру.
-- Каждое событие создаёт ровно одну запись — так не бывает повторов
-- «одно и то же». Клиент показывает их (тост/пуш), помечает seen_at
-- (показано в приложении) и pushed_at (доставлено пушем).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete cascade,
  type text not null,
  task_id uuid references public.tasks(id) on delete cascade,
  title text not null,
  message text not null,
  data jsonb not null default '{}'::jsonb,
  seen_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Для уже созданных таблиц (после повторного прогона schema.sql)
alter table public.notifications add column if not exists pushed_at timestamptz;

create index if not exists idx_notifications_user
  on public.notifications (user_id, created_at desc);

-- Web Push подписки браузера (endpoint + ключи шифрования сообщений)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

-- Хелпер: уведомление для конкретного пользователя
create or replace function public.notify_user(
  p_user_id uuid, p_couple_id uuid, p_type text,
  p_task_id uuid, p_title text, p_message text, p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, couple_id, type, task_id, title, message, data)
  values (p_user_id, p_couple_id, p_type, p_task_id, p_title, p_message, p_data);
end
$$;

-- Хелпер: уведомление для партнёра по паре
create or replace function public.notify_partner(
  p_couple_id uuid, p_me uuid, p_type text,
  p_task_id uuid, p_title text, p_message text, p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_partner uuid;
begin
  select id into v_partner from public.profiles
  where couple_id = p_couple_id and id <> p_me
  limit 1;
  if v_partner is not null then
    perform public.notify_user(v_partner, p_couple_id, p_type, p_task_id, p_title, p_message, p_data);
  end if;
end
$$;

-- Получить последнее непросмотренное уведомление (только самое свежее —
-- не «одно и то же» каждый раз) и пометить все свои непрочитанные как seen.
create or replace function public.get_unseen_notifications()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row jsonb;
begin
  select to_jsonb(n) into v_row
  from public.notifications n
  where n.user_id = v_user and n.seen_at is null
  order by n.created_at desc, n.id desc
  limit 1;
  update public.notifications set seen_at = now()
  where user_id = v_user and seen_at is null;
  return coalesce(v_row, 'null'::jsonb);
end
$$;

-- Отметить уведомления прочитанными (после показа тоста в реальном времени)
create or replace function public.mark_notifications_seen()
returns void
language sql security definer set search_path = public
as $$
  update public.notifications set seen_at = now()
  where user_id = auth.uid() and seen_at is null
$$;

-- Сохранение подписки браузера для пушей
create or replace function public.save_push_subscription(p_endpoint text, p_keys jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_endpoint is null or btrim(p_endpoint) = '' then return; end if;
  insert into public.push_subscriptions (user_id, endpoint, keys)
  values (auth.uid(), p_endpoint, coalesce(p_keys, '{}'::jsonb))
  on conflict (endpoint) do update
    set keys = excluded.keys, user_id = auth.uid();
end
$$;

-- Удаление подписки браузера (пользователь выключил уведомления)
create or replace function public.remove_push_subscription(p_endpoint text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.push_subscriptions where user_id = auth.uid() and endpoint = p_endpoint;
end
$$;

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "push_subs_select" on public.push_subscriptions;
create policy "push_subs_select" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "push_subs_insert" on public.push_subscriptions;
create policy "push_subs_insert" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "push_subs_delete" on public.push_subscriptions;
create policy "push_subs_delete" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- Права для новых объектов добавляются здесь: блок «Права» выше выполняется
-- до создания этих таблиц/функций, поэтому grants задаём явно.
grant select on public.notifications to authenticated;
grant execute on function public.get_unseen_notifications() to authenticated;
grant execute on function public.mark_notifications_seen() to authenticated;
grant execute on function public.save_push_subscription(text, jsonb) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;

-- Realtime для уведомлений добавляется здесь: таблица создана только сейчас.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

-- ============================================================
-- Админ-панель (доступ только для is_admin=true, см. комментарий выше)
-- ============================================================

-- Список всех пользователей с почтами
create or replace function public.admin_get_users()
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Нет прав администратора'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', u.id,
      'email', u.email,
      'name', p.name,
      'username', p.username,
      'is_admin', p.is_admin,
      'created_at', u.created_at,
      'last_sign_in_at', u.last_sign_in_at
    ) order by u.created_at desc)
    from auth.users u
    left join public.profiles p on p.id = u.id
  ), '[]'::jsonb);
end
$$;

-- Активность конкретного пользователя
create or replace function public.admin_get_activity(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then raise exception 'Нет прав администратора'; end if;
  if p_user_id is null then raise exception 'Не указан пользователь'; end if;
  select jsonb_build_object(
    'user', jsonb_build_object(
      'id', u.id, 'email', u.email,
      'created_at', u.created_at,
      'confirmed_at', u.confirmed_at,
      'last_sign_in_at', u.last_sign_in_at
    ),
    'profile', jsonb_build_object(
      'name', p.name, 'username', p.username,
      'avatar', p.avatar, 'bio', p.bio, 'created_at', p.created_at
    ),
    'couple_id', p.couple_id,
    'tasks_created', (select count(*)::int from public.tasks t where t.created_by = u.id),
    'checkins', (select count(*)::int from public.checkins k where k.user_id = u.id),
    'ratings', (select count(*)::int from public.ratings r where r.user_id = u.id),
    'requests', (select count(*)::int from public.couple_requests q where q.from_id = u.id or q.to_id = u.id),
    'events_completed', case when p.couple_id is null then 0
      else (select count(*)::int from public.tasks t where t.couple_id = p.couple_id and t.status = 'completed')
    end
  ) into v
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_user_id;
  insert into public.admin_logs (admin_id, action, target_user_id)
  values (auth.uid(), 'view_activity', p_user_id);
  return v;
end
$$;

-- Полное удаление пользователя (его пара, события, оценки, запросы)
create or replace function public.admin_delete_user(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
begin
  if not public.is_admin() then raise exception 'Нет прав администратора'; end if;
  if p_user_id is null then raise exception 'Не указан пользователь'; end if;
  if p_user_id = v_admin then raise exception 'Нельзя удалить собственный аккаунт'; end if;
  insert into public.admin_logs (admin_id, action, target_user_id)
  values (v_admin, 'delete_user', p_user_id);
  delete from public.couple_requests where from_id = p_user_id or to_id = p_user_id;
  delete from public.couples where id in (select couple_id from public.profiles where id = p_user_id);
  delete from auth.users where id = p_user_id;
  return jsonb_build_object('ok', true);
end
$$;

-- Просмотр журнала действий админов
create or replace function public.admin_get_logs(p_limit int default 100)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Нет прав администратора'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id,
      'admin_id', l.admin_id,
      'action', l.action,
      'target_user_id', l.target_user_id,
      'created_at', l.created_at
    ) order by l.created_at desc)
    from public.admin_logs l
    limit greatest(1, least(p_limit, 500))
  ), '[]'::jsonb);
end
$$;

-- Старые сигнатуры с паролем больше не нужны — убираем, чтобы нельзя было
-- вызвать их с паролем мимо проверки прав.
drop function if exists public.admin_get_users(text);
drop function if exists public.admin_get_activity(text, uuid);
drop function if exists public.admin_delete_user(text, uuid);