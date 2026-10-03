-- ============================================================
-- Localisation réelle des membres (tâche E)
--
-- Position retenue d'un membre, par ordre de priorité (repli automatique) :
--   1. « device »   : position de l'appareil (GPS / Wi-Fi), non trompée par un VPN ;
--   2. « declared » : ville, région et pays choisis à l'étape « Où es-tu ? » ;
--   3. « ip »       : pays et ville déduits de l'adresse IP (dernier recours ; un VPN
--                     la change). Jamais retenue si une position appareil ou déclarée existe.
-- Le géocodage (position → ville, ville → position) est fait par le serveur du site
-- (données GeoNames embarquées) ; la base garde la position retenue dans profile_locations
-- (table existante) et compare à chaque visite les indices : pays de l'adresse IP et
-- fuseau horaire du navigateur. S'ils contredisent la position retenue (VPN possible), un
-- drapeau « incohérence de localisation » est visible par l'administration. Aucun blocage.
--
-- Les profils de démonstration gardent leur propre ville (pas de copie de la ville du
-- membre : ce serait tromper le membre).
-- Le pays retenu sert au retrait d'un profil de démonstration (member_country).
-- Rejouable.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Position retenue et indices (table existante, colonnes ajoutées)
-- ------------------------------------------------------------
ALTER TABLE public.profile_locations
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'device'
    CONSTRAINT profile_locations_source_check CHECK (source IN ('device', 'declared', 'ip')),
  ADD COLUMN IF NOT EXISTS country_code text
    CONSTRAINT profile_locations_country_code_check CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS accuracy_m integer,
  ADD COLUMN IF NOT EXISTS ip_country text,
  ADD COLUMN IF NOT EXISTS ip_city text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS inconsistent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inconsistency text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS checked_at timestamptz;
COMMENT ON COLUMN public.profile_locations.source IS
  'Origine de la position retenue : device (appareil), declared (ville choisie), ip (adresse IP, dernier recours).';
COMMENT ON COLUMN public.profile_locations.inconsistency IS
  'Indices qui contredisent la position retenue (ip_country:FR, timezone:Europe/Paris, declared_country:France) : VPN possible.';
CREATE INDEX IF NOT EXISTS profile_locations_inconsistent_idx ON public.profile_locations (checked_at DESC)
  WHERE inconsistent;

-- ------------------------------------------------------------
-- 2. Fuseau horaire → pays possibles (base IANA, scripts/generate-timezones.mjs)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_timezones (
  tz text PRIMARY KEY,
  country_codes text[] NOT NULL
);
COMMENT ON TABLE public.geo_timezones IS 'Fuseau horaire IANA → pays où il est utilisé (indice de localisation).';
ALTER TABLE public.geo_timezones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.geo_timezones FROM anon, authenticated;
GRANT ALL ON public.geo_timezones TO service_role;

