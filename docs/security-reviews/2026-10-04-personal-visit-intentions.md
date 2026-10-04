# Persoonlijke bezoekplannen — 4 oktober 2026

De bestaande eigenaarbeveiligde tabel kk_seen is uitgebreid met status seen/wanted. Bestaande gegevens houden seen. De database vereist een lege waardering voor wanted; de bestaande geaggregeerde waarderingen lezen uitsluitend niet-lege ratings. Geen nieuwe grants of verhoogde rechten.

Productieschema gecontroleerd: statusdefault seen, beide CHECK-constraints aanwezig, RLS ingeschakeld, own_seen USING én WITH CHECK op auth.uid(), anonieme SELECT-rechten ontbreken. Geen productieaccountgegevens opgevraagd of gewijzigd.

Negatieve lokale databasetests: andermans lijst onleesbaar en onwijzigbaar, eigendom niet overdraagbaar, onbekende status en sterren bij wanted geweigerd. Browserregressie controleert synchronisatie tussen twee accountsessies, verplaatsing naar gezien, groene/rode kaartweergave en bestaande account-, beheer- en kaartflows.

Supabase advisors: geen nieuwe bevindingen. Bestaande bewust afgesloten private tabellen zonder clientpolicy en eerder bekende ontbrekende leaked-password-protection blijven ongewijzigd. Referentie: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
