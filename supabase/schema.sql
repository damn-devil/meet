-- ============================================================
-- «Вместе» — схема для Supabase (PostgreSQL)
-- Выполните этот скрипт целиком в SQL Editor проекта Supabase.
-- Скрипт идемпотентен: можно перевыполнять после изменений.
-- ============================================================

-- SQL-функции проверяются при первом вызове, а не при создании:
-- иначе auth_couple_id (см. ниже) упадёт, если profiles ещё не создана.
set check_function_bodies = false;

-- ---------- Хелперы ----------

-- Расстояние между точками (haversine, метры)
create or replace function public.haversine_m(lat1 float, lng1 float, lat2 float, lng2 float)
returns double precision
language sql immutable
as $$
  select 6371000 * 2 * asin(
    least(1, sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    ))
  )
$$;

-- ============================================================
-- Таблицы
-- ============================================================

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  radius_m int not null default 150,
  window_min int not null default 30,
  grace_min int not null default 15,
  bg text not null default '',
  created_at timestamptz not null default now()
);

alter table public.couples add column if not exists bg text default '';

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

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  title text not null,
  description text not null default '',
  place_name text not null default '',
  address text not null default '',
  lat double precision,
  lng double precision,
  scheduled_at timestamptz,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','missed','cancelled')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  lat double precision not null,
  lng double precision not null,
  accuracy double precision not null default 0,
  arrived_at timestamptz not null default now(),
  unique(task_id, user_id)
);

create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  type text not null check (type in ('delete','reschedule')),
  proposed_value text,
  requested_by uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

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
create index if not exists idx_comments_task on public.comments(task_id);
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
alter table public.comments enable row level security;
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

drop policy if exists "comments_select" on public.comments;
create policy "comments_select" on public.comments
  for select to authenticated using (task_id in (select id from public.tasks where couple_id = auth_couple_id()));

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
    'radius_m', c.radius_m,
    'window_min', c.window_min,
    'grace_min', c.grace_min,
    'bg', c.bg,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'avatar', p.avatar, 'avatar_url', p.avatar_url,
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
    'place_name', t.place_name,
    'address', t.address,
    'lat', t.lat,
    'lng', t.lng,
    'scheduled_at', t.scheduled_at,
    'status', t.status,
    'created_by', t.created_by,
    'created_at', t.created_at,
    'completed_at', t.completed_at,
    'updated_at', t.updated_at,
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'task_id', c.task_id, 'user_id', c.user_id, 'text', c.text,
        'created_at', c.created_at, 'name', p.name, 'avatar', p.avatar, 'avatar_url', p.avatar_url
      ) order by c.created_at)
      from public.comments c join public.profiles p on p.id = c.user_id
      where c.task_id = t.id
    ), '[]'::jsonb),
    'checkins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', k.id, 'task_id', k.task_id, 'user_id', k.user_id,
        'lat', k.lat, 'lng', k.lng, 'accuracy', k.accuracy, 'arrived_at', k.arrived_at
      ))
      from public.checkins k where k.task_id = t.id
    ), '[]'::jsonb),
    'agreements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'task_id', a.task_id, 'type', a.type,
        'proposed_value', a.proposed_value, 'requested_by', a.requested_by,
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

-- Отметить просроченные планы как «пропущено»
create or replace function public.sweep_missed()
returns void
language sql security definer set search_path = public
as $$
  update public.tasks t
  set status = 'missed', updated_at = now()
  from public.couples c
  where t.couple_id = c.id
    and t.status in ('planned','in_progress')
    and t.scheduled_at + make_interval(mins => c.window_min) + make_interval(mins => c.grace_min) < now()
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
    select * into v_couple from public.couples where invite_code = upper(btrim(p_invite));
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
  insert into public.profiles (id, name)
  values (auth.uid(), coalesce(nullif(btrim(p_name), ''), 'Пользователь'))
  on conflict (id) do update set name = excluded.name
  returning public.profile_view(id)
$$;

-- Убираем старую сигнатуру без p_accent/p_autocheck, иначе при вызове с частью
-- аргументов Postgres не сможет выбрать между перегрузками.
drop function if exists public.update_profile(text, text, text, text, text, text, text);

