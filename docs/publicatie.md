# Publicatie via Cloudflare Pages

Het hoofdproject is `interactief`, gekoppeld aan `harmenploeg/interactief` en `https://www.loci-amsterdam.nl/`. DNS voor dit domein staat niet als zone in het getoonde Cloudflare-account; een Workers-route op projectamsterdam.org is niet bruikbaar voor deze publicatie.

De fase-1-integratie staat in https://github.com/harmenploeg/interactief/pull/2. Die bevat de gebouwde frontend onder `kunstkiezer/`, de Pages Function voor routes en health, het uitgebreide publicatiemanifest en een serviceworker-uitzondering voor deze submap.

De bestaande Loci-workflow controleert eerst het volledige publicatiepakket. Na samenvoegen op main publiceert die hetzelfde gecontroleerde artifact naar Pages-project interactief. Deze workflow gebruikt zijn bestaande Loci-publicatiesecrets en database-/Access-controles; de nieuwe Kunstkiezer-secret kan niet rechtstreeks door de andere private repository worden gelezen.

In Kunstkiezer zijn `CLOUDFLARE_API_TOKEN` (secret) en `CLOUDFLARE_ACCOUNT_ID` (variable) voorbereid voor toekomstige workflows. De workflow Publicatievoorbereiding bouwt alleen een artifact en voert geen deployment uit.

Volgende versies worden in deze bronrepository ontwikkeld en getest. Vervang daarna de gegenereerde build in de hoofdrepository, werk het publicatiemanifest bij en doorloop opnieuw de bestaande controles. Dit handmatige uitgaveproces kan later worden geautomatiseerd met expliciet geregelde toegang tussen de repositories.

De Worker-config blijft beschikbaar voor lokale ontwikkeltests; gebruik die niet voor deze Pages-productieomgeving. Accounts, Supabase en catalogusgegevens zijn nog niet geïmplementeerd.
