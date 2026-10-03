-- ============================================================
-- Profils de démonstration : données (générées par scripts/generate-virtual-profiles.mjs)
--
-- 40 profils (21 femmes, 19 hommes), 22 à 35 ans, un seul prénom visible :
-- 4 Gabon, 4 Cameroun, 4 Côte d'Ivoire, 4 Congo-Brazzaville, 4 Togo, 4 Bénin, 4 Sénégal, 4 Mali, 8 France.
-- Comptes sans mot de passe (connexion impossible), marqués « virtual » dans le compte et
-- is_virtual dans le profil. Un profil de démonstration n'est montré aux membres que
-- lorsqu'un administrateur lui a donné une photo autorisée (/admin → Profils de démo) ;
-- il porte alors l'étiquette « Profil de démonstration ».
-- Aucune table n'est créée. Rejouable sans risque : un profil déjà présent n'est pas
-- recréé, et les profils virtuels d'une version précédente sont retirés.
-- À exécuter APRÈS 20261003100000_profils_demo_40.sql.
-- ============================================================

DO $do$
DECLARE
  _seed jsonb := $seed$[
["demo.ga.01@profils-virtuels.yona.invalid","Vanessa","female","2003-08-09","Gabon","Ngounié","Mouila","Calme et joyeuse, je partage mon temps entre mon travail et la louange. J'aime méditer la Parole chaque matin. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Louange","Cinéma"],"Pentecôtiste","Plusieurs fois par semaine","Plusieurs fois par semaine","Essentielle","Relation sérieuse","male",18,33],
["demo.ga.02@profils-virtuels.yona.invalid","Murielle","female","2004-08-27","Gabon","Estuaire","Ntoum","Je suis une femme simple, passionnée par la musique et la lecture. J'enseigne à l'école du dimanche. Je crois au mariage, à la fidélité et au respect.",["Lecture","Musique"],"Protestante (Église évangélique du Gabon)","Chaque semaine","Tous les jours","Très importante","Mariage","male",18,32],
["demo.ga.03@profils-virtuels.yona.invalid","Hervé","male","2002-07-05","Gabon","Haut-Ogooué","Franceville","Souriant et attentionné, j'aime la mode et la danse. Le Psaume 23 m'accompagne depuis toujours. Je cherche une relation sérieuse, en vue du mariage.",["Nature","Danse","Mode","Bénévolat"],"Adventiste","Plusieurs fois par semaine","Plusieurs fois par semaine","Essentielle","Mariage","female",18,34],
["demo.ga.04@profils-virtuels.yona.invalid","Christian","male","2003-03-06","Gabon","Nyanga","Tchibanga","Je suis un homme simple, passionné par le bénévolat et la mode. Je suis engagé dans le groupe de jeunes de ma paroisse. Je crois au mariage, à la fidélité et au respect.",["Danse","Mode","Bénévolat","Cuisine"],"Catholique","Plusieurs fois par semaine","Matin et soir","Essentielle","Mariage","female",18,33],
["demo.cm.01@profils-virtuels.yona.invalid","Pélagie","female","1992-08-25","Cameroun","North","Garoua","Douce mais déterminée, j'aime le sport, les voyages et les longues discussions. Ma foi guide chacune de mes décisions. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Voyages","Sport"],"Évangélique","Deux à trois fois par mois","Tous les jours","Essentielle","Mariage","male",28,44],
["demo.cm.02@profils-virtuels.yona.invalid","Aïcha","female","1993-08-20","Cameroun","West","Dschang","Souriante et attentionnée, j'aime les balades dans la nature et la mode. Le Psaume 23 m'accompagne depuis toujours. Je souhaite rencontrer un homme sincère pour construire un foyer béni.",["Mode","Lecture","Nature"],"Catholique","Plusieurs fois par semaine","Tous les jours","Essentielle","Faire connaissance d'abord","male",27,43],
["demo.cm.03@profils-virtuels.yona.invalid","Arnaud","male","2003-03-30","Cameroun","South","Ébolowa","Fils de Dieu avant tout, je trouve ma joie dans la louange et les voyages. Le Psaume 23 m'accompagne depuis toujours. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Photographie","Voyages","Sport","Louange"],"Baptiste","Deux à trois fois par mois","Tous les jours","Très importante","Relation sérieuse","female",18,33],
["demo.cm.04@profils-virtuels.yona.invalid","Franck","male","1998-05-24","Cameroun","Littoral","Douala","Souriant et attentionné, j'aime la lecture et la louange. Je sers à l'accueil de mon église le dimanche. Prêt à bâtir une famille fondée sur l'amour et la foi.",["Louange","Lecture"],"Pentecôtiste","Chaque semaine","Plusieurs fois par semaine","Au centre de ma vie","Mariage","female",22,38],
["demo.ci.01@profils-virtuels.yona.invalid","Amenan","female","2001-11-03","Côte d'Ivoire","Vallée du Bandama District","Bouaké","Calme et joyeuse, je partage mon temps entre mon travail et la mode. Le Psaume 23 m'accompagne depuis toujours. Je souhaite rencontrer un homme sincère pour construire un foyer béni.",["Mode","Cinéma","Nature"],"Méthodiste","Chaque semaine","Plusieurs fois par semaine","Très importante","Relation sérieuse","male",18,34],
["demo.ci.02@profils-virtuels.yona.invalid","Chantal","female","2004-03-13","Côte d'Ivoire","Abidjan Autonomous District","Abidjan","Fille de Dieu avant tout, je trouve ma joie dans la photographie et la musique. Je sers à l'accueil de mon église le dimanche. Je crois au mariage, à la fidélité et au respect.",["Musique","Photographie","Cinéma","Cuisine"],"Harriste","Deux à trois fois par mois","Matin et soir","Au centre de ma vie","Relation sérieuse","male",18,32],
["demo.ci.03@profils-virtuels.yona.invalid","Kouassi","male","1991-06-29","Côte d'Ivoire","Abidjan Autonomous District","Bingerville","Chaque journée est un cadeau de Dieu : je la remplis de cinéma et de voyages. J'aide à l'organisation des sorties de l'église. Prêt à bâtir une famille fondée sur l'amour et la foi.",["Voyages","Cinéma","Bénévolat","Louange"],"Baptiste","Chaque semaine","Tous les jours","Au centre de ma vie","Faire connaissance d'abord","female",29,45],
["demo.ci.04@profils-virtuels.yona.invalid","Hermann","male","2004-07-21","Côte d'Ivoire","Bas-Sassandra District","San-Pédro","Je suis un homme simple, passionné par la musique et la cuisine. Ma foi guide chacune de mes décisions. Je cherche une relation sérieuse, en vue du mariage.",["Cuisine","Musique"],"Catholique","Chaque semaine","Matin et soir","Au centre de ma vie","Faire connaissance d'abord","female",18,32],
["demo.cg.01@profils-virtuels.yona.invalid","Tendresse","female","1995-03-29","Congo-Brazzaville","Sangha","Ouesso","Souriante et attentionnée, j'aime les voyages et la photographie. La prière rythme mes journées. Je cherche une relation sérieuse, en vue du mariage.",["Voyages","Photographie","Mode"],"Salutiste (Armée du Salut)","Chaque semaine","Matin et soir","Très importante","Mariage","male",25,41],
["demo.cg.02@profils-virtuels.yona.invalid","Orphée","female","1999-09-08","Congo-Brazzaville","Bouenza","Madingou","Souriante et attentionnée, j'aime la lecture et la cuisine. J'enseigne à l'école du dimanche. Je cherche une relation sérieuse, en vue du mariage.",["Bénévolat","Cuisine","Lecture","Louange"],"Salutiste (Armée du Salut)","Chaque semaine","Plusieurs fois par semaine","Essentielle","Mariage","male",21,37],
["demo.cg.03@profils-virtuels.yona.invalid","Christ","male","2004-07-06","Congo-Brazzaville","Niari","Dolisie","Souriant et attentionné, j'aime les voyages et le cinéma. Je suis engagé dans le groupe de jeunes de ma paroisse. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Voyages","Cinéma","Louange"],"Pentecôtiste","Chaque semaine","Matin et soir","Très importante","Relation sérieuse","female",18,32],
["demo.cg.04@profils-virtuels.yona.invalid","Ulrich","male","2000-10-24","Congo-Brazzaville","Plateaux","Gamboma","Dynamique et fidèle en amitié, je consacre mon temps libre à la louange. Je joue dans le groupe de louange de mon église. Je cherche une relation sérieuse, en vue du mariage.",["Danse","Louange","Nature"],"Pentecôtiste","Chaque semaine","Tous les jours","Au centre de ma vie","Faire connaissance d'abord","female",19,35],
["demo.tg.01@profils-virtuels.yona.invalid","Ablavi","female","2001-12-30","Togo","Plateaux","Kpalimé","Fille de Dieu avant tout, je trouve ma joie dans les voyages et le sport. La prière rythme mes journées. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Sport","Mode","Cinéma","Voyages"],"Méthodiste","Deux à trois fois par mois","Plusieurs fois par semaine","Au centre de ma vie","Mariage","male",18,34],
["demo.tg.02@profils-virtuels.yona.invalid","Dédé","female","1998-10-25","Togo","Maritime","Aného","Douce mais déterminée, j'aime les balades dans la nature, la danse et les longues discussions. Je participe à un groupe de prière chaque semaine. Je crois au mariage, à la fidélité et au respect.",["Danse","Nature","Louange"],"Évangélique presbytérienne","Chaque semaine","Plusieurs fois par semaine","Au centre de ma vie","Relation sérieuse","male",21,37],
["demo.tg.03@profils-virtuels.yona.invalid","Yawo","male","1993-03-23","Togo","Maritime","Tsévié","Dynamique et fidèle en amitié, je consacre mon temps libre à la musique. Le Psaume 23 m'accompagne depuis toujours. J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",["Photographie","Musique"],"Assemblées de Dieu","Plusieurs fois par semaine","Tous les jours","Très importante","Relation sérieuse","female",27,43],
["demo.tg.04@profils-virtuels.yona.invalid","Dodji","male","2000-10-02","Togo","Centrale","Sokodé","Calme et joyeux, je partage mon temps entre mon travail et la musique. Ma foi guide chacune de mes décisions. Je crois au mariage, à la fidélité et au respect.",["Mode","Musique","Photographie","Cinéma"],"Assemblées de Dieu","Plusieurs fois par semaine","Tous les jours","Très importante","Relation sérieuse","female",20,36],
["demo.bj.01@profils-virtuels.yona.invalid","Nadège","female","2003-08-18","Bénin","Atlantique","Abomey-Calavi","Douce mais déterminée, j'aime la lecture, la danse et les longues discussions. Le Psaume 23 m'accompagne depuis toujours. Je cherche une relation sérieuse, en vue du mariage.",["Cinéma","Danse","Lecture"],"Église du christianisme céleste","Chaque semaine","Plusieurs fois par semaine","Au centre de ma vie","Mariage","male",18,33],
["demo.bj.02@profils-virtuels.yona.invalid","Fernande","female","1995-02-12","Bénin","Collines","Savalou","Calme et joyeuse, je partage mon temps entre mon travail et la danse. Je suis engagée dans le groupe de jeunes de ma paroisse. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Voyages","Bénévolat","Photographie","Danse"],"Assemblées de Dieu","Plusieurs fois par semaine","Tous les jours","Au centre de ma vie","Mariage","male",25,41],
["demo.bj.03@profils-virtuels.yona.invalid","Narcisse","male","1993-10-22","Bénin","Atakora","Natitingou","Fils de Dieu avant tout, je trouve ma joie dans la lecture et les voyages. Je suis engagé dans le groupe de jeunes de ma paroisse. J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",["Musique","Lecture","Voyages"],"Méthodiste","Chaque semaine","Tous les jours","Essentielle","Faire connaissance d'abord","female",26,42],
["demo.bj.04@profils-virtuels.yona.invalid","Romaric","male","1999-06-22","Bénin","Atlantique","Ouidah","Chaque journée est un cadeau de Dieu : je la remplis de sport et de lecture. Je participe à un groupe de prière chaque semaine. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Musique","Lecture","Mode","Sport"],"Assemblées de Dieu","Chaque semaine","Tous les jours","Très importante","Mariage","female",21,37],
["demo.sn.01@profils-virtuels.yona.invalid","Joséphine","female","2002-01-22","Sénégal","Kolda","Kolda","Calme et joyeuse, je partage mon temps entre mon travail et la louange. La prière rythme mes journées. J'attends un homme de foi, doux et responsable.",["Louange","Photographie"],"Adventiste","Deux à trois fois par mois","Tous les jours","Très importante","Mariage","male",18,34],
["demo.sn.02@profils-virtuels.yona.invalid","Albertine","female","1994-04-30","Sénégal","Thies","Mbour","Calme et joyeuse, je partage mon temps entre mon travail et la musique. Le Psaume 23 m'accompagne depuis toujours. J'attends un homme de foi, doux et responsable.",["Musique","Lecture","Bénévolat"],"Adventiste","Chaque semaine","Tous les jours","Très importante","Mariage","male",26,42],
["demo.sn.03@profils-virtuels.yona.invalid","Marcel","male","1994-10-08","Sénégal","Kaolack","Kaolack","Je suis un homme simple, passionné par la photographie et la danse. J'aide à l'organisation des sorties de l'église. Je cherche une relation sérieuse, en vue du mariage.",["Danse","Photographie"],"Adventiste","Chaque semaine","Matin et soir","Au centre de ma vie","Relation sérieuse","female",25,41],
["demo.sn.04@profils-virtuels.yona.invalid","Raphaël","male","1994-12-07","Sénégal","Ziguinchor","Bignona","Je suis un homme simple, passionné par la lecture et la cuisine. J'aime méditer la Parole chaque matin. Prêt à bâtir une famille fondée sur l'amour et la foi.",["Bénévolat","Cinéma","Cuisine","Lecture"],"Catholique","Chaque semaine","Matin et soir","Très importante","Faire connaissance d'abord","female",25,41],
["demo.ml.01@profils-virtuels.yona.invalid","Marthe","female","2004-04-14","Mali","Sikasso","Koutiala","Douce mais déterminée, j'aime la mode, la danse et les longues discussions. Je sers à l'accueil de mon église le dimanche. Je cherche une relation sérieuse, en vue du mariage.",["Danse","Mode"],"Catholique","Chaque semaine","Tous les jours","Essentielle","Relation sérieuse","male",18,32],
["demo.ml.02@profils-virtuels.yona.invalid","Béatrice","female","1993-05-29","Mali","Ségou","Ségou","Je suis une femme simple, passionnée par la mode et le sport. Je participe à un groupe de prière chaque semaine. Je cherche une relation sérieuse, en vue du mariage.",["Mode","Sport","Danse"],"Protestante (Église chrétienne évangélique)","Deux à trois fois par mois","Tous les jours","Très importante","Faire connaissance d'abord","male",27,43],
["demo.ml.03@profils-virtuels.yona.invalid","Emmanuel","male","2004-02-18","Mali","Kayes","Kayes","Chaque journée est un cadeau de Dieu : je la remplis de photographie et de cinéma. Ma foi guide chacune de mes décisions. Je cherche une relation sérieuse, en vue du mariage.",["Sport","Bénévolat","Cinéma","Photographie"],"Baptiste","Plusieurs fois par semaine","Tous les jours","Essentielle","Relation sérieuse","female",18,32],
["demo.ml.04@profils-virtuels.yona.invalid","André","male","1993-02-16","Mali","Ségou","San","Souriant et attentionné, j'aime le sport et la musique. La prière rythme mes journées. J'attends une femme de foi, douce et pleine de joie.",["Sport","Cinéma","Musique","Cuisine"],"Évangélique","Plusieurs fois par semaine","Tous les jours","Très importante","Mariage","female",27,43],
["demo.fr.01@profils-virtuels.yona.invalid","Émilie","female","1996-06-22","France","Occitanie","Montpellier","Souriante et attentionnée, j'aime la louange et le sport. La prière rythme mes journées. J'attends un homme de foi, doux et responsable.",["Louange","Photographie","Sport","Cuisine"],"Protestante réformée","Plusieurs fois par semaine","Tous les jours","Très importante","Mariage","male",24,40],
["demo.fr.02@profils-virtuels.yona.invalid","Juliette","female","2000-10-14","France","Centre-Val de Loire","Tours","Chaque journée est un cadeau de Dieu : je la remplis de balades dans la nature et de louange. Je chante dans la chorale de mon église. Je souhaite rencontrer un homme sincère pour construire un foyer béni.",["Louange","Nature","Voyages"],"Baptiste","Deux à trois fois par mois","Matin et soir","Très importante","Mariage","male",19,35],
["demo.fr.03@profils-virtuels.yona.invalid","Sophie","female","2001-03-09","France","Grand Est","Strasbourg","Douce mais déterminée, j'aime la louange, la photographie et les longues discussions. Ma foi guide chacune de mes décisions. J'attends un homme de foi, doux et responsable.",["Louange","Photographie"],"Protestante réformée","Plusieurs fois par semaine","Matin et soir","Au centre de ma vie","Faire connaissance d'abord","male",19,35],
["demo.fr.04@profils-virtuels.yona.invalid","Lucie","female","1991-10-11","France","Pays de la Loire","Angers","Douce mais déterminée, j'aime la cuisine, la louange et les longues discussions. Le Psaume 23 m'accompagne depuis toujours. Je cherche une relation sérieuse, en vue du mariage.",["Nature","Louange","Cuisine"],"Catholique","Plusieurs fois par semaine","Tous les jours","Très importante","Mariage","male",28,44],
["demo.fr.05@profils-virtuels.yona.invalid","Mathilde","female","2000-06-21","France","Auvergne-Rhône-Alpes","Lyon","Souriante et attentionnée, j'aime la louange et le sport. Je participe à un groupe de prière chaque semaine. J'attends un homme de foi, doux et responsable.",["Louange","Sport"],"Évangélique","Plusieurs fois par semaine","Matin et soir","Au centre de ma vie","Faire connaissance d'abord","male",20,36],
["demo.fr.06@profils-virtuels.yona.invalid","Hugo","male","1990-12-25","France","Occitanie","Toulouse","Dynamique et fidèle en amitié, je consacre mon temps libre à la photographie. Je participe à un groupe de prière chaque semaine. Je crois au mariage, à la fidélité et au respect.",["Photographie","Cuisine","Cinéma"],"Adventiste","Deux à trois fois par mois","Matin et soir","Essentielle","Faire connaissance d'abord","female",29,45],
["demo.fr.07@profils-virtuels.yona.invalid","Guillaume","male","2003-12-02","France","Auvergne-Rhône-Alpes","Grenoble","Souriant et attentionné, j'aime la louange et la lecture. Je participe à un groupe de prière chaque semaine. J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",["Lecture","Louange","Voyages"],"Baptiste","Deux à trois fois par mois","Matin et soir","Au centre de ma vie","Faire connaissance d'abord","female",18,32],
["demo.fr.08@profils-virtuels.yona.invalid","Louis","male","1996-06-29","France","New Aquitaine","Bordeaux","Souriant et attentionné, j'aime la mode et le cinéma. Je participe à un groupe de prière chaque semaine. Je crois au mariage, à la fidélité et au respect.",["Mode","Photographie","Cinéma","Louange"],"Adventiste","Plusieurs fois par semaine","Plusieurs fois par semaine","Essentielle","Relation sérieuse","female",24,40]
]$seed$;
  _col text;