INSERT INTO public.geo_timezones (tz, country_codes) VALUES
  ('Africa/Abidjan', ARRAY['BF', 'CI', 'GH', 'GM', 'GN', 'IS', 'ML', 'MR', 'SH', 'SL', 'SN', 'TG']),
  ('Africa/Accra', ARRAY['GH']),
  ('Africa/Addis_Ababa', ARRAY['ET']),
  ('Africa/Algiers', ARRAY['DZ']),
  ('Africa/Asmara', ARRAY['ER']),
  ('Africa/Asmera', ARRAY['ER']),
  ('Africa/Bamako', ARRAY['ML']),
  ('Africa/Bangui', ARRAY['CF']),
  ('Africa/Banjul', ARRAY['GM']),
  ('Africa/Bissau', ARRAY['GW']),
  ('Africa/Blantyre', ARRAY['MW']),
  ('Africa/Brazzaville', ARRAY['CG']),
  ('Africa/Bujumbura', ARRAY['BI']),
  ('Africa/Cairo', ARRAY['EG']),
  ('Africa/Casablanca', ARRAY['MA']),
  ('Africa/Ceuta', ARRAY['ES']),
  ('Africa/Conakry', ARRAY['GN']),
  ('Africa/Dakar', ARRAY['SN']),
  ('Africa/Dar_es_Salaam', ARRAY['TZ']),
  ('Africa/Djibouti', ARRAY['DJ']),
  ('Africa/Douala', ARRAY['CM']),
  ('Africa/El_Aaiun', ARRAY['EH']),
  ('Africa/Freetown', ARRAY['SL']),
  ('Africa/Gaborone', ARRAY['BW']),
  ('Africa/Harare', ARRAY['ZW']),
  ('Africa/Johannesburg', ARRAY['LS', 'SZ', 'ZA']),
  ('Africa/Juba', ARRAY['SS']),
  ('Africa/Kampala', ARRAY['UG']),
  ('Africa/Khartoum', ARRAY['SD']),
  ('Africa/Kigali', ARRAY['RW']),
  ('Africa/Kinshasa', ARRAY['CD']),
  ('Africa/Lagos', ARRAY['AO', 'BJ', 'CD', 'CF', 'CG', 'CM', 'GA', 'GQ', 'NE', 'NG']),
  ('Africa/Libreville', ARRAY['GA']),
  ('Africa/Lome', ARRAY['TG']),
  ('Africa/Luanda', ARRAY['AO']),
  ('Africa/Lubumbashi', ARRAY['CD']),
  ('Africa/Lusaka', ARRAY['ZM']),
  ('Africa/Malabo', ARRAY['GQ']),
  ('Africa/Maputo', ARRAY['BI', 'BW', 'CD', 'MW', 'MZ', 'RW', 'ZM', 'ZW']),
  ('Africa/Maseru', ARRAY['LS']),
  ('Africa/Mbabane', ARRAY['SZ']),
  ('Africa/Mogadishu', ARRAY['SO']),
  ('Africa/Monrovia', ARRAY['LR']),
  ('Africa/Nairobi', ARRAY['DJ', 'ER', 'ET', 'KE', 'KM', 'MG', 'SO', 'TZ', 'UG', 'YT']),
  ('Africa/Ndjamena', ARRAY['TD']),
  ('Africa/Niamey', ARRAY['NE']),
  ('Africa/Nouakchott', ARRAY['MR']),
  ('Africa/Ouagadougou', ARRAY['BF']),
  ('Africa/Porto-Novo', ARRAY['BJ']),
  ('Africa/Sao_Tome', ARRAY['ST']),
  ('Africa/Timbuktu', ARRAY['ML']),
  ('Africa/Tripoli', ARRAY['LY']),
  ('Africa/Tunis', ARRAY['TN']),
  ('Africa/Windhoek', ARRAY['NA']),
  ('America/Adak', ARRAY['US']),
  ('America/Anchorage', ARRAY['US']),
  ('America/Anguilla', ARRAY['AI']),
  ('America/Antigua', ARRAY['AG']),
  ('America/Araguaina', ARRAY['BR']),
  ('America/Argentina/Buenos_Aires', ARRAY['AR']),
  ('America/Argentina/Catamarca', ARRAY['AR']),
  ('America/Argentina/ComodRivadavia', ARRAY['AR']),
  ('America/Argentina/Cordoba', ARRAY['AR']),
  ('America/Argentina/Jujuy', ARRAY['AR']),
  ('America/Argentina/La_Rioja', ARRAY['AR']),
  ('America/Argentina/Mendoza', ARRAY['AR']),
  ('America/Argentina/Rio_Gallegos', ARRAY['AR']),
  ('America/Argentina/Salta', ARRAY['AR']),
  ('America/Argentina/San_Juan', ARRAY['AR']),
  ('America/Argentina/San_Luis', ARRAY['AR']),
  ('America/Argentina/Tucuman', ARRAY['AR']),
  ('America/Argentina/Ushuaia', ARRAY['AR']),
  ('America/Aruba', ARRAY['AW']),
  ('America/Asuncion', ARRAY['PY']),
  ('America/Atikokan', ARRAY['CA']),
  ('America/Atka', ARRAY['US']),
  ('America/Bahia', ARRAY['BR']),
  ('America/Bahia_Banderas', ARRAY['MX']),
  ('America/Barbados', ARRAY['BB']),
  ('America/Belem', ARRAY['BR']),
  ('America/Belize', ARRAY['BZ']),
  ('America/Blanc-Sablon', ARRAY['CA']),
  ('America/Boa_Vista', ARRAY['BR']),
  ('America/Bogota', ARRAY['CO']),
  ('America/Boise', ARRAY['US']),
  ('America/Buenos_Aires', ARRAY['AR']),
  ('America/Cambridge_Bay', ARRAY['CA']),
  ('America/Campo_Grande', ARRAY['BR']),
  ('America/Cancun', ARRAY['MX']),
  ('America/Caracas', ARRAY['VE']),
  ('America/Catamarca', ARRAY['AR']),
  ('America/Cayenne', ARRAY['GF']),
  ('America/Cayman', ARRAY['KY']),
  ('America/Chicago', ARRAY['US']),
  ('America/Chihuahua', ARRAY['MX']),
  ('America/Ciudad_Juarez', ARRAY['MX']),
  ('America/Coral_Harbour', ARRAY['CA']),
  ('America/Cordoba', ARRAY['AR']),
  ('America/Costa_Rica', ARRAY['CR']),
  ('America/Coyhaique', ARRAY['CL']),
  ('America/Creston', ARRAY['CA']),
  ('America/Cuiaba', ARRAY['BR']),
  ('America/Curacao', ARRAY['CW']),
  ('America/Danmarkshavn', ARRAY['GL']),
  ('America/Dawson', ARRAY['CA']),
  ('America/Dawson_Creek', ARRAY['CA']),
  ('America/Denver', ARRAY['US']),
  ('America/Detroit', ARRAY['US']),
  ('America/Dominica', ARRAY['DM']),
  ('America/Edmonton', ARRAY['CA']),
  ('America/Eirunepe', ARRAY['BR']),
  ('America/El_Salvador', ARRAY['SV']),
  ('America/Ensenada', ARRAY['MX']),
  ('America/Fort_Nelson', ARRAY['CA']),
  ('America/Fort_Wayne', ARRAY['US']),
  ('America/Fortaleza', ARRAY['BR']),
  ('America/Glace_Bay', ARRAY['CA']),
  ('America/Godthab', ARRAY['GL']),
  ('America/Goose_Bay', ARRAY['CA']),
  ('America/Grand_Turk', ARRAY['TC']),
  ('America/Grenada', ARRAY['GD']),
  ('America/Guadeloupe', ARRAY['GP']),
  ('America/Guatemala', ARRAY['GT']),
  ('America/Guayaquil', ARRAY['EC']),
  ('America/Guyana', ARRAY['GY']),
  ('America/Halifax', ARRAY['CA']),
  ('America/Havana', ARRAY['CU']),
  ('America/Hermosillo', ARRAY['MX']),
  ('America/Indiana/Indianapolis', ARRAY['US']),
  ('America/Indiana/Knox', ARRAY['US']),
  ('America/Indiana/Marengo', ARRAY['US']),
  ('America/Indiana/Petersburg', ARRAY['US']),
  ('America/Indiana/Tell_City', ARRAY['US']),
  ('America/Indiana/Vevay', ARRAY['US']),
  ('America/Indiana/Vincennes', ARRAY['US']),
  ('America/Indiana/Winamac', ARRAY['US']),
  ('America/Indianapolis', ARRAY['US']),
  ('America/Inuvik', ARRAY['CA']),
  ('America/Iqaluit', ARRAY['CA']),
  ('America/Jamaica', ARRAY['JM']),
  ('America/Jujuy', ARRAY['AR']),
  ('America/Juneau', ARRAY['US']),
  ('America/Kentucky/Louisville', ARRAY['US']),
  ('America/Kentucky/Monticello', ARRAY['US']),
  ('America/Knox_IN', ARRAY['US']),
  ('America/Kralendijk', ARRAY['BQ', 'CW']),
  ('America/La_Paz', ARRAY['BO']),
  ('America/Lima', ARRAY['PE']),
  ('America/Los_Angeles', ARRAY['US']),
  ('America/Louisville', ARRAY['US']),
  ('America/Lower_Princes', ARRAY['CW', 'SX']),
  ('America/Maceio', ARRAY['BR']),
  ('America/Managua', ARRAY['NI']),
  ('America/Manaus', ARRAY['BR']),
  ('America/Marigot', ARRAY['MF', 'TT']),
  ('America/Martinique', ARRAY['MQ']),
  ('America/Matamoros', ARRAY['MX']),
  ('America/Mazatlan', ARRAY['MX']),
  ('America/Mendoza', ARRAY['AR']),
  ('America/Menominee', ARRAY['US']),
  ('America/Merida', ARRAY['MX']),
  ('America/Metlakatla', ARRAY['US']),
  ('America/Mexico_City', ARRAY['MX']),
  ('America/Miquelon', ARRAY['PM']),
  ('America/Moncton', ARRAY['CA']),
  ('America/Monterrey', ARRAY['MX']),
  ('America/Montevideo', ARRAY['UY']),
  ('America/Montreal', ARRAY['BS', 'CA']),
  ('America/Montserrat', ARRAY['MS']),
  ('America/Nassau', ARRAY['BS']),
  ('America/New_York', ARRAY['US']),
  ('America/Nipigon', ARRAY['BS', 'CA']),
  ('America/Nome', ARRAY['US']),
  ('America/Noronha', ARRAY['BR']),
  ('America/North_Dakota/Beulah', ARRAY['US']),
  ('America/North_Dakota/Center', ARRAY['US']),
  ('America/North_Dakota/New_Salem', ARRAY['US']),
  ('America/Nuuk', ARRAY['GL']),
  ('America/Ojinaga', ARRAY['MX']),
  ('America/Panama', ARRAY['CA', 'KY', 'PA']),
  ('America/Pangnirtung', ARRAY['CA']),
  ('America/Paramaribo', ARRAY['SR']),
  ('America/Phoenix', ARRAY['CA', 'US']),
  ('America/Port_of_Spain', ARRAY['TT']),
  ('America/Port-au-Prince', ARRAY['HT']),
  ('America/Porto_Acre', ARRAY['BR']),
  ('America/Porto_Velho', ARRAY['BR']),
  ('America/Puerto_Rico', ARRAY['AG', 'AI', 'AW', 'BL', 'BQ', 'CA', 'CW', 'DM', 'GD', 'GP', 'KN', 'LC', 'MF', 'MS', 'PR', 'SX', 'TT', 'VC', 'VG', 'VI']),
  ('America/Punta_Arenas', ARRAY['CL']),
  ('America/Rainy_River', ARRAY['CA']),
  ('America/Rankin_Inlet', ARRAY['CA']),
  ('America/Recife', ARRAY['BR']),
  ('America/Regina', ARRAY['CA']),
  ('America/Resolute', ARRAY['CA']),
  ('America/Rio_Branco', ARRAY['BR']),
  ('America/Rosario', ARRAY['AR']),
  ('America/Santa_Isabel', ARRAY['MX']),
  ('America/Santarem', ARRAY['BR']),
  ('America/Santiago', ARRAY['CL']),
  ('America/Santo_Domingo', ARRAY['DO']),
  ('America/Sao_Paulo', ARRAY['BR']),
  ('America/Scoresbysund', ARRAY['GL']),
  ('America/Shiprock', ARRAY['US']),
  ('America/Sitka', ARRAY['US']),
  ('America/St_Barthelemy', ARRAY['BL', 'TT']),
  ('America/St_Johns', ARRAY['CA']),
  ('America/St_Kitts', ARRAY['KN']),
  ('America/St_Lucia', ARRAY['LC']),
  ('America/St_Thomas', ARRAY['VI']),
  ('America/St_Vincent', ARRAY['VC']),
  ('America/Swift_Current', ARRAY['CA']),
  ('America/Tegucigalpa', ARRAY['HN']),
  ('America/Thule', ARRAY['GL']),
  ('America/Thunder_Bay', ARRAY['BS', 'CA']),
  ('America/Tijuana', ARRAY['MX']),
  ('America/Toronto', ARRAY['BS', 'CA']),
  ('America/Tortola', ARRAY['VG']),
  ('America/Vancouver', ARRAY['CA']),
  ('America/Virgin', ARRAY['VI']),
  ('America/Whitehorse', ARRAY['CA']),
  ('America/Winnipeg', ARRAY['CA']),
  ('America/Yakutat', ARRAY['US']),
  ('America/Yellowknife', ARRAY['CA']),
  ('Antarctica/Casey', ARRAY['AQ']),
  ('Antarctica/Davis', ARRAY['AQ']),
  ('Antarctica/DumontDUrville', ARRAY['AQ']),
  ('Antarctica/Macquarie', ARRAY['AU']),
  ('Antarctica/Mawson', ARRAY['AQ']),
  ('Antarctica/McMurdo', ARRAY['AQ']),
  ('Antarctica/Palmer', ARRAY['AQ']),
  ('Antarctica/Rothera', ARRAY['AQ']),
  ('Antarctica/South_Pole', ARRAY['AQ']),
  ('Antarctica/Syowa', ARRAY['AQ']),
  ('Antarctica/Troll', ARRAY['AQ']),
  ('Antarctica/Vostok', ARRAY['AQ']),
  ('Arctic/Longyearbyen', ARRAY['NO', 'SJ']),
  ('Asia/Aden', ARRAY['YE']),
  ('Asia/Almaty', ARRAY['KZ']),
  ('Asia/Amman', ARRAY['JO']),
  ('Asia/Anadyr', ARRAY['RU']),
  ('Asia/Aqtau', ARRAY['KZ']),
  ('Asia/Aqtobe', ARRAY['KZ']),
  ('Asia/Ashgabat', ARRAY['TM']),
  ('Asia/Ashkhabad', ARRAY['TM']),
  ('Asia/Atyrau', ARRAY['KZ']),
  ('Asia/Baghdad', ARRAY['IQ']),
  ('Asia/Bahrain', ARRAY['BH']),
  ('Asia/Baku', ARRAY['AZ']),
  ('Asia/Bangkok', ARRAY['CX', 'KH', 'LA', 'TH', 'VN']),
  ('Asia/Barnaul', ARRAY['RU']),
  ('Asia/Beirut', ARRAY['LB']),
  ('Asia/Bishkek', ARRAY['KG']),
  ('Asia/Brunei', ARRAY['BN']),
  ('Asia/Calcutta', ARRAY['IN']),
  ('Asia/Chita', ARRAY['RU']),
  ('Asia/Choibalsan', ARRAY['MN']),
  ('Asia/Chongqing', ARRAY['CN']),
  ('Asia/Chungking', ARRAY['CN']),
  ('Asia/Colombo', ARRAY['LK']),
  ('Asia/Dacca', ARRAY['BD']),
  ('Asia/Damascus', ARRAY['SY']),
  ('Asia/Dhaka', ARRAY['BD']),
  ('Asia/Dili', ARRAY['TL']),
  ('Asia/Dubai', ARRAY['AE', 'OM', 'RE', 'SC', 'TF']),
  ('Asia/Dushanbe', ARRAY['TJ']),
  ('Asia/Famagusta', ARRAY['CY']),
  ('Asia/Gaza', ARRAY['PS']),
  ('Asia/Harbin', ARRAY['CN']),
  ('Asia/Hebron', ARRAY['PS']),
  ('Asia/Ho_Chi_Minh', ARRAY['VN']),
  ('Asia/Hong_Kong', ARRAY['HK']),
  ('Asia/Hovd', ARRAY['MN']),
  ('Asia/Irkutsk', ARRAY['RU']),
  ('Asia/Istanbul', ARRAY['TR']),
  ('Asia/Jakarta', ARRAY['ID']),
  ('Asia/Jayapura', ARRAY['ID']),
  ('Asia/Jerusalem', ARRAY['IL']),
  ('Asia/Kabul', ARRAY['AF']),
  ('Asia/Kamchatka', ARRAY['RU']),
  ('Asia/Karachi', ARRAY['PK']),
  ('Asia/Kashgar', ARRAY['CN']),
  ('Asia/Kathmandu', ARRAY['NP']),
  ('Asia/Katmandu', ARRAY['NP']),
  ('Asia/Khandyga', ARRAY['RU']),
  ('Asia/Kolkata', ARRAY['IN']),
  ('Asia/Krasnoyarsk', ARRAY['RU']),
  ('Asia/Kuala_Lumpur', ARRAY['MY']),
  ('Asia/Kuching', ARRAY['BN', 'MY']),
  ('Asia/Kuwait', ARRAY['KW']),
  ('Asia/Macao', ARRAY['MO']),
  ('Asia/Macau', ARRAY['MO']),
  ('Asia/Magadan', ARRAY['RU']),
  ('Asia/Makassar', ARRAY['ID']),
  ('Asia/Manila', ARRAY['PH']),
  ('Asia/Muscat', ARRAY['OM']),
  ('Asia/Nicosia', ARRAY['CY']),
  ('Asia/Novokuznetsk', ARRAY['RU']),
  ('Asia/Novosibirsk', ARRAY['RU']),
  ('Asia/Omsk', ARRAY['RU']),
  ('Asia/Oral', ARRAY['KZ']),
  ('Asia/Phnom_Penh', ARRAY['KH']),
  ('Asia/Pontianak', ARRAY['ID']),
  ('Asia/Pyongyang', ARRAY['KP']),
  ('Asia/Qatar', ARRAY['BH', 'QA']),
  ('Asia/Qostanay', ARRAY['KZ']),
  ('Asia/Qyzylorda', ARRAY['KZ']),
  ('Asia/Rangoon', ARRAY['CC', 'MM']),
  ('Asia/Riyadh', ARRAY['AQ', 'KW', 'SA', 'YE']),
  ('Asia/Saigon', ARRAY['VN']),
  ('Asia/Sakhalin', ARRAY['RU']),
  ('Asia/Samarkand', ARRAY['UZ']),
  ('Asia/Seoul', ARRAY['KR']),
  ('Asia/Shanghai', ARRAY['CN']),
  ('Asia/Singapore', ARRAY['AQ', 'MY', 'SG']),
  ('Asia/Srednekolymsk', ARRAY['RU']),
  ('Asia/Taipei', ARRAY['TW']),
  ('Asia/Tashkent', ARRAY['UZ']),
  ('Asia/Tbilisi', ARRAY['GE']),
  ('Asia/Tehran', ARRAY['IR']),
  ('Asia/Tel_Aviv', ARRAY['IL']),
  ('Asia/Thimbu', ARRAY['BT']),
  ('Asia/Thimphu', ARRAY['BT']),
  ('Asia/Tokyo', ARRAY['AU', 'JP']),
  ('Asia/Tomsk', ARRAY['RU']),
  ('Asia/Ujung_Pandang', ARRAY['ID']),
  ('Asia/Ulaanbaatar', ARRAY['MN']),
  ('Asia/Ulan_Bator', ARRAY['MN']),
  ('Asia/Urumqi', ARRAY['CN']),
  ('Asia/Ust-Nera', ARRAY['RU']),
  ('Asia/Vientiane', ARRAY['LA']),
  ('Asia/Vladivostok', ARRAY['RU']),
  ('Asia/Yakutsk', ARRAY['RU']),
  ('Asia/Yangon', ARRAY['CC', 'MM']),
  ('Asia/Yekaterinburg', ARRAY['RU']),
  ('Asia/Yerevan', ARRAY['AM']),
  ('Atlantic/Azores', ARRAY['PT']),
  ('Atlantic/Bermuda', ARRAY['BM']),
  ('Atlantic/Canary', ARRAY['ES']),
  ('Atlantic/Cape_Verde', ARRAY['CV']),
  ('Atlantic/Faeroe', ARRAY['FO']),
  ('Atlantic/Faroe', ARRAY['FO']),
  ('Atlantic/Jan_Mayen', ARRAY['NO']),
  ('Atlantic/Madeira', ARRAY['PT']),
  ('Atlantic/Reykjavik', ARRAY['IS']),
  ('Atlantic/South_Georgia', ARRAY['GS']),
  ('Atlantic/St_Helena', ARRAY['SH']),
  ('Atlantic/Stanley', ARRAY['FK']),
  ('Australia/ACT', ARRAY['AU']),
  ('Australia/Adelaide', ARRAY['AU']),
  ('Australia/Brisbane', ARRAY['AU']),
  ('Australia/Broken_Hill', ARRAY['AU']),
  ('Australia/Canberra', ARRAY['AU']),
  ('Australia/Currie', ARRAY['AU']),
  ('Australia/Darwin', ARRAY['AU']),
  ('Australia/Eucla', ARRAY['AU']),
  ('Australia/Hobart', ARRAY['AU']),
  ('Australia/LHI', ARRAY['AU']),
  ('Australia/Lindeman', ARRAY['AU']),
  ('Australia/Lord_Howe', ARRAY['AU']),
  ('Australia/Melbourne', ARRAY['AU']),
  ('Australia/North', ARRAY['AU']),
  ('Australia/NSW', ARRAY['AU']),
  ('Australia/Perth', ARRAY['AU']),
  ('Australia/Queensland', ARRAY['AU']),
  ('Australia/South', ARRAY['AU']),
  ('Australia/Sydney', ARRAY['AU']),
  ('Australia/Tasmania', ARRAY['AU']),
  ('Australia/Victoria', ARRAY['AU']),
  ('Australia/West', ARRAY['AU']),
  ('Australia/Yancowinna', ARRAY['AU']),
  ('Brazil/Acre', ARRAY['BR']),
  ('Brazil/DeNoronha', ARRAY['BR']),
  ('Brazil/East', ARRAY['BR']),
  ('Brazil/West', ARRAY['BR']),
  ('Canada/Atlantic', ARRAY['CA']),
  ('Canada/Central', ARRAY['CA']),
  ('Canada/Eastern', ARRAY['BS', 'CA']),
  ('Canada/Mountain', ARRAY['CA']),
  ('Canada/Newfoundland', ARRAY['CA']),
  ('Canada/Pacific', ARRAY['CA']),
  ('Canada/Saskatchewan', ARRAY['CA']),
  ('Canada/Yukon', ARRAY['CA']),
  ('Chile/Continental', ARRAY['CL']),
  ('Chile/EasterIsland', ARRAY['CL']),
  ('Cuba', ARRAY['CU']),
  ('Egypt', ARRAY['EG']),
  ('Eire', ARRAY['IE']),
  ('Europe/Amsterdam', ARRAY['NL']),
  ('Europe/Andorra', ARRAY['AD']),
  ('Europe/Astrakhan', ARRAY['RU']),
  ('Europe/Athens', ARRAY['GR']),
  ('Europe/Belfast', ARRAY['GB', 'GG', 'IM', 'JE']),
  ('Europe/Belgrade', ARRAY['BA', 'HR', 'ME', 'MK', 'RS', 'SI']),
  ('Europe/Berlin', ARRAY['DE', 'DK', 'NO', 'SE', 'SJ']),
  ('Europe/Bratislava', ARRAY['CZ', 'SK']),
  ('Europe/Brussels', ARRAY['BE', 'LU', 'NL']),
  ('Europe/Bucharest', ARRAY['RO']),
  ('Europe/Budapest', ARRAY['HU']),
  ('Europe/Busingen', ARRAY['CH', 'DE', 'LI']),
  ('Europe/Chisinau', ARRAY['MD']),
  ('Europe/Copenhagen', ARRAY['DK']),
  ('Europe/Dublin', ARRAY['IE']),
  ('Europe/Gibraltar', ARRAY['GI']),
  ('Europe/Guernsey', ARRAY['GG']),
  ('Europe/Helsinki', ARRAY['AX', 'FI']),
  ('Europe/Isle_of_Man', ARRAY['IM']),
  ('Europe/Istanbul', ARRAY['TR']),
  ('Europe/Jersey', ARRAY['JE']),
  ('Europe/Kaliningrad', ARRAY['RU']),
  ('Europe/Kiev', ARRAY['UA']),
  ('Europe/Kirov', ARRAY['RU']),
  ('Europe/Kyiv', ARRAY['UA']),
  ('Europe/Lisbon', ARRAY['PT']),
  ('Europe/Ljubljana', ARRAY['SI']),
  ('Europe/London', ARRAY['GB', 'GG', 'IM', 'JE']),
  ('Europe/Luxembourg', ARRAY['LU']),
  ('Europe/Madrid', ARRAY['ES']),
  ('Europe/Malta', ARRAY['MT']),
  ('Europe/Mariehamn', ARRAY['AX', 'FI']),
  ('Europe/Minsk', ARRAY['BY']),
  ('Europe/Monaco', ARRAY['MC']),
  ('Europe/Moscow', ARRAY['RU']),
  ('Europe/Nicosia', ARRAY['CY']),
  ('Europe/Oslo', ARRAY['NO']),
  ('Europe/Paris', ARRAY['FR', 'MC']),
  ('Europe/Podgorica', ARRAY['BA', 'HR', 'ME', 'MK', 'RS', 'SI']),
  ('Europe/Prague', ARRAY['CZ', 'SK']),
  ('Europe/Riga', ARRAY['LV']),
  ('Europe/Rome', ARRAY['IT', 'SM', 'VA']),
  ('Europe/Samara', ARRAY['RU']),
  ('Europe/San_Marino', ARRAY['IT', 'SM', 'VA']),
  ('Europe/Sarajevo', ARRAY['BA']),
  ('Europe/Saratov', ARRAY['RU']),
  ('Europe/Simferopol', ARRAY['RU', 'UA']),
  ('Europe/Skopje', ARRAY['MK']),
  ('Europe/Sofia', ARRAY['BG']),
  ('Europe/Stockholm', ARRAY['SE']),
  ('Europe/Tallinn', ARRAY['EE']),
  ('Europe/Tirane', ARRAY['AL']),
  ('Europe/Tiraspol', ARRAY['MD']),
  ('Europe/Ulyanovsk', ARRAY['RU']),
  ('Europe/Uzhgorod', ARRAY['UA']),
  ('Europe/Vaduz', ARRAY['LI']),
  ('Europe/Vatican', ARRAY['IT', 'SM', 'VA']),
  ('Europe/Vienna', ARRAY['AT']),
  ('Europe/Vilnius', ARRAY['LT']),
  ('Europe/Volgograd', ARRAY['RU']),
  ('Europe/Warsaw', ARRAY['PL']),
  ('Europe/Zagreb', ARRAY['HR']),
  ('Europe/Zaporozhye', ARRAY['UA']),
  ('Europe/Zurich', ARRAY['CH', 'DE', 'LI']),
  ('GB', ARRAY['GB', 'GG', 'IM', 'JE']),
  ('GB-Eire', ARRAY['GB', 'GG', 'IM', 'JE']),
  ('Hongkong', ARRAY['HK']),
  ('Iceland', ARRAY['IS']),
  ('Indian/Antananarivo', ARRAY['MG']),
  ('Indian/Chagos', ARRAY['IO']),
  ('Indian/Christmas', ARRAY['CX']),
  ('Indian/Cocos', ARRAY['CC']),
  ('Indian/Comoro', ARRAY['KM']),
  ('Indian/Kerguelen', ARRAY['TF']),
  ('Indian/Mahe', ARRAY['SC']),
  ('Indian/Maldives', ARRAY['MV', 'TF']),
  ('Indian/Mauritius', ARRAY['MU']),
  ('Indian/Mayotte', ARRAY['YT']),
  ('Indian/Reunion', ARRAY['RE']),
  ('Iran', ARRAY['IR']),
  ('Israel', ARRAY['IL']),
  ('Jamaica', ARRAY['JM']),
  ('Japan', ARRAY['AU', 'JP']),
  ('Kwajalein', ARRAY['MH']),
  ('Libya', ARRAY['LY']),
  ('Mexico/BajaNorte', ARRAY['MX']),
  ('Mexico/BajaSur', ARRAY['MX']),
  ('Mexico/General', ARRAY['MX']),
  ('Navajo', ARRAY['US']),
  ('NZ', ARRAY['AQ', 'NZ']),
  ('NZ-CHAT', ARRAY['NZ']),
  ('Pacific/Apia', ARRAY['WS']),
  ('Pacific/Auckland', ARRAY['AQ', 'NZ']),
  ('Pacific/Bougainville', ARRAY['PG']),
  ('Pacific/Chatham', ARRAY['NZ']),
  ('Pacific/Chuuk', ARRAY['FM']),
  ('Pacific/Easter', ARRAY['CL']),
  ('Pacific/Efate', ARRAY['VU']),
  ('Pacific/Enderbury', ARRAY['KI']),
  ('Pacific/Fakaofo', ARRAY['TK']),
  ('Pacific/Fiji', ARRAY['FJ']),
  ('Pacific/Funafuti', ARRAY['TV']),
  ('Pacific/Galapagos', ARRAY['EC']),
  ('Pacific/Gambier', ARRAY['PF']),
  ('Pacific/Guadalcanal', ARRAY['FM', 'SB']),
  ('Pacific/Guam', ARRAY['GU', 'MP']),
  ('Pacific/Honolulu', ARRAY['US']),
  ('Pacific/Johnston', ARRAY['US']),
  ('Pacific/Kanton', ARRAY['KI']),
  ('Pacific/Kiritimati', ARRAY['KI']),
  ('Pacific/Kosrae', ARRAY['FM']),
  ('Pacific/Kwajalein', ARRAY['MH']),
  ('Pacific/Majuro', ARRAY['MH']),
  ('Pacific/Marquesas', ARRAY['PF']),
  ('Pacific/Midway', ARRAY['UM']),
  ('Pacific/Nauru', ARRAY['NR']),
  ('Pacific/Niue', ARRAY['NU']),
  ('Pacific/Norfolk', ARRAY['NF']),
  ('Pacific/Noumea', ARRAY['NC']),
  ('Pacific/Pago_Pago', ARRAY['AS', 'UM']),
  ('Pacific/Palau', ARRAY['PW']),
  ('Pacific/Pitcairn', ARRAY['PN']),
  ('Pacific/Pohnpei', ARRAY['FM']),
  ('Pacific/Ponape', ARRAY['FM']),
  ('Pacific/Port_Moresby', ARRAY['AQ', 'FM', 'PG']),
  ('Pacific/Rarotonga', ARRAY['CK']),
  ('Pacific/Saipan', ARRAY['MP']),
  ('Pacific/Samoa', ARRAY['AS', 'UM']),
  ('Pacific/Tahiti', ARRAY['PF']),
  ('Pacific/Tarawa', ARRAY['KI', 'MH', 'TV', 'UM', 'WF']),
  ('Pacific/Tongatapu', ARRAY['TO']),
  ('Pacific/Truk', ARRAY['FM']),
  ('Pacific/Wake', ARRAY['UM']),
  ('Pacific/Wallis', ARRAY['WF']),
  ('Pacific/Yap', ARRAY['FM']),
  ('Poland', ARRAY['PL']),
  ('Portugal', ARRAY['PT']),
  ('PRC', ARRAY['CN']),
  ('ROC', ARRAY['TW']),
  ('ROK', ARRAY['KR']),
  ('Singapore', ARRAY['AQ', 'MY', 'SG']),
  ('Turkey', ARRAY['TR']),
  ('US/Alaska', ARRAY['US']),
  ('US/Aleutian', ARRAY['US']),
  ('US/Arizona', ARRAY['CA', 'US']),
  ('US/Central', ARRAY['US']),
  ('US/East-Indiana', ARRAY['US']),
  ('US/Eastern', ARRAY['US']),
  ('US/Hawaii', ARRAY['US']),
  ('US/Indiana-Starke', ARRAY['US']),
  ('US/Michigan', ARRAY['US']),
  ('US/Mountain', ARRAY['US']),
  ('US/Pacific', ARRAY['US']),
  ('US/Samoa', ARRAY['AS', 'UM']),
  ('W-SU', ARRAY['RU'])
