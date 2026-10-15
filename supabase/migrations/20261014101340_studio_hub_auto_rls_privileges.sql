-- Supabase's automatic-RLS helper is an internal event-trigger function.
-- End users must not be able to invoke this privileged helper through the Data API.
-- Projects created without automatic RLS may not contain this function.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
