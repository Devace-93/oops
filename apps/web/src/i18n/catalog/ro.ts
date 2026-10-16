import type { PartialCatalog } from "./en";

/** Română — base catalog. */
const ro: PartialCatalog = {
  // Shared chrome
  "nav.pricing": "Prețuri",
  "nav.blog": "Blog",
  "nav.docs": "Docs",
  "nav.sponsors": "Sponsori",
  "nav.login": "Autentificare",
  "nav.signup": "Înregistrare gratuită",
  "nav.dashboard": "Panou",
  "nav.logout": "Deconectare",
  "nav.openMenu": "Deschide meniul",
  "nav.closeMenu": "Închide meniul",
  "nav.projects": "Proiecte",
  "nav.apiKeys": "Chei API",
  "nav.billing": "Facturare",

  "footer.madeBy": "Creat de Enrique Magallón",
  "footer.source": "Cod sursă",
  "footer.appsIndex": "Mai multe aplicații",
  "footer.openSource": "Open source · MIT",

  "ui.theme": "Temă",
  "ui.themeLight": "Comută la tema luminoasă",
  "ui.themeDark": "Comută la tema întunecată",
  "ui.language": "Limbă",
  "ui.search": "Caută",
  "ui.close": "Închide",

  // Project tabs (components/project-nav.tsx)
  "pnav.back": "← Toate proiectele",
  "pnav.overview": "Prezentare generală",
  "pnav.events": "Evenimente",
  "pnav.settings": "Setări",
  "pnav.openSite": "Deschide site-ul",
  "pnav.paused": "În pauză",
  "pnav.live": "Live",
  "pnav.liveHint": "A primit un hit în ultimele 5 minute",

  // Plan/limit formatters (src/lib/plans.ts)
  "plans.unlimited": "Nelimitat",
  "plans.custom": "Personalizat",
  "plans.days": "{n} zile",
  "plans.year": "{n} an",
  "plans.years": "{n} ani",

  // Landing — hero
  "landing.badge": "Open source · MIT · Self-hosting · Fără cookie-uri",
  "landing.heroTitle": "Află cine îți vizitează aplicațiile,",
  "landing.heroTitleAccent": "fără să urmărești pe nimeni",
  "landing.heroBody":
    "oops numără afișările de pagină și vizitatorii pentru fiecare proiect înregistrat: paginile de top, sursele de trafic, țările și orașele, dispozitivele, browserele și evenimentele personalizate — dintr-un singur tag script, un pixel sau un apel API. Fără cookie-uri, fără adrese IP stocate, nimic de pus într-un banner de consimțământ.",
  "landing.getStarted": "Începe gratuit",
  "landing.whyFree": "De ce e gratuit acum",
  "landing.seePricing": "Vezi prețurile",
  "landing.readDocs": "Citește documentația",
  "landing.earlyNote":
    "Acces timpuriu: fiecare cont are acces complet, gratuit. Planurile vin mai târziu, cu notificare prealabilă.",
  "landing.freeNote": "Plan gratuit: {projects} proiecte și {events} evenimente / lună. Fără card.",

  // Landing — three paths
  "landing.pathsTitle": "Trei moduri de a număra",
  "landing.pathsBody":
    "Alege-l pe cel care se potrivește fiecărei aplicații. Toate ajung în același panou.",
  "landing.pathScriptTitle": "Un singur tag script",
  "landing.pathScriptBody":
    "Sub 3 KB, fără dependențe. Numără fiecare afișare de pagină, urmărește schimbările de rută din aplicațiile SPA și expune oops.track() pentru evenimente personalizate. Funcționează la fel în Qwik, Astro, React, pagini cu jQuery și jocuri Phaser.",
  "landing.pathPixelTitle": "Pixel de urmărire",
  "landing.pathPixelBody":
    "O imagine 1×1 pentru locurile unde JavaScript nu poate rula: e-mailuri, fișiere README, documentație găzduită în altă parte. URL-ul spune ce pagină sau eveniment reprezintă.",
  "landing.pathApiTitle": "Collect API",
  "landing.pathApiBody":
    "Un singur POST cu cheia publică a proiectului, din backend, un CLI, un server de joc sau un cron job. Perfect pentru aplicații fără DOM.",

  // Landing — how it works
  "landing.howTitle": "Cum funcționează",
  "landing.step1Title": "1. Creează un proiect",
  "landing.step1Body":
    "Un proiect per site sau aplicație. Primești o cheie publică pentru script, pixel și API și îi alegi fusul orar.",
  "landing.step2Title": "2. Lipește snippetul",
  "landing.step2Body":
    "Copiază-l din setările proiectului în layoutul tău. Primele afișări de pagină apar în câteva secunde.",
  "landing.step3Title": "3. Citește panoul",
  "landing.step3Body":
    "Alege un interval, dă clic pe orice pagină, țară sau dispozitiv ca să filtrezi totul după el, urmărește contorul live sau lasă un agent AI să citească cifrele prin MCP.",

  // Landing — what you see
  "landing.seeTitle": "Tot ce vrei să știi, nimic în plus",
  "landing.seeBody":
    "Panoul răspunde la întrebările pe care oamenii chiar și le pun despre un site, și se oprește acolo.",
  "landing.seeWhereTitle": "De unde.",
  "landing.seeWhereBody":
    "Surse de trafic, UTM source / medium / campaign, țări, regiuni și orașe.",
  "landing.seeWhoTitle": "Pe ce.",
  "landing.seeWhoBody":
    "Desktop, mobil sau tabletă; browser și sistem de operare; dimensiunea ecranului și limba.",
  "landing.seeWhatTitle": "Ce fac.",
  "landing.seeWhatBody":
    "Paginile de top, căile de intrare și evenimentele personalizate pe care le trimiți (înregistrări, achiziții, clicuri) cu proprietățile lor.",
  "landing.seeLiveTitle": "Chiar acum.",
  "landing.seeLiveBody": "Vizitatorii din ultimele cinci minute și paginile pe care se află.",

  // Landing — privacy
  "landing.privacyTitle": "Prietenos cu confidențialitatea prin construcție",
  "landing.privacyBody":
    "Trackerul nu setează niciun cookie și nu scrie nimic în browser. Serverul hashuiește adresa IP a fiecărui vizitator cu un salt care se schimbă zilnic, păstrează doar țara, regiunea și orașul derivate și aruncă user agentul de îndată ce cunoaște dispozitivul, browserul și sistemul de operare.",
  "landing.privacy1":
    "Fără cookie-uri, fără localStorage, fără fingerprinting între site-uri sau zile",
  "landing.privacy2": "Adresele IP brute nu sunt stocate niciodată — doar un hash zilnic cu salt",
  "landing.privacy3":
    "Query string-urile sunt eliminate din URL-urile paginilor (cu excepția tagurilor UTM), așa că tokenurile și e-mailurile nu ajung niciodată în panou",
  "landing.privacy4": "Suport opțional pentru Do Not Track, iar boții sunt filtrați",
  "landing.apiNote": "Cheile publice pot doar trimite hituri. Nu pot citi nimic, niciodată.",
  "landing.panelRequest": "Cerere",
  "landing.panelResponse": "Răspuns",

  // Landing — MCP section
  "landing.mcpBadge": "Model Context Protocol",
  "landing.mcpTitle": "Întreabă-ți agentul AI cum merge site-ul",
  "landing.mcpIntro":
    "oops include un server MCP. Conectează-l la Claude Code, Claude Desktop, Cursor sau orice host MCP și întreabă lucruri precum",
  "landing.mcpExample1": "„cum s-a schimbat traficul către documentație săptămâna asta?”",
  "landing.mcpOr": "sau",
  "landing.mcpExample2": "„ce țări vizitează cel mai mult pagina de prețuri?”",
  "landing.mcpBullet1Title": "Chei cu roluri.",
  "landing.mcpBullet1Body":
    "O cheie viewer nici măcar nu vede uneltele de ștergere; editor și admin deblochează mai mult. Aplicat și de API.",
  "landing.mcpBullet2Title": "Omul în buclă.",
  "landing.mcpBullet2Body":
    "Acțiunile distructive (ștergerea unui proiect, golirea evenimentelor lui) îți cer confirmarea înainte să se întâmple ceva.",
  "landing.mcpBullet3Title": "Jurnal de audit.",
  "landing.mcpBullet3Body":
    "Fiecare modificare și fiecare apel refuzat sunt înregistrate, pe server și pe partea agentului.",
  "landing.mcpBullet4Title": "Local sau la distanță.",
  "landing.mcpBullet4Body1": "Rulează-l prin stdio cu",
  "landing.mcpBullet4Npm": "npm",
  "landing.mcpBullet4Body2": "sau îndreaptă-ți hostul către",
  "landing.mcpBullet4Body3": "cu cheia ta.",
  "landing.mcpPanelLocal": "Claude Code · local (npm)",
  "landing.mcpPanelRemote": "Claude Code · la distanță (nimic de instalat)",
  "landing.mcpPanelJson": "Orice host MCP (JSON)",
  "landing.mcpKeyNote": "Creează o cheie cu rolul dorit din",
  "landing.mcpKeyLink": "Panou → Chei API",

  // Landing — self-host callout + closing CTA
  "landing.selfhostTitle": "Găzduiește-l singur (MIT, open source)",
  "landing.selfhostBody1":
    "Întregul stack — API-ul Flask, trackerul, serverul MCP și această aplicație Qwik — este sub licență MIT. Rulează-l pe propriul VPS cu un singur",
  "landing.selfhostBody2":
    ". Fără cod de facturare, fără limite în afara celor pe care le configurezi tu.",
  "landing.viewGithub": "Vezi pe GitHub",
  "landing.ctaTitle": "Vezi primul vizitator într-un minut",
  "landing.ctaBody":
    "Creează un proiect, lipește un tag script și urmărește cum se mișcă contorul live.",

  // Blog (chrome only)
  "blog.title": "Blog",
  "blog.intro": "Noutăți despre produs, note de inginerie și sfaturi despre citirea cifrelor tale.",
  "blog.comingSoon": "În curând.",
  "blog.readMore": "Citește mai mult →",
  "blog.allPosts": "← Toate articolele",
  "blog.notFoundTitle": "Articolul nu a fost găsit",
  "blog.notFoundBody": "Nu există niciun articol la",
  "blog.backToBlog": "Înapoi la blog",
  "blog.seeTiers": "Vezi planurile propuse",

  // Info index
  "info.title": "Informații",
  "info.intro": "Pagini de referință pentru oops. Vor apărea mai multe în timp.",
  "info.pricingTitle": "Prețuri",
  "info.pricingBody": "Planuri, limite și prețuri.",
  "info.plannedPricingTitle": "Prețuri planificate",
  "info.plannedPricingBody":
    "Planurile pe care intenționăm să le introducem după accesul timpuriu.",
  "info.docsTitle": "Docs",
  "info.docsBody":
    "Ghid de instalare a trackerului, pixel, collect API, referința stats API și configurarea MCP.",
  "info.termsTitle": "Termeni",
  "info.termsBody": "Termenii serviciului (în curând).",
  "info.privacyTitle": "Confidențialitate",
  "info.privacyBody": "Ce stocăm și ce nu stocăm niciodată (în curând).",
  "info.comingSoon": "Această pagină apare în curând.",
  "info.backToInfo": "Înapoi la informații",

  // Pricing page
  "pricing.title": "Prețuri simple și corecte",
  "pricing.titlePlanned": "Prețuri planificate",
  "pricing.intro":
    "Începe gratuit. Treci la un plan superior când ai nevoie de mai multe proiecte, mai multe evenimente pe lună sau retenție mai lungă. Self-hosting pentru totul nelimitat.",
  "pricing.introPlanned":
    "Acestea sunt planurile pe care intenționăm să le introducem după accesul timpuriu. Nimic de aici nu se aplică încă.",
  "pricing.earlyTitle": "Acum fiecare cont are acces complet, gratuit.",
  "pricing.earlyBody":
    "Proiecte, evenimente și retenție nelimitate, API-ul și serverul MCP. Când vor apărea planurile, vom anunța pe blog și prin e-mail înainte ca vreo limită să se aplice unui cont existent. Prețurile și limitele de mai jos se mai pot schimba.",
  "pricing.earlyCta": "Citește ce vor include planurile plătite",
  "pricing.enterpriseTitle": "Ai nevoie de limite personalizate, SSO sau SLA?",
  "pricing.enterpriseBody": "Planurile Enterprise sunt adaptate echipei tale.",
  "pricing.contactUs": "Contactează-ne",
  "pricing.footnote":
    "Toate prețurile în USD. Facturarea anuală economisește ~20%. Numărul de proiecte și de chei sunt limite stricte; evenimentele peste bugetul lunar sunt numărate, dar nu stocate, iar site-ul tău nu vede niciodată o eroare. Evenimentele mai vechi decât fereastra de retenție sunt șterse.",
  "pricing.footnoteEarly": "Nimic din acestea nu se aplică în accesul timpuriu.",

  // Pricing table (plan labels come from packages/shared/plan_limits.json)
  "pricing.mostPopular": "Cel mai popular",
  "pricing.perMonth": "/lună",
  "pricing.perYear": "/an",
  "pricing.projects": "proiecte",
  "pricing.eventsPerMonth": "evenimente / lună",
  "pricing.retention": "Retenție date {value}",
  "pricing.apiKeys": "chei API",
  "pricing.auditRetention": "Retenție audit {value}",
  "pricing.user": "utilizator",
  "pricing.users": "utilizatori",
  "pricing.api": "API {api}",
  "pricing.sponsorsBadge": "Insignă /sponsors",
  "pricing.teamExtras": "Roluri + suport prioritar",
  "pricing.enterpriseExtras": "SSO, SLA, limite personalizate",
  "pricing.getStarted": "Începe",
  "pricing.startPlan": "Alege {plan}",

  // Docs
  "docs.title": "Docs",
  "docs.intro":
    "Cum pui oops în aplicația ta, trimiți hituri de oriunde și citești cifrele prin API-ul REST sau printr-un agent AI. Contractul complet — fiecare endpoint, obiect și eroare — se află în repository.",
  "docs.fullContract": "Citește contractul complet (CONTRACT.md)",
  "docs.baseUrl": "URL de bază",
  "docs.trackerTitle": "Scriptul tracker",
  "docs.trackerBody":
    "Un script fără dependențe, sub 3 KB, servit de pe acest host. Adaugă-l o dată în layout; trimite un hit per afișare de pagină și per schimbare de rută în SPA, fără cookie-uri și fără nimic stocat în browser.",
  "docs.trackerAttrsTitle": "Atribute (valorile implicite afișate)",
  "docs.attrKey": "cheia publică a proiectului (obligatorie).",
  "docs.attrSpa":
    "se leagă de History API și trimite o afișare de pagină la fiecare schimbare de rută. Setează false ca să apelezi tu oops.pageview().",
  "docs.attrHash": "rutare cu hash: păstrează #fragment în URL și ascultă hashchange.",
  "docs.attrDnt": "respectă semnalul Do Not Track al browserului.",
  "docs.attrLocal":
    "urmărește și pe localhost, IP-uri brute, file: și *.local (ignorate implicit).",
  "docs.attrApi": "suprascrie endpointul collect (instanțe self-hosted în spatele altui host).",
  "docs.trackerJsTitle": "JavaScript API",
  "docs.trackerJsBody":
    "window.oops expune track(name, props) pentru evenimente personalizate și pageview() pentru afișări de pagină manuale. Apelurile puse în coadă înainte de încărcarea scriptului sunt reluate.",
  "docs.trackerDeclarative":
    "Clicurile pe elementele cu data-oops-event sunt urmărite automat, cu proprietăți JSON opționale:",
  "docs.trackerWhat":
    "Ce se trimite: URL-ul paginii fără query string (tagurile UTM sunt citite și apoi eliminate), referrerul, titlul, dimensiunea ecranului și limba browserului. Dispozitivul, browserul, sistemul de operare și locația sunt derivate pe server din cerere și nu sunt stocate niciodată în formă brută.",
  "docs.pixelTitle": "Pixel de urmărire",
  "docs.pixelBody":
    "Pentru locurile unde nu rulează JavaScript — newslettere, fișiere README, documentație pe alt host. Imaginea este un GIF transparent de 43 de bytes, niciodată pus în cache. Transmite pagina ca u și, opțional, un nume de eveniment ca n.",
  "docs.collectTitle": "Collect API",
  "docs.collectBody":
    "POST /api/collect cu cheia publică a proiectului în headerul X-Project-Key (sau într-un câmp k). Sunt acceptate corpuri JSON, form-encoded și text/plain, CORS este deschis, iar răspunsul este întotdeauna 202, astfel încât un site urmărit nu vede niciodată o eroare.",
  "docs.collectField1":
    "n: numele evenimentului (implicit pageview). 1-60 de litere, cifre, spații, _ . : / sau -.",
  "docs.collectField2":
    "u: URL-ul sau calea paginii (obligatoriu pentru orice are sens). Query string-urile sunt citite doar pentru tagurile UTM.",
  "docs.collectField3":
    "r: URL-ul referrerului; t: titlul paginii (≤ 200); l: limba (≤ 16); w / h: dimensiunea ecranului.",
  "docs.collectField4":
    "p: un obiect JSON cu proprietăți pentru evenimente personalizate (≤ 2 KB).",
  "docs.collectField5":
    "s: sursa — script (implicit), pixel sau api. Dispozitivul, browserul, sistemul de operare și locația vin din headerele și adresa cererii înseși.",
  "docs.collectResponses":
    "Corpul spune ce s-a întâmplat: { ok: true } când a fost stocat, sau { ok: false, reason } cu reason = paused (urmărire oprită pentru proiect), origin (hostname care nu e în lista permisă), bot (crawler sau browser headless) sau limit (peste bugetul lunar — numărat, nu stocat).",
  "docs.authTitle": "Autentificare",
  "docs.authBody": "Trei tipuri de credențiale, fiecare pentru o treabă:",
  "docs.authDashboard":
    "Sesiuni de panou: tokenuri JWT bearer emise de /auth/login. Au toate scope-urile.",
  "docs.authApiKey":
    "API de administrare: chei API cu un rol (viewer / editor / admin). Header X-API-Key: oops_live_… (sau Authorization: Bearer).",
  "docs.authPublicKey":
    "Collect API, tracker și pixel: cheile publice ale proiectului. Header X-Project-Key: oops_pub_… (sau câmpul k). Identifică un singur proiect și pot doar trimite hituri.",
  "docs.projectsTitle": "Proiecte",
  "docs.projectsBody":
    "Un proiect este un site sau o aplicație. Deține o cheie publică, un fus orar (folosit pentru împărțirea pe zile), o listă opțională de hostname-uri permise și comutatoarele pentru collect / boți.",
  "docs.statsTitle": "Statistici",
  "docs.statsBody":
    "Intervalele sunt date locale inclusive în fusul din parametrul tz (implicit: fusul proiectului), ca period=today|yesterday|7d|30d|90d|12mo sau from/to. Orice dimensiune poate fi transmisă ca filtru (de ex. country=ES&device=mobile) și tot răspunsul este restrâns la ea. Vizitatorii sunt numărați cu un hash zilnic, deci pe mai multe zile sunt unici zilnici, însumați.",
  "docs.dimensionsTitle": "Dimensiuni",
  "docs.dimensionsBody":
    "Utilizabile ca defalcare (by=) și ca filtre pe fiecare endpoint de statistici și evenimente. referrer=(direct) selectează hiturile fără referrer.",
  "docs.errorsTitle": "Erori și limite",
  "docs.errorsBody":
    "Erorile sunt JSON: { \"error\": { \"code\", \"message\" } }. Crearea peste o limită a planului răspunde 402 limit_reached cu error.which = projects | api_keys. Hiturile peste bugetul lunar de evenimente sunt acceptate (202), dar nu stocate.",
  "docs.privacyBody":
    "Confidențialitate: oops nu stochează niciodată adrese IP brute sau user agenți — doar un hash zilnic cu salt și câmpurile derivate dispozitiv / browser / sistem de operare / locație. URL-urile paginilor își pierd query string-ul înainte de stocare.",
  "docs.mcpTitle": "MCP (agenți AI)",
  "docs.mcpBody":
    "Serverul MCP expune API-ul de administrare ca unelte, filtrate după rolul cheii cu care te conectezi. Uneltele distructive cer confirmare. Un prompt weekly_report ghidează un model prin cifrele unui proiect.",
  "docs.mcpLocal": "Local (stdio, npm)",
  "docs.mcpRemote": "La distanță (Streamable HTTP)",
  "docs.mcpTools":
    "Unelte: list_projects, get_project, create_project, update_project, rotate_project_key, delete_project, project_summary, get_stats, get_breakdown, list_events, get_live, purge_events, get_usage, get_audit_log.",
  "docs.colMethod": "Metodă",
  "docs.colPath": "Cale",
  "docs.colScope": "Scope",
  "docs.colNotes": "Note",

  // Sponsors
  "sponsors.title": "Sponsori",
  "sponsors.intro1": "oops este open source (MIT). Fiecare abonat",
  "sponsors.introLink": "Pro / Supporter",
  "sponsors.intro2":
    "ajută la menținerea self-hostingului gratuit — și primește o insignă și un loc pe această pagină.",
  "sponsors.intro2Early":
    "va ajuta la menținerea self-hostingului gratuit — și va primi o insignă și un loc pe această pagină.",
  "sponsors.emptyTitle": "Numele tău ar putea fi primul pe această pagină.",
  "sponsors.emptyBody":
    "Fiecare abonat Pro / Supporter primește un loc aici și o insignă încorporabilă.",
  "sponsors.emptyBodyEarly":
    "Abonamentele Supporter se deschid odată cu planurile plătite, după accesul timpuriu. Până atunci fiecare cont este gratuit.",
  "sponsors.tierSupporter": "Susținător {tier}",
  "sponsors.badgeTitle": "Insigna de susținător",
  "sponsors.badgeBody": "Susținătorii Pro primesc o insignă încorporabilă pentru site sau README:",
  "sponsors.badgeBodyEarly":
    "Susținătorii Pro vor primi o insignă încorporabilă pentru site sau README:",
  "sponsors.badgeLabel": "oops Supporter",
  "sponsors.readPlans": "Citește despre planurile viitoare",
  "sponsors.become": "Devino susținător",

  // Early-access banner
  "early.bannerTitle": "Acces timpuriu.",
  "early.bannerText":
    "Fiecare cont are acum acces complet, fără costuri. Planurile și limitele vor fi introduse mai târziu, cu notificare înainte de orice schimbare.",
  "early.bannerLink": "Ce vor include planurile plătite",

  // Site-building curtain
  "building.title": "Construim oops",
  "building.body":
    "Analytics prietenos cu confidențialitatea pentru aplicațiile tale. Site-ul nu e deschis încă — dar trackerul, collect API și serverul MCP răspund în continuare fără probleme.",
  "building.footer": "oops.3m4.net · în curând",

  // Shared
  "common.loading": "Se încarcă…",
  "common.copy": "Copiază",
  "common.copied": "Copiat!",
  "common.creating": "Se creează…",
  "common.saving": "Se salvează…",
  "common.save": "Salvează",
  "common.saved": "Salvat.",
  "common.cancel": "Anulează",
  "common.close": "Închide",
  "common.delete": "Șterge",
  "common.deleting": "Se șterge…",
  "common.optional": "(opțional)",
  "common.email": "E-mail",
  "common.password": "Parolă",
  "common.created": "Creat",
  "common.role": "Rol",
  "common.name": "Nume",
  "common.key": "Cheie",
  "common.description": "Descriere",
  "common.search": "Caută",
  "common.retry": "Reîncearcă",
  "common.dismiss": "Închide",
  "common.pageOf": "Pagina {page} din {pages} · {total} rânduri",

  // Enum labels
  "period.today": "Azi",
  "period.yesterday": "Ieri",
  "period.7d": "7 zile",
  "period.30d": "30 de zile",
  "period.90d": "90 de zile",
  "period.12mo": "12 luni",
  "interval.hour": "pe oră",
  "interval.day": "pe zi",
  "interval.month": "pe lună",
  "metric.pageviews": "Afișări de pagină",
  "metric.visitors": "Vizitatori",
  "metric.events": "Evenimente",
  "dim.path": "Pagini",
  "dim.hostname": "Hostname",
  "dim.referrer": "Surse de trafic",
  "dim.direct": "Direct / niciunul",
  "dim.country": "Țări",
  "dim.region": "Regiuni",
  "dim.city": "Orașe",
  "dim.device": "Dispozitive",
  "dim.browser": "Browsere",
  "dim.os": "Sisteme de operare",
  "dim.lang": "Limbi",
  "dim.utm_source": "Surse UTM",
  "dim.utm_medium": "Medii UTM",
  "dim.utm_campaign": "Campanii UTM",
  "dim.name": "Evenimente personalizate",
  "dim.ip": "Adrese IP",
  "device.desktop": "Desktop",
  "device.mobile": "Mobil",
  "device.tablet": "Tabletă",
  "device.bot": "Bot",

  // Auth: login
  "auth.loginTitle": "Autentificare",
  "auth.loginSubtitle": "Bine ai revenit la oops.",
  "auth.loginFailed": "Autentificarea a eșuat. Verifică e-mailul și parola.",
  "auth.loggingIn": "Se autentifică…",
  "auth.noAccount": "Nu ai cont?",
  "auth.signUp": "Înregistrează-te",

  // Auth: signup
  "auth.signupTitle": "Creează-ți contul",
  "auth.signupFailed": "Înregistrarea a eșuat. Te rugăm să încerci din nou.",
  "auth.inviteOnlyTitle": "🔒 Înregistrările sunt momentan doar pe bază de invitație",
  "auth.inviteOnlyBody": "Lansăm treptat. Rămâi pe aproape — locurile se deschid în curând.",
  "auth.haveAccount": "Ai deja cont?",
  "auth.logIn": "Autentifică-te",
  "auth.earlyAccessPitch": "Acces timpuriu: acces complet, gratuit. Fără card.",
  "auth.freePitch": "Gratuit pentru totdeauna: {projects} proiecte și {events} evenimente / lună.",
  "auth.workspaceName": "Numele spațiului de lucru",
  "auth.workspacePlaceholder": "Acme SRL",
  "auth.passwordHint": "Cel puțin 8 caractere.",
  "auth.creatingAccount": "Se creează contul…",
  "auth.createAccount": "Creează cont",

  // 402 limit_reached, per `error.which`
  "limit.projects": "Ai atins limita de proiecte a planului tău.",
  "limit.api_keys": "Ai atins limita de chei API a planului tău.",
  "limit.generic": "Ai atins o limită a planului tău.",
  "limit.upgrade": "Treci la un plan superior",

  // Dashboard: projects
  "dash.title": "Proiecte",
  "dash.earlyAccess": "Acces timpuriu",
  "dash.planSuffix": "(plan)",
  "dash.upgradePlan": "Schimbă planul",
  "dash.loadFailed": "Panoul nu a putut fi încărcat.",
  "dash.createFailed": "Proiectul nu a putut fi creat.",
  "dash.usageProjects": "Proiecte",
  "dash.usageEvents": "Evenimente în această perioadă",
  "dash.usageEventsHint":
    "Afișări de pagină + evenimente personalizate primite în această lună calendaristică.",
  "dash.eventsOverage": "Peste bugetul lunar: {n} evenimente au fost numărate, dar nu stocate.",
  "dash.newProject": "Proiect nou",
  "dash.projectName": "Numele proiectului",
  "dash.projectNamePlaceholder": "Aplicația mea",
  "dash.projectKey": "Cheie",
  "dash.projectKeyHint": "Litere mici, cifre și cratime. Implicit, un slug al numelui.",
  "dash.projectKeyPlaceholder": "aplicatia-mea",
  "dash.projectUrl": "URL-ul site-ului",
  "dash.timezone": "Fus orar",
  "dash.timezoneHint": "Zilele din panou încep la miezul nopții în acest fus.",
  "dash.createProject": "Creează proiect",
  "dash.searchPlaceholder": "Caută proiecte…",
  "dash.empty":
    "Niciun proiect încă. Creează unul per site sau aplicație ca să primești cheia publică și snippetul de instalare.",
  "dash.noMatch": "Niciun proiect nu se potrivește căutării.",
  "dash.today": "azi",
  "dash.views30d": "afișări · 30 zile",
  "dash.visitors30d": "vizitatori · 30 zile",
  "dash.lastSeen": "Ultimul hit {when}",
  "dash.noDataYet": "Nicio dată încă",
  "dash.openProject": "Deschide →",

  // Overview
  "overview.loadFailed": "Statisticile nu au putut fi încărcate.",
  "overview.range": "Interval de date",
  "overview.from": "De la",
  "overview.to": "Până la",
  "overview.tzHint": "Fusul orar al proiectului; schimbă-l din Setări.",
  "overview.liveNow": "{n} vizitatori chiar acum",
  "overview.vsPrevious": "Comparativ cu perioada anterioară de aceeași lungime",
  "overview.vsPreviousShort": "vs. anterior",
  "overview.viewsPerVisitor": "Afișări / vizitator",
  "overview.viewAll": "Vezi tot",
  "overview.noData": "Nimic în acest interval.",
  "overview.noGeo": "Fără date de locație. Necesită baza de date GeoLite2 pe server.",
  "overview.noUtm": "Nicio vizită cu taguri UTM în acest interval.",
  "overview.noEvents": "Niciun eveniment personalizat încă. Trimite unul cu oops.track().",
  "overview.emptyRange": "Niciun hit în acest interval.",
  "overview.emptyCta": "Deschide ghidul de instalare →",
  "overview.removeFilter": "Elimină acest filtru",
  "overview.clearFilters": "Șterge filtrele",
  "overview.visitorsNote":
    "Vizitatorii sunt numărați cu un hash zilnic fără cookie-uri, deci pe mai multe zile cifra este suma vizitatorilor unici zilnici.",

  // Events
  "events.loadFailed": "Evenimentele nu au putut fi încărcate.",
  "events.kind": "Tip",
  "events.allKinds": "Afișări de pagină + evenimente",
  "events.kindPageview": "Afișare de pagină",
  "events.kindEvent": "Eveniment",
  "events.searchPlaceholder": "Caută cale, titlu sau eveniment…",
  "events.total": "{total} evenimente",
  "events.empty": "Niciun eveniment în acest interval.",
  "events.colTime": "Când",
  "events.colEvent": "Eveniment",
  "events.colLocation": "Locație",
  "events.colClient": "Dispozitiv",
  "events.colVisitor": "Vizitator",
  "events.title": "Titlu",
  "events.screen": "Ecran",
  "events.source": "Sursă",
  "events.props": "Proprietăți",
  "events.privacyNote":
    "Coloana vizitator este un hash zilnic: grupează hiturile unei persoane într-o zi și nimic mai mult.",

  // Project settings
  "psettings.loadFailed": "Setările proiectului nu au putut fi încărcate.",
  "psettings.saveFailed": "Proiectul nu a putut fi salvat.",
  "psettings.rotateFailed": "Cheia nu a putut fi rotită.",
  "psettings.purgeFailed": "Evenimentele nu au putut fi golite.",
  "psettings.installTitle": "Instalare",
  "psettings.installBody":
    "Adaugă scriptul în layout, pune un pixel unde nu rulează JavaScript sau trimite POST către collect API din backend.",
  "psettings.publicKey": "Cheie publică",
  "psettings.publicKeyHint":
    "Nu e un secret: e livrat în site-ul tău. Poate doar trimite hituri. Rotește-o dacă e abuzată sau restricționeaz-o cu hostname-urile permise de mai jos.",
  "psettings.rotate": "Rotește cheia",
  "psettings.rotateConfirm": "Rotește acum — cheia veche nu mai funcționează imediat",
  "psettings.snippetScript": "Tag script",
  "psettings.snippetPixel": "Pixel",
  "psettings.snippetEvents": "Evenimente personalizate",
  "psettings.snippetApi": "API",
  "psettings.snippetScriptHint":
    "Numără fiecare afișare de pagină și schimbare de rută în SPA. Atributele și JavaScript API:",
  "psettings.snippetPixelHint":
    "Pentru e-mailuri și README-uri. u este pagina sau lucrul pe care vrei să-l numeri; adaugă n=open pentru un eveniment cu nume. Detalii:",
  "psettings.snippetEventsHint":
    "Până la 2 KB de proprietăți JSON per eveniment. Apar sub Evenimente personalizate și în jurnalul de evenimente. Detalii:",
  "psettings.snippetApiHint":
    "Din backend, un CLI sau un cron job. Dispozitivul și locația vin din cererea însăși. Detalii:",
  "psettings.trackingTitle": "Urmărire",
  "psettings.trackingBody":
    "Ce se acceptă și cum se numără zilele. Modificările se aplică de la următorul hit.",
  "psettings.collectEnabled": "Colectează hituri",
  "psettings.excludeBots": "Ignoră boții și browserele headless",
  "psettings.featureOff": "dezactivat global",
  "psettings.storeIp": "Stochează adresele IP ale vizitatorilor",
  "psettings.storeIpHint": "Oprit: se păstrează doar un hash zilnic și locația derivată. Pornit: adresa reală este salvată cu fiecare hit și apare în jurnalul de evenimente și ca defalcare.",
  "psettings.geoOff":
    "Căutările de locație sunt momentan dezactivate global; hiturile noi sunt stocate fără țară sau oraș.",
  "psettings.allowedOrigins": "Hostname-uri permise",
  "psettings.allowedOriginsHint":
    "Unul pe linie, de ex. myapp.example.com sau *.example.com. Gol = orice host. Hiturile de pe alte hosturi sunt respinse.",
  "psettings.infoTitle": "Proiect",
  "psettings.dangerTitle": "Zonă periculoasă",
  "psettings.purgeTitle": "Golește evenimentele",
  "psettings.purgeBody":
    "Șterge fiecare eveniment stocat al acestui proiect. Proiectul și cheia lui rămân.",
  "psettings.purged": "{n} evenimente șterse.",
  "psettings.purge": "Golește toate evenimentele",
  "psettings.purgeConfirm": "Da, șterge fiecare eveniment",
  "psettings.dangerBody":
    "Ștergerea proiectului îl elimină împreună cu toate evenimentele lui. Nu se poate anula.",
  "psettings.deleteProject": "Șterge proiectul",
  "psettings.deleteProjectConfirm": "Tastează cheia proiectului pentru confirmare",
  "psettings.deleteProjectFailed": "Proiectul nu a putut fi șters.",

  // API keys
  "keys.title": "Chei API",
  "keys.unavailableTitle": "API-ul de administrare nu este disponibil încă.",
  "keys.unavailableBody": "Îl lansăm treptat — revino în curând.",
  "keys.usage": "Folosește cheile cu API-ul de administrare și serverul MCP:",
  "keys.loadFailed": "Cheile API nu au putut fi încărcate.",
  "keys.createFailed": "Cheia nu a putut fi creată.",
  "keys.revokeFailed": "Cheia nu a putut fi revocată.",
  "keys.copyNow": "Copiază-ți noua cheie acum — nu va mai fi afișată.",
  "keys.newKeyName": "Numele noii chei",
  "keys.namePlaceholder": "Claude Code",
  "keys.createKey": "Creează cheie",
  "keys.empty": "Nicio cheie API încă.",
  "keys.colPrefix": "Prefix",
  "keys.colLastUsed": "Ultima utilizare",
  "keys.never": "Niciodată",
  "keys.revoke": "Revocă",
  "keys.revokeConfirm": "Revoci această cheie? Tot ce o folosește nu va mai funcționa imediat.",

  // Audit log
  "audit.title": "Jurnal de audit",
  "audit.intro": "Fiecare modificare și fiecare apel refuzat pe acest cont, cele mai noi primele.",
  "audit.loadFailed": "Jurnalul de audit nu a putut fi încărcat.",
  "audit.empty": "Niciun eveniment încă.",
  "audit.colTime": "Când",
  "audit.colActor": "Actor",
  "audit.colAction": "Acțiune",
  "audit.colTarget": "Țintă",
  "audit.colOutcome": "Rezultat",
  "audit.filterAction": "Filtrează după acțiune",
  "audit.allActions": "Toate acțiunile",
  "audit.outcomeOk": "ok",
  "audit.outcomeDenied": "refuzat",
  "audit.outcomeError": "eroare",
  "audit.system": "sistem",

  // Billing
  "billing.title": "Facturare",
  "billing.selfHostTitle": "Aceasta este o instanță self-hosted.",
  "billing.selfHostDisabled": "Facturarea este dezactivată",
  "billing.selfHostLimits":
    "Toate limitele vin din configurația ta — nu există planuri de cumpărat.",
  "billing.earlyTitle": "Ești în acces timpuriu: totul este inclus, gratuit.",
  "billing.earlyBody":
    "Nu e nimic de cumpărat încă. Planurile și limitele vor fi introduse mai târziu și vei afla înainte să se schimbe ceva.",
  "billing.earlyLink": "Ce vor include planurile plătite",
  "billing.unavailableTitle": "Planurile plătite nu sunt disponibile încă.",
  "billing.unavailableBody":
    "Lansăm facturarea treptat. Păstrezi tot ce ai în planul curent — revino în curând.",
  "billing.upgradeTitle": "Treci la un plan superior",
  "billing.onPlanPrefix": "Ești pe planul",
  "billing.onPlanSuffix":
    "— deblochează mai multe proiecte, mai multe evenimente pe lună și retenție mai lungă.",
  "billing.monthly": "Lunar",
  "billing.annual": "Anual",
  "billing.annualSave": "(economisești ~20%)",
  "billing.perYear": "an",
  "billing.perMonth": "lună",
  "billing.featProjects": "{n} proiecte",
  "billing.featEvents": "{n} evenimente / lună",
  "billing.featDataRetention": "Retenție date {n}",
  "billing.featKeys": "{n} chei API",
  "billing.featRetention": "Retenție audit {n}",
  "billing.featUsers": "{n} utilizatori",
  "billing.currentPlan": "Planul curent",
  "billing.processing": "Se procesează…",
  "billing.upgradeTo": "Treci la {plan}",
  "billing.processedBy": "Plățile sunt procesate de RevenueCat (Stripe).",
  "billing.entitlementsPrefix": "Drepturile",
  "billing.entitlementsSuffix": "se asociază automat planului tău.",
  "billing.notConfigured":
    "Facturarea nu este configurată încă (lipsește VITE_REVENUECAT_PUBLIC_KEY). Adaugă cheia publică RevenueCat Web Billing în .env și reconstruiește imaginea web.",
  "billing.signInAgain": "Te rugăm să te autentifici din nou pentru upgrade.",
  "billing.openingCheckout": "Se deschide plata securizată…",
  "billing.activating": "Plată finalizată — se activează planul tău…",
  "billing.nowOnPlan": "Acum ești pe planul {plan}! 🎉",
  "billing.willUpdate": "Plată primită — planul tău se va actualiza imediat.",
  "billing.cancelled": "Plată anulată.",
  "billing.checkoutFailed": "Plata a eșuat: {msg}",
  "billing.unknownError": "eroare necunoscută",
};

export default ro;
