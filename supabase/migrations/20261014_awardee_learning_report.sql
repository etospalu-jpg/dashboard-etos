-- Member-owned progress overview: Kajian Keislaman + Tahsin.
-- Returns only rows belonging to the authenticated READMAP membership.
CREATE OR REPLACE FUNCTION public.my_learning_reflection_report()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_awardee uuid;v_name text;v_cohort text;v_tahsin jsonb;v_kajian jsonb;
BEGIN
 SELECT a.id,a.name,a.angkatan INTO v_awardee,v_name,v_cohort
 FROM public.readmap_memberships m JOIN public.awardees a ON a.id=m.awardee_id
 WHERE m.user_id=(SELECT auth.uid()) AND lower(a.status)='aktif';
 IF v_awardee IS NULL THEN RAISE EXCEPTION 'Akses akun Awardee diperlukan' USING ERRCODE='42501'; END IF;

 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'session_id',t.session_id,'date',s.activity_date,'confidence',t.confidence,
  'practice',t.practice_frequency,'lesson',t.lesson,'challenges',t.challenges,
  'goal',t.improvement_goal,'previous_review',t.previous_goal_review,
  'submitted_at',t.submitted_at) ORDER BY s.activity_date,t.submitted_at),'[]'::jsonb)
 INTO v_tahsin FROM public.tahsin_weekly_reflections t
 JOIN public.attendance_sessions s ON s.id=t.session_id
 WHERE t.awardee_id=v_awardee;

 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id,'date',coalesce(r.agenda_date,f.agenda_date),
  'agenda',f.agenda_name,'understanding',r.event_facts,
  'memorable',r.memorable_fact,'awareness',r.awareness_finding,
  'action_plan',coalesce(nullif(r.action_plan,''),r.action_commitment),
  'follow_up',r.follow_up_status,'submitted_at',r.submitted_at)
  ORDER BY coalesce(r.agenda_date,f.agenda_date),r.created_at),'[]'::jsonb)
 INTO v_kajian FROM public.reflection_responses r
 JOIN public.reflection_forms f ON f.id=r.form_id
 WHERE r.awardee_id=v_awardee
 AND (f.agenda_name ILIKE '%kajian%' OR coalesce(r.agenda_name_snapshot,'') ILIKE '%kajian%');

 RETURN jsonb_build_object('name',v_name,'cohort',v_cohort,'tahsin',v_tahsin,'kajian',v_kajian);
END;$$;
REVOKE ALL ON FUNCTION public.my_learning_reflection_report() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_learning_reflection_report() TO authenticated;