ON CONFLICT (tz) DO UPDATE SET country_codes = EXCLUDED.country_codes;

-- ------------------------------------------------------------
-- 3. Historique des positions (administration ; supprimé avec le compte, 12 mois max.)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.location_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('device', 'declared', 'ip')),
  retained_source text NOT NULL CHECK (retained_source IN ('device', 'declared', 'ip')),
  country_code text,
  country text,
  city text,
  ip_country text,
  timezone text,
  inconsistent boolean NOT NULL DEFAULT false,
  inconsistency text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.location_history IS
  'Positions reçues (appareil, déclarée, IP) et position retenue ; indices d''incohérence. Administration seulement.';
CREATE INDEX IF NOT EXISTS location_history_user_idx ON public.location_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS location_history_created_idx ON public.location_history (created_at DESC);
ALTER TABLE public.location_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS location_history_admin_select ON public.location_history;
CREATE POLICY location_history_admin_select ON public.location_history FOR SELECT TO authenticated
  USING (public.is_admin());
REVOKE ALL ON public.location_history FROM anon;
GRANT SELECT ON public.location_history TO authenticated;
GRANT ALL ON public.location_history TO service_role;
REVOKE ALL ON SEQUENCE public.location_history_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.location_history_id_seq TO service_role;

-- ------------------------------------------------------------
-- 4. Enregistrer une position (appelée par le serveur du site, clé service)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.location_priority(_source text)
RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _source WHEN 'device' THEN 3 WHEN 'declared' THEN 2 WHEN 'ip' THEN 1 ELSE 0 END
$$;

