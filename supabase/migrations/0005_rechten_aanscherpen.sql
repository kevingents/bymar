-- Functies die alleen voor ingelogde gebruikers zijn: niet aanroepbaar zonder login.
revoke execute on function public.accept_invite(text) from anon;
revoke execute on function public.can_access(uuid) from anon;
revoke execute on function public.can_access_text(text) from anon;
revoke execute on function public.use_ai(text) from anon;
