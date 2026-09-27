-- Phase 6 / Étape 6.6 — Détecter les formes obfusquées.
-- La détection reconnaît désormais les numéros volontairement déguisés :
--   - chiffres spéciaux : pleine largeur (０６), exposants (⁰⁶), indices (₀₆), cerclés
--     (⓪①…⑨, ❶…❾, ➀…➈, ➊…➒), gras / doubles / sans empattement / chasse fixe
--     mathématiques (𝟎𝟘𝟢𝟬𝟶…), arabes-indiens (٠…٩), émojis touches (0️⃣…9️⃣) ;
--   - chiffres écrits en lettres, en français (zéro, un, deux… seize, dix-sept…
--     dix-neuf, vingt… soixante, soixante-dix…, quatre-vingt…, nombres composés comme
--     « trente-quatre », « soixante-dix-huit », « quatre-vingt-douze ») et en anglais
--     (zero, one… nine) ;
--   - lettres utilisées comme chiffres entre des chiffres : o → 0, l / i / | → 1 ;
--   - n'importe quel séparateur entre les chiffres : points, barres obliques, tirets
--     bas, virgules, deux-points, étoiles, dièses, émojis… et les mots « point »,
--     « tiret », « espace », « virgule », « slash », « dot », « dash ».
-- Pour ne pas bloquer de messages ordinaires, sont écartés avant l'analyse (en plus des
-- formes des étapes 6.3 et 6.4) : montants avec séparateurs de milliers en points,
-- virgules ou apostrophes, dates avec points ou barres (« 12/10/2026 », « 12.10.2026 »),
-- heures et plages horaires (« 14:30 », « 14h30-16h30 »).
-- Règles des étapes 6.1 à 6.5 conservées ; fonction toujours réservée au serveur.