BEGIN
  -- 0. Profils virtuels d'une version précédente absents de cette liste : retirés
  --    (uniquement des comptes virtuels : fournisseur « virtual » + adresse
  --    @profils-virtuels.yona.invalid). Il reste ainsi exactement 40 profils de démonstration.
  DELETE FROM auth.users u
  WHERE u.email LIKE '%@profils-virtuels.yona.invalid'
    AND u.raw_app_meta_data ->> 'provider' = 'virtual'
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_seed) e WHERE e ->> 0 = u.email);

  -- 1. Comptes sans mot de passe (le déclencheur handle_new_user crée users, profiles,
  --    préférences…). Un compte déjà présent (même adresse) n'est pas recréé.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  SELECT
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    e ->> 0, '', now(),
    jsonb_build_object('provider', 'virtual', 'providers', jsonb_build_array('virtual')),
    jsonb_build_object('first_name', e ->> 1, 'is_virtual', true),
    now(), now()
  FROM jsonb_array_elements(_seed) e
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = e ->> 0);

  -- Colonnes texte du service d'authentification : jamais NULL (sinon l'écran des
  -- utilisateurs de Supabase peut échouer). Seules les colonnes présentes sont touchées.
  FOREACH _col IN ARRAY ARRAY[
    'confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change',
    'email_change_token_current', 'phone_change', 'phone_change_token', 'reauthentication_token'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = _col
    ) THEN
      EXECUTE format(
        'UPDATE auth.users SET %I = '''' WHERE %I IS NULL AND email LIKE %L',
        _col, _col, '%@profils-virtuels.yona.invalid'
      );
    END IF;
  END LOOP;

  -- 2. Profils complets, actifs et visibles. Ils restent cachés aux membres tant
  --    qu'un administrateur ne leur a pas donné de photo (demo_photo_path).
  UPDATE public.profiles p
  SET first_name = e ->> 1,
      gender = (e ->> 2)::public.gender,
      birth_date = (e ->> 3)::date,
      country = e ->> 4,
      region = e ->> 5,
      city = e ->> 6,
      bio = e ->> 7,
      interests = ARRAY(SELECT jsonb_array_elements_text(e -> 8)),
      is_virtual = true,
      terms_accepted_at = coalesce(p.terms_accepted_at, now()),
      onboarding_step = 4,
      onboarding_completed_at = coalesce(p.onboarding_completed_at, now()),
      status = 'active',
      visibility = 'visible'
  FROM jsonb_array_elements(_seed) e
  JOIN public.users u ON u.email = e ->> 0
  WHERE p.user_id = u.id;

  UPDATE public.christian_profiles c
  SET denomination = e ->> 9,
      church_attendance = e ->> 10,
      prayer_practice = e ->> 11,
      faith_importance = e ->> 12
  FROM jsonb_array_elements(_seed) e
  JOIN public.users u ON u.email = e ->> 0
  WHERE c.user_id = u.id;

  UPDATE public.preferences pr
  SET relationship_goal = e ->> 13,
      preferred_gender = (e ->> 14)::public.gender,
      min_age = (e ->> 15)::smallint,
      max_age = (e ->> 16)::smallint
  FROM jsonb_array_elements(_seed) e
  JOIN public.users u ON u.email = e ->> 0
  WHERE pr.user_id = u.id;
END
$do$;