-- _latitude / _longitude NULL : seulement les indices (pays de l'IP, fuseau) sont mis à jour.
-- Pays de l'adresse IP : _ip_country, sinon celui transmis par le serveur (x-yona-country).
CREATE OR REPLACE FUNCTION public.set_member_location(
  _user_id uuid, _source text, _latitude double precision DEFAULT NULL,
  _longitude double precision DEFAULT NULL, _country_code text DEFAULT NULL,
  _region text DEFAULT NULL, _city text DEFAULT NULL, _accuracy_m integer DEFAULT NULL,
  _timezone text DEFAULT NULL, _language text DEFAULT NULL,
  _ip_country text DEFAULT NULL, _ip_city text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _cur public.profile_locations%ROWTYPE;
  _found boolean;
  _code text := upper(nullif(btrim(coalesce(_country_code, '')), ''));
  _ipc text := upper(nullif(btrim(coalesce(_ip_country, public.request_context() ->> 'country', '')), ''));
  _ipcity text := left(nullif(btrim(coalesce(_ip_city, public.request_context() ->> 'city', '')), ''), 120);
  _tz text := left(nullif(btrim(coalesce(_timezone, '')), ''), 64);
  _replace boolean;
  _reasons text[] := '{}';
  _row public.profile_locations%ROWTYPE;
BEGIN
  IF _user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = _user_id) THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _source IS NULL OR _source NOT IN ('device', 'declared', 'ip') THEN
    RAISE EXCEPTION 'invalid_source' USING ERRCODE = '22023';
  END IF;
  IF (_latitude IS NULL) <> (_longitude IS NULL)
     OR (_latitude IS NOT NULL AND (_latitude NOT BETWEEN -90 AND 90 OR _longitude NOT BETWEEN -180 AND 180
                                    OR _latitude = 'NaN'::double precision OR _longitude = 'NaN'::double precision)) THEN
    RAISE EXCEPTION 'invalid_location' USING ERRCODE = '22023';
  END IF;
  IF _code IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.geo_countries g WHERE g.code = _code) THEN
    _code := NULL;
  END IF;
  IF _ipc !~ '^[A-Z]{2}$' OR _ipc = 'XX' THEN
    _ipc := NULL;
  END IF;

  SELECT * INTO _cur FROM public.profile_locations l WHERE l.user_id = _user_id FOR UPDATE;
  _found := FOUND;
  -- La plus haute priorité disponible l'emporte (appareil > déclarée > IP) ; une position
  -- de plus de 6 mois peut être remplacée par n'importe quelle source.
  _replace := _latitude IS NOT NULL AND (
    NOT _found
    OR public.location_priority(_source) >= public.location_priority(_cur.source)
    OR _cur.updated_at < now() - interval '6 months'
    -- Ancienne position sans pays connu : une position avec pays la remplace.
    OR (_cur.country_code IS NULL AND _code IS NOT NULL));

  IF _replace THEN
    INSERT INTO public.profile_locations AS l (
      user_id, latitude, longitude, updated_at, source, country_code, country, region, city, accuracy_m)
    VALUES (_user_id, round(_latitude::numeric, 2)::double precision, round(_longitude::numeric, 2)::double precision,
            now(), _source, _code, (SELECT g.name FROM public.geo_countries g WHERE g.code = _code),
            left(nullif(btrim(_region), ''), 120), left(nullif(btrim(_city), ''), 120),
            CASE WHEN _accuracy_m > 0 THEN least(_accuracy_m, 1000000) END)
    ON CONFLICT (user_id) DO UPDATE SET
      latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, updated_at = now(),
      source = EXCLUDED.source, country_code = EXCLUDED.country_code, country = EXCLUDED.country,
      region = EXCLUDED.region, city = EXCLUDED.city, accuracy_m = EXCLUDED.accuracy_m;
  ELSIF NOT _found THEN
    -- Aucune position connue et rien à retenir : seulement l'historique.
    INSERT INTO public.location_history (user_id, source, retained_source, ip_country, timezone)
    VALUES (_user_id, _source, _source, _ipc, _tz);
    RETURN jsonb_build_object('retained', NULL);
  END IF;

  SELECT * INTO _row FROM public.profile_locations l WHERE l.user_id = _user_id;
  -- Indices : pays de l'IP (sauf si la position retenue vient justement de l'IP) et fuseau.
  IF _row.country_code IS NOT NULL THEN
    IF _ipc IS NOT NULL AND _row.source <> 'ip' AND _ipc <> _row.country_code THEN
      _reasons := _reasons || ('ip_country:' || _ipc);
    END IF;
    IF _tz IS NOT NULL AND EXISTS (SELECT 1 FROM public.geo_timezones t WHERE t.tz = _tz)
       AND NOT EXISTS (SELECT 1 FROM public.geo_timezones t WHERE t.tz = _tz AND _row.country_code = ANY (t.country_codes)) THEN
      _reasons := _reasons || ('timezone:' || _tz);
    END IF;
    -- Position de l'appareil dans un autre pays que celui affiché sur le profil.
    IF _row.source = 'device' AND _row.country IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.profiles p WHERE p.user_id = _user_id AND p.country IS NOT NULL
           AND lower(p.country) <> lower(_row.country)) THEN
      _reasons := _reasons || ('declared_country:' || (SELECT p.country FROM public.profiles p WHERE p.user_id = _user_id));
    END IF;
  END IF;
  UPDATE public.profile_locations l SET
    ip_country = coalesce(_ipc, l.ip_country),
    ip_city = CASE WHEN _ipc IS NOT NULL THEN _ipcity ELSE l.ip_city END,
    timezone = coalesce(_tz, l.timezone),
    language = coalesce(left(nullif(btrim(_language), ''), 35), l.language),
    inconsistent = cardinality(_reasons) > 0,
    inconsistency = _reasons,
    checked_at = now()
  WHERE l.user_id = _user_id
  RETURNING * INTO _row;
  INSERT INTO public.location_history (user_id, source, retained_source, country_code, country, city,
                                       ip_country, timezone, inconsistent, inconsistency)
  VALUES (_user_id, _source, _row.source, _row.country_code, _row.country, _row.city,
          _row.ip_country, _row.timezone, _row.inconsistent, _row.inconsistency);
  RETURN jsonb_build_object(
    'retained', _row.source, 'replaced', _replace, 'country', _row.country, 'region', _row.region,
    'city', _row.city, 'inconsistent', _row.inconsistent, 'inconsistency', to_jsonb(_row.inconsistency));