CREATE OR REPLACE FUNCTION public.contains_phone_number(_text text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _t text := coalesce(_text, '');
  _prev text;
BEGIN
  -- Variantes du signe plus ramenées à « + » (6.2).
  _t := translate(_t, '＋⁺', '++');
  -- 6.3 — Tous les espaces ramenés à une espace simple.
  _t := translate(
    _t,
    E'              　\t\r\n\v\f',
    '                     '
  );
  -- 6.6 — Caractères invisibles supprimés (sélecteurs d'émoji, touches, largeur nulle).
  _t := regexp_replace(_t, E'[️︎⃣​‌‍⁠﻿]', '', 'g');
  -- 6.6 — Chiffres spéciaux ramenés aux chiffres ordinaires.
  _t := translate(_t, '０１２３４５６７８９', '0123456789');
  _t := translate(_t, '⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉', '01234567890123456789');
  _t := translate(_t, '⓪①②③④⑤⑥⑦⑧⑨⓿❶❷❸❹❺❻❼❽❾', '01234567890123456789');
  _t := translate(_t, '➀➁➂➃➄➅➆➇➈➊➋➌➍➎➏➐➑➒', '123456789123456789');
  _t := translate(_t, '𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡', '01234567890123456789');
  _t := translate(_t, '𝟢𝟣𝟤𝟥𝟦𝟧𝟨𝟩𝟪𝟫𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿', '012345678901234567890123456789');
  _t := translate(_t, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');

  _t := lower(_t);
  -- Accents retirés (pour « zéro » et les mots séparateurs).
  _t := translate(_t, 'àâäáãåéèêëíìîïóòôöõúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn');
  -- 6.4 — Tirets typographiques ramenés au tiret simple.
  _t := translate(_t, '‐‑‒–—−﹣－', '--------');
  -- 6.5 — Parenthèses et crochets (y compris pleine largeur) ramenés à ( et ).
  _t := translate(_t, '（）［］｛｝[]{}', '()()()()()');

  -- 6.6 — Nombres écrits en lettres (français, puis anglais), du plus long au plus court.
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]dix[- ]sept\M', ' 97 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]dix[- ]huit\M', ' 98 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]dix[- ]neuf\M', ' 99 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]onze\M', ' 91 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]douze\M', ' 92 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]treize\M', ' 93 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]quatorze\M', ' 94 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]quinze\M', ' 95 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]seize\M', ' 96 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]dix\M', ' 90 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ](un|une)\M', ' 81 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]deux\M', ' 82 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]trois\M', ' 83 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]quatre\M', ' 84 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]cinq\M', ' 85 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]six\M', ' 86 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]sept\M', ' 87 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]huit\M', ' 88 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]neuf\M', ' 89 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?\M', ' 80 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]dix[- ]sept\M', ' 77 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]dix[- ]huit\M', ' 78 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]dix[- ]neuf\M', ' 79 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ](et[- ])?onze\M', ' 71 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]douze\M', ' 72 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]treize\M', ' 73 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]quatorze\M', ' 74 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]quinze\M', ' 75 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]seize\M', ' 76 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]dix\M', ' 70 ', 'g');
  _t := regexp_replace(_t, '\mdix[- ]sept\M', ' 17 ', 'g');
  _t := regexp_replace(_t, '\mdix[- ]huit\M', ' 18 ', 'g');
  _t := regexp_replace(_t, '\mdix[- ]neuf\M', ' 19 ', 'g');
  -- Dizaines suivies d'une unité (« trente-quatre », « vingt et un »).
  _t := regexp_replace(_t, '\mvingt[- ](et[- ])?', ' 2', 'g');
  _t := regexp_replace(_t, '\mtrente[- ](et[- ])?', ' 3', 'g');
  _t := regexp_replace(_t, '\mquarante[- ](et[- ])?', ' 4', 'g');
  _t := regexp_replace(_t, '\mcinquante[- ](et[- ])?', ' 5', 'g');
  _t := regexp_replace(_t, '\msoixante[- ](et[- ])?', ' 6', 'g');
  _t := regexp_replace(_t, '\m([2-6])(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf)\M', '\1\2', 'g');
  _t := regexp_replace(_t, '\mvingt\M', ' 20 ', 'g');
  _t := regexp_replace(_t, '\mtrente\M', ' 30 ', 'g');
  _t := regexp_replace(_t, '\mquarante\M', ' 40 ', 'g');
  _t := regexp_replace(_t, '\mcinquante\M', ' 50 ', 'g');
  _t := regexp_replace(_t, '\msoixante\M', ' 60 ', 'g');
  _t := regexp_replace(_t, '\monze\M', ' 11 ', 'g');
  _t := regexp_replace(_t, '\mdouze\M', ' 12 ', 'g');
  _t := regexp_replace(_t, '\mtreize\M', ' 13 ', 'g');
  _t := regexp_replace(_t, '\mquatorze\M', ' 14 ', 'g');
  _t := regexp_replace(_t, '\mquinze\M', ' 15 ', 'g');
  _t := regexp_replace(_t, '\mseize\M', ' 16 ', 'g');
  _t := regexp_replace(_t, '\mdix\M', ' 10 ', 'g');
  -- Unités (une dizaine déjà convertie peut précéder : « 3quatre » → « 34 »).
  _t := regexp_replace(_t, '(zero|\mzero)\M', ' 0 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)(un|une)\M', '\1 1 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)deux\M', '\1 2 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)trois\M', '\1 3 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)quatre\M', '\1 4 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)cinq\M', '\1 5 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)six\M', '\1 6 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)sept\M', '\1 7 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)huit\M', '\1 8 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)neuf\M', '\1 9 ', 'g');
  _t := regexp_replace(_t, '([2-6]) ([0-9]) ', '\1\2 ', 'g');
  -- Anglais.
  _t := regexp_replace(_t, '\mone\M', ' 1 ', 'g');
  _t := regexp_replace(_t, '\mtwo\M', ' 2 ', 'g');
  _t := regexp_replace(_t, '\mthree\M', ' 3 ', 'g');
  _t := regexp_replace(_t, '\mfour\M', ' 4 ', 'g');
  _t := regexp_replace(_t, '\mfive\M', ' 5 ', 'g');
  _t := regexp_replace(_t, '\mseven\M', ' 7 ', 'g');
  _t := regexp_replace(_t, '\meight\M', ' 8 ', 'g');
  _t := regexp_replace(_t, '\mnine\M', ' 9 ', 'g');
  -- Mots utilisés comme séparateurs.
  _t := regexp_replace(_t, '\m(point|tiret|espace|virgule|slash|dot|dash)\M', ' ', 'g');

  -- 6.6 — Lettres utilisées comme chiffres entre des chiffres : o → 0 ; l, i, | → 1.
  LOOP
    _prev := _t;
    _t := regexp_replace(_t, '([0-9][^[:alpha:][:digit:]]*)o(?=[^[:alpha:][:digit:]]*[0-9])', '\10', 'g');
    _t := regexp_replace(_t, '([0-9][^[:alpha:][:digit:]]*)[li|](?=[^[:alpha:][:digit:]]*[0-9])', '\11', 'g');
    _t := regexp_replace(_t, '\mo(?=[0-9])', '0', 'g');
    EXIT WHEN _t = _prev;
  END LOOP;

  -- Formes ordinaires écartées : montants avec devise (séparateurs de milliers en
  -- espaces, points, virgules ou apostrophes), dates, heures et plages horaires.
  _t := regexp_replace(
    _t,
    '[0-9]{1,3}([ .,''][0-9]{3})+ ?(f ?cfa|cfa|xaf|xof|francs?|f\M|€|euros?|eur\M|\$|usd|dollars?)',
    ' ', 'g');
  _t := regexp_replace(_t, '(€|\$|usd|eur) ?[0-9]{1,3}([ .,''][0-9]{3})+', ' ', 'g');
  _t := regexp_replace(_t, '\m[0-9]{1,2} ?[ ./-] ?[0-9]{1,2} ?[ ./-] ?(19|20)[0-9]{2}\M', ' ', 'g');
  _t := regexp_replace(_t, '\m(19|20)[0-9]{2} ?[./-] ?[0-9]{1,2} ?[./-] ?[0-9]{1,2}\M', ' ', 'g');
  _t := regexp_replace(_t, '\m(19|20)[0-9]{2} ?- ?(19|20)[0-9]{2}\M', ' ', 'g');
  _t := regexp_replace(
    _t,
    '\m([01]?[0-9]|2[0-3]) ?[:h] ?[0-5][0-9] ?(-|a) ?([01]?[0-9]|2[0-3]) ?[:h] ?[0-5][0-9]\M',
    ' ', 'g');
  _t := regexp_replace(
    _t,
    '\m([01]?[0-9]|2[0-3]) ?[:h] ?[0-5][0-9]\M(?![ ]*[:./-][ ]*[0-9])',
    ' ', 'g');

  -- Séparateurs entre les chiffres (et après un « + ») supprimés : espaces (6.3),
  -- tirets (6.4), parenthèses (6.5) et tout autre signe (6.6).
  _t := regexp_replace(_t, '\(( ?\+? ?[0-9][0-9 -]*) ?\)', ' \1 ', 'g');
  _t := regexp_replace(_t, '\+[^[:alpha:][:digit:]+]+(?=[0-9])', '+', 'g');
  _t := regexp_replace(_t, '([0-9])[^[:alpha:][:digit:]+]+(?=[0-9])', '\1', 'g');

  -- 6.1 — Numéro classique : au moins 8 chiffres à la suite.
  IF _t ~ '[0-9]{8,}' THEN
    RETURN true;
  END IF;

  -- 6.2 — Format international : « + » suivi d'au moins 7 chiffres.
  IF _t ~ '\+[0-9]{7,}' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.contains_phone_number(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contains_phone_number(text) TO service_role;