create or replace function public.update_profile(
  p_name text default null, p_avatar text default null,
  p_avatar_url text default null,
  p_bio text default null, p_theme text default null,
  p_accent text default null, p_autocheck boolean default null,
  p_telegram text default null, p_imessage text default null
)
returns jsonb
language sql security definer set search_path = public
as $$
  update public.profiles set
    name = coalesce(nullif(btrim(p_name), ''), name),
    avatar = coalesce(p_avatar, avatar),
    avatar_url = coalesce(p_avatar_url, avatar_url),
    bio = coalesce(p_bio, bio),
    theme = coalesce(p_theme, theme),
    accent = coalesce(p_accent, accent),
    autocheck = case when p_autocheck is not null then p_autocheck else autocheck end,
    telegram = coalesce(btrim(p_telegram), telegram),
    imessage = coalesce(btrim(p_imessage), imessage)
  where id = auth.uid()
  returning public.profile_view(id)
$$;

create or replace function public.get_tasks()
returns jsonb
language sql security definer set search_path = public
as $$
  select coalesce(
    jsonb_agg(public.task_view(t.id) order by t.scheduled_at),
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

-- Удаление аккаунта: пару, планы и данные партнёра не задевает,
-- у партнёра couple_id обнуляется, его профиль и переписка остаются.
create or replace function public.delete_account()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_couple_id uuid := public.auth_couple_id();
begin
  delete from public.couple_requests where from_id = auth.uid() or to_id = auth.uid();
  if v_couple_id is not null then
    delete from public.couples where id = v_couple_id;
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
    'avgRating', (
      select round(avg(r.score)::numeric, 1)
      from public.ratings r
      where r.task_id in (select id from public.tasks where couple_id = public.auth_couple_id())
    )
  )
  from public.tasks t
  where t.couple_id = public.auth_couple_id()
$$;