END;
$$;
REVOKE ALL ON FUNCTION public.set_member_location(uuid, text, double precision, double precision, text, text, text, integer, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_location(uuid, text, double precision, double precision, text, text, text, integer, text, text, text, text) TO service_role;

-- Ancienne fonction (position de l'appareil envoyée directement par le navigateur) : gardée
-- pour compatibilité ; la position est alors « appareil » mais sans ville connue.
CREATE OR REPLACE FUNCTION public.set_my_location(_latitude double precision, _longitude double precision)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _latitude IS NULL OR _longitude IS NULL
     OR _latitude NOT BETWEEN -90 AND 90 OR _longitude NOT BETWEEN -180 AND 180
     OR _latitude = 'NaN'::double precision OR _longitude = 'NaN'::double precision THEN
    RAISE EXCEPTION 'invalid_location' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.profile_locations AS l (user_id, latitude, longitude, updated_at, source)
  VALUES (auth.uid(), round(_latitude::numeric, 2)::double precision,
          round(_longitude::numeric, 2)::double precision, now(), 'device')
  ON CONFLICT (user_id) DO UPDATE
    SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, updated_at = now(),
        source = 'device', country_code = NULL, country = NULL, region = NULL, city = NULL,
        accuracy_m = NULL;
END;
$$;

-- ------------------------------------------------------------
-- 5. Pays retenu (retrait d'un profil de démonstration, ciblage des publicités)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.member_country(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT l.country FROM public.profile_locations l WHERE l.user_id = _user_id AND l.country IS NOT NULL),
    (SELECT p.country FROM public.profiles p WHERE p.user_id = _user_id))
$$;
REVOKE EXECUTE ON FUNCTION public.member_country(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_country(uuid) TO service_role;

-- ------------------------------------------------------------
-- 6. Administration
-- ------------------------------------------------------------
-- Membres dont la localisation est incohérente (VPN possible), les plus récents d'abord.
CREATE OR REPLACE FUNCTION public.admin_location_flags(_limit integer DEFAULT 100)
RETURNS TABLE (
  user_id uuid, email text, first_name text, source text, country text, region text, city text,
  declared_country text, declared_city text, ip_country text, ip_city text, timezone text,
  language text, inconsistency text[], checked_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT l.user_id, u.email, p.first_name, l.source, l.country, l.region, l.city, p.country, p.city,
         l.ip_country, l.ip_city, l.timezone, l.language, l.inconsistency, l.checked_at
  FROM public.profile_locations l
  JOIN public.users u ON u.id = l.user_id
  LEFT JOIN public.profiles p ON p.user_id = l.user_id
  WHERE l.inconsistent
  ORDER BY l.checked_at DESC NULLS LAST
  LIMIT least(greatest(coalesce(_limit, 100), 1), 1000);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_location_flags(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_location_flags(integer) TO authenticated, service_role;

-- Fiche d'un membre : sa position retenue et les 30 dernières positions reçues.
CREATE OR REPLACE FUNCTION public.admin_user_location(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN jsonb_build_object(
    'current', (SELECT to_jsonb(l) - 'user_id' FROM public.profile_locations l WHERE l.user_id = _user_id),
    'declared', (SELECT jsonb_build_object('country', p.country, 'region', p.region, 'city', p.city)
                 FROM public.profiles p WHERE p.user_id = _user_id),
    'history', (SELECT coalesce(jsonb_agg(to_jsonb(h) - 'user_id' ORDER BY h.created_at DESC), '[]'::jsonb)
                FROM (SELECT * FROM public.location_history WHERE user_id = _user_id
                      ORDER BY created_at DESC LIMIT 30) h)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_user_location(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_location(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 7. Conservation (RGPD) : historique des positions effacé après 12 mois
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_old_logs()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _n integer := 0;
  _c integer;
BEGIN
  UPDATE public.auth_events SET ip = NULL, user_agent = NULL, city = NULL
  WHERE created_at < now() - interval '12 months' AND (ip IS NOT NULL OR user_agent IS NOT NULL);
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  UPDATE public.activity_events SET ip = NULL, user_agent = NULL
  WHERE created_at < now() - interval '12 months' AND (ip IS NOT NULL OR user_agent IS NOT NULL);
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  UPDATE public.payment_events SET ip = NULL, user_agent = NULL
  WHERE created_at < now() - interval '12 months' AND (ip IS NOT NULL OR user_agent IS NOT NULL);
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  UPDATE public.admin_audit_log SET ip = NULL, user_agent = NULL
  WHERE created_at < now() - interval '12 months' AND (ip IS NOT NULL OR user_agent IS NOT NULL);
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  DELETE FROM public.server_errors WHERE created_at < now() - interval '12 months';
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  DELETE FROM public.location_history WHERE created_at < now() - interval '12 months';
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  RETURN _n;
END; $$;
REVOKE ALL ON FUNCTION public.purge_old_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_logs() TO service_role;
