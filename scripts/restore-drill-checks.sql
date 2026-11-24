\pset tuples_only on
\pset format unaligned
\pset fieldsep '|'

select format(
  'select %L, %L, count(*)::text from %I.%I',
  'rows', schemaname || '.' || tablename, schemaname, tablename
)
from pg_tables
where schemaname = 'public'
order by tablename
\gexec

select 'table_owner', schemaname || '.' || tablename, tableowner
from pg_tables
where schemaname = 'public'
order by tablename;

select 'rls', n.nspname || '.' || c.relname,
       json_build_object('enabled', c.relrowsecurity, 'forced', c.relforcerowsecurity)::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p') and n.nspname = 'public'
order by c.relname;

select 'policy', schemaname || '.' || tablename || '.' || policyname,
       md5(json_build_object(
         'permissive', permissive,
         'roles', roles,
         'cmd', cmd,
         'qual', coalesce(qual, ''),
         'with_check', coalesce(with_check, '')
       )::text)
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select 'grant', table_schema || '.' || table_name || '.' || grantee || '.' || privilege_type,
       md5(json_build_object(
         'grantor', grantor,
         'grantable', is_grantable,
         'hierarchy', with_hierarchy
       )::text)
from information_schema.role_table_grants
where table_schema = 'public'
order by table_name, grantee, privilege_type;

select 'default_acl',
       coalesce(n.nspname, '*') || '.' || pg_get_userbyid(d.defaclrole) || '.' || d.defaclobjtype::text,
       md5(array_to_string(coalesce(d.defaclacl, acldefault(d.defaclobjtype, d.defaclrole)), ','))
from pg_default_acl d
left join pg_namespace n on n.oid = d.defaclnamespace
where n.nspname = 'public' or n.nspname is null
order by 2;