create or replace function public.create_task(
  p_title text, p_description text default '', p_place_name text default '',
  p_address text default '', p_lat double precision default null, p_lng double precision default null,
  p_scheduled_at timestamptz default null
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
  insert into public.tasks (couple_id, title, description, place_name, address, lat, lng, scheduled_at, created_by)
  values (v_couple_id, btrim(p_title), coalesce(p_description,''), coalesce(p_place_name,''),
          coalesce(p_address,''), p_lat, p_lng, p_scheduled_at, auth.uid())
  returning * into v_task;
  return public.task_view(v_task.id);
end
$$;

create or replace function public.add_comment(p_task_id uuid, p_text text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task_id and couple_id = public.auth_couple_id();
  if not found then raise exception 'Задача не найдена'; end if;
  if p_text is null or btrim(p_text) = '' then raise exception 'Пустой комментарий'; end if;
  insert into public.comments (task_id, user_id, text) values (p_task_id, auth.uid(), btrim(p_text));
  update public.tasks set updated_at = now() where id = p_task_id;
  return public.task_view(p_task_id);
end
$$;

-- Проверка прихода: радиус + окно времени
create or replace function public.check_in(
  p_task_id uuid, p_lat double precision, p_lng double precision, p_accuracy double precision default 0
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_couple_id uuid := public.auth_couple_id();
  v_task public.tasks;
  v_settings public.couples;
  v_dist double precision;
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
  if v_task.status = 'missed' then raise exception 'Время встречи прошло'; end if;

  select * into v_settings from public.couples where id = v_couple_id;

  v_dist := public.haversine_m(v_task.lat, v_task.lng, p_lat, p_lng);
  if (v_dist - coalesce(p_accuracy, 0)) > v_settings.radius_m then
    raise exception 'Вы вне зоны встречи (нужно не дальше % м, вы в % м)', v_settings.radius_m, round(v_dist);
  end if;

  if now() < v_task.scheduled_at - make_interval(mins => v_settings.window_min)
     or now() > v_task.scheduled_at + make_interval(mins => v_settings.window_min) then
    raise exception 'Вы не в назначенное время';
  end if;

  insert into public.checkins (task_id, user_id, lat, lng, accuracy)
  values (p_task_id, auth.uid(), p_lat, p_lng, coalesce(p_accuracy, 0))
  on conflict (task_id, user_id) do update
    set lat = excluded.lat, lng = excluded.lng, accuracy = excluded.accuracy;

  select id into v_partner from public.profiles
  where couple_id = v_couple_id and id <> auth.uid() limit 1;

  select count(*) into v_exists from public.checkins
  where task_id = p_task_id and user_id = v_partner;

  if v_exists > 0 then
    v_status := 'completed';
    update public.tasks set status = 'completed', completed_at = now(), updated_at = now() where id = p_task_id;
  else
    v_status := 'in_progress';
    update public.tasks set status = 'in_progress', updated_at = now() where id = p_task_id;
  end if;

  return jsonb_build_object(
    'success', v_status = 'completed',
    'message', case when v_status = 'completed' then 'Вы встретились! Задача выполнена' else 'Вы отмечены как пришедший' end,
    'task', public.task_view(p_task_id)
  );
end
$$;

-- Запрос на перенос/удаление (нужно согласие второго)
create or replace function public.request_agreement(
  p_task_id uuid, p_type text, p_proposed_value timestamptz default null
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
  if p_type not in ('delete','reschedule') then raise exception 'Неверный тип'; end if;
  if p_type = 'reschedule' and p_proposed_value is null then raise exception 'Укажите новое время'; end if;
  select count(*) into v_pending from public.agreements where task_id = p_task_id and status = 'pending';
  if v_pending > 0 then raise exception 'Запрос уже отправлен и ждёт ответа'; end if;
  insert into public.agreements (task_id, type, proposed_value, requested_by)
  values (p_task_id, p_type, case when p_type = 'reschedule' then p_proposed_value::text else null end, auth.uid());
  update public.tasks set updated_at = now() where id = p_task_id;
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
      set scheduled_at = v_agreement.proposed_value::timestamptz, status = 'planned', updated_at = now()
      where id = v_task.id;
    end if;
  end if;

  update public.tasks set updated_at = now() where id = v_task.id;
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

-- Отметить план пропущенным вручную (кнопка «Не пришёл»)
create or replace function public.mark_task_missed(p_task_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_couple_id uuid := public.auth_couple_id();
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task_id and couple_id = v_couple_id;
  if not found then raise exception 'Задача не найдена'; end if;
  if v_task.status not in ('planned','in_progress') then raise exception 'Задача уже закрыта'; end if;
  update public.tasks set status = 'missed', updated_at = now() where id = p_task_id;
  return public.task_view(p_task_id);
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
  return public.task_view(p_task_id);
end
$$;

-- Убираем старую сигнатуру без p_bg, иначе при вызове с 3 аргументами
-- Postgres не может выбрать между перегрузками («could not choose the best candidate»).
drop function if exists public.update_couple_settings(integer, integer, integer);

create or replace function public.update_couple_settings(
  p_radius_m int default null, p_window_min int default null, p_grace_min int default null,
  p_bg text default null
)
returns jsonb
language sql security definer set search_path = public
as $$
  update public.couples set
    radius_m = case when p_radius_m is not null then greatest(50, least(5000, p_radius_m)) else radius_m end,
    window_min = case when p_window_min is not null then greatest(5, least(240, p_window_min)) else window_min end,
    grace_min = case when p_grace_min is not null then greatest(0, least(240, p_grace_min)) else grace_min end,
    bg = case when p_bg is not null then btrim(p_bg) else bg end
  where id = public.auth_couple_id()
  returning public.couple_view(id)
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
    'from', jsonb_build_object('id', f.id, 'name', f.name, 'avatar', f.avatar, 'avatar_url', f.avatar_url),
    'to', jsonb_build_object('id', t.id, 'name', t.name, 'avatar', t.avatar, 'avatar_url', t.avatar_url)
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

-- Поиск людей по имени/никнейму (без тех, кто уже в паре и без себя)
create or replace function public.search_users(p_query text default null)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'avatar', p.avatar, 'avatar_url', p.avatar_url
  ) order by p.name), '[]'::jsonb)
  from public.profiles p
  where p.id <> auth.uid()
    and p.couple_id is null
    and (p_query is null or btrim(p_query) = '' or p.name ilike '%' || btrim(p_query) || '%')
  limit 20
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
  insert into public.couple_requests (from_id, to_id)
  values (auth.uid(), p_to_id)
  returning * into v_new;
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
    if public.auth_couple_id() is not null then raise exception 'Вы уже в паре'; end if;
    if (select couple_id from public.profiles where id = v_req.from_id) is not null then
      raise exception 'Отправитель уже в паре';
    end if;
    insert into public.couples (invite_code, radius_m, window_min, grace_min)
    values (upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)), 150, 30, 15)
    returning id into v_couple;
    update public.profiles set couple_id = v_couple where id in (v_req.from_id, v_req.to_id);
    update public.couple_requests set status = 'accepted', responded_at = now() where id = p_request_id;
    update public.couple_requests set status = 'declined', responded_at = now()
    where status = 'pending' and (from_id in (v_req.from_id, v_req.to_id) or to_id in (v_req.from_id, v_req.to_id));
    return jsonb_build_object('couple', public.couple_view(v_couple));
  else
    update public.couple_requests set status = 'declined', responded_at = now() where id = p_request_id;
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

grant usage on schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;

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
  for insert to authenticated with check (bucket_id = 'avatars' and owner = auth.uid());

drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects
  for update to authenticated using (bucket_id = 'avatars' and owner = auth.uid());

drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars' and owner = auth.uid());
