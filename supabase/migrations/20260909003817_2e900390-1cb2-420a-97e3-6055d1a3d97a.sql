CREATE POLICY "photos_storage_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "photos_storage_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "photos_storage_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
CREATE POLICY "photos_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'photos' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.photos p
        WHERE p.storage_path = storage.objects.name
          AND p.status = 'approved'
          AND NOT public.is_blocked_between(auth.uid(), p.user_id)
          AND EXISTS (SELECT 1 FROM public.profiles pr JOIN public.users u ON u.id = pr.user_id
                      WHERE pr.user_id = p.user_id AND pr.status = 'active' AND pr.visibility = 'visible' AND u.status = 'active')
      )
    )
  );