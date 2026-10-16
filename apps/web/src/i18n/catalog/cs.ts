import type { PartialCatalog } from "./en";

/** Čeština — base catalog. */
const cs: PartialCatalog = {
  // Shared chrome
  "nav.pricing": "Ceník",
  "nav.blog": "Blog",
  "nav.docs": "Dokumentace",
  "nav.sponsors": "Sponzoři",
  "nav.login": "Přihlásit se",
  "nav.signup": "Zaregistrovat se zdarma",
  "nav.dashboard": "Přehled",
  "nav.logout": "Odhlásit se",
  "nav.openMenu": "Otevřít menu",
  "nav.closeMenu": "Zavřít menu",
  "nav.projects": "Projekty",
  "nav.apiKeys": "API klíče",
  "nav.billing": "Platby",

  "footer.madeBy": "Vytvořil Enrique Magallón",
  "footer.source": "Zdrojový kód",
  "footer.appsIndex": "Další aplikace",
  "footer.openSource": "Open source · MIT",

  "ui.theme": "Motiv",
  "ui.themeLight": "Přepnout na světlý motiv",
  "ui.themeDark": "Přepnout na tmavý motiv",
  "ui.language": "Jazyk",
  "ui.search": "Hledat",
  "ui.close": "Zavřít",

  // Project tabs (components/project-nav.tsx)
  "pnav.back": "← Všechny projekty",
  "pnav.overview": "Souhrn",
  "pnav.events": "Události",
  "pnav.settings": "Nastavení",
  "pnav.openSite": "Otevřít web",
  "pnav.paused": "Pozastaveno",
  "pnav.live": "Živě",
  "pnav.liveHint": "V posledních 5 minutách přišel hit",

  // Plan/limit formatters (src/lib/plans.ts)
  "plans.unlimited": "Neomezeně",
  "plans.custom": "Individuální",
  "plans.days": "{n} dní",
  "plans.year": "{n} rok",
  "plans.years": "{n} roky",

  // Landing — hero
  "landing.badge": "Open source · MIT · Self-hosting · Bez cookies",
  "landing.heroTitle": "Vědět, kdo navštěvuje vaše aplikace,",
  "landing.heroTitleAccent": "aniž byste kohokoli sledovali",
  "landing.heroBody":
    "oops počítá zobrazení stránek a návštěvníky pro každý registrovaný projekt: nejnavštěvovanější stránky, zdroje návštěv, země a města, zařízení, prohlížeče a vlastní události — z jednoho tagu script, pixelu nebo volání API. Žádné cookies, žádné uložené IP adresy, nic, co by muselo do cookie lišty.",
  "landing.getStarted": "Začít zdarma",
  "landing.whyFree": "Proč je to teď zdarma",
  "landing.seePricing": "Zobrazit ceník",
  "landing.readDocs": "Přečíst dokumentaci",
  "landing.earlyNote":
    "Předběžný přístup: každý účet má plný přístup zdarma. Tarify přijdou později a dáme vědět předem.",
  "landing.freeNote": "Tarif zdarma: {projects} projekty a {events} událostí / měsíc. Bez karty.",

  // Landing — three paths
  "landing.pathsTitle": "Tři způsoby počítání",
  "landing.pathsBody": "Vyberte ten, který sedí každé aplikaci. Všechny končí ve stejném přehledu.",
  "landing.pathScriptTitle": "Jeden tag script",
  "landing.pathScriptBody":
    "Pod 3 KB, bez závislostí. Počítá každé zobrazení stránky, sleduje změny tras v SPA a nabízí oops.track() pro vlastní události. Funguje stejně v Qwiku, Astru, Reactu, na stránkách s jQuery i v hrách v Phaseru.",
  "landing.pathPixelTitle": "Sledovací pixel",
  "landing.pathPixelBody":
    "Obrázek 1×1 pro místa, kde JavaScript nemůže běžet: e-maily, README, dokumentace hostovaná jinde. URL říká, kterou stránku nebo událost zastupuje.",
  "landing.pathApiTitle": "Collect API",
  "landing.pathApiBody":
    "Jediný POST s veřejným klíčem projektu — z backendu, CLI, herního serveru nebo cron jobu. Ideální pro aplikace bez DOM.",

  // Landing — how it works
  "landing.howTitle": "Jak to funguje",
  "landing.step1Title": "1. Vytvořte projekt",
  "landing.step1Body":
    "Jeden projekt na web nebo aplikaci. Dostanete veřejný klíč pro script, pixel a API a zvolíte časové pásmo.",
  "landing.step2Title": "2. Vložte snippet",
  "landing.step2Body":
    "Zkopírujte ho z nastavení projektu do svého layoutu. První zobrazení stránek se objeví během několika sekund.",
  "landing.step3Title": "3. Čtěte přehled",
  "landing.step3Body":
    "Zvolte období, klikněte na libovolnou stránku, zemi nebo zařízení a vše se podle toho vyfiltruje, sledujte živé počítadlo, nebo nechte AI agenta číst čísla přes MCP.",

  // Landing — what you see
  "landing.seeTitle": "Všechno, co chcete vědět, a nic navíc",
  "landing.seeBody":
    "Přehled odpovídá na otázky, které si lidé o webu skutečně kladou, a tam končí.",
  "landing.seeWhereTitle": "Odkud.",
  "landing.seeWhereBody": "Zdroje návštěv, UTM source / medium / campaign, země, regiony a města.",
  "landing.seeWhoTitle": "Na čem.",
  "landing.seeWhoBody":
    "Počítač, mobil nebo tablet; prohlížeč a operační systém; velikost obrazovky a jazyk.",
  "landing.seeWhatTitle": "Co dělají.",
  "landing.seeWhatBody":
    "Nejnavštěvovanější stránky, vstupní cesty a vlastní události, které posíláte (registrace, nákupy, kliknutí), i s jejich vlastnostmi.",
  "landing.seeLiveTitle": "Právě teď.",
  "landing.seeLiveBody": "Návštěvníci za posledních pět minut a stránky, na kterých jsou.",

  // Landing — privacy
  "landing.privacyTitle": "Šetrné k soukromí už z principu",
  "landing.privacyBody":
    "Tracker nenastavuje žádné cookie a do prohlížeče nic nezapisuje. Server hashuje IP adresu každého návštěvníka se solí, která se každý den mění, uchová jen odvozenou zemi, region a město a user agent zahodí, jakmile zná zařízení, prohlížeč a OS.",
  "landing.privacy1": "Žádné cookies, žádný localStorage, žádný fingerprinting napříč weby ani dny",
  "landing.privacy2": "Surové IP adresy se nikdy neukládají — jen denní solený hash",
  "landing.privacy3":
    "Query stringy se z URL stránek odstraňují (kromě UTM tagů), takže tokeny ani e-maily se do přehledu nikdy nedostanou",
  "landing.privacy4": "Volitelná podpora Do Not Track a filtrování botů",
  "landing.apiNote": "Veřejné klíče mohou jen posílat hity. Nikdy nemohou nic číst.",
  "landing.panelRequest": "Požadavek",
  "landing.panelResponse": "Odpověď",

  // Landing — MCP section
  "landing.mcpBadge": "Model Context Protocol",
  "landing.mcpTitle": "Zeptejte se svého AI agenta, jak se webu daří",
  "landing.mcpIntro":
    "oops obsahuje MCP server. Připojte ho k Claude Code, Claude Desktop, Cursor nebo jakémukoli MCP hostu a ptejte se třeba",
  "landing.mcpExample1": "„jak se tento týden změnila návštěvnost dokumentace?“",
  "landing.mcpOr": "nebo",
  "landing.mcpExample2": "„které země nejčastěji navštěvují stránku s ceníkem?“",
  "landing.mcpBullet1Title": "Klíče s rolemi.",
  "landing.mcpBullet1Body":
    "Klíč s rolí viewer nástroje pro mazání ani nevidí; editor a admin odemknou víc. Vynucuje to i API.",
  "landing.mcpBullet2Title": "Člověk ve smyčce.",
  "landing.mcpBullet2Body":
    "Destruktivní akce (smazání projektu, vymazání jeho událostí) si vyžádají vaše potvrzení, než se cokoli stane.",
  "landing.mcpBullet3Title": "Auditní stopa.",
  "landing.mcpBullet3Body":
    "Každá změna i každé odmítnuté volání se loguje — na straně serveru i agenta.",
  "landing.mcpBullet4Title": "Lokálně nebo vzdáleně.",
  "landing.mcpBullet4Body1": "Spusťte ho přes stdio pomocí",
  "landing.mcpBullet4Npm": "npm",
  "landing.mcpBullet4Body2": "nebo nasměrujte svého hosta na",
  "landing.mcpBullet4Body3": "se svým klíčem.",
  "landing.mcpPanelLocal": "Claude Code · lokálně (npm)",
  "landing.mcpPanelRemote": "Claude Code · vzdáleně (nic k instalaci)",
  "landing.mcpPanelJson": "Jakýkoli MCP host (JSON)",
  "landing.mcpKeyNote": "Klíč s požadovanou rolí vytvoříte v",
  "landing.mcpKeyLink": "Přehled → API klíče",

  // Landing — self-host callout + closing CTA
  "landing.selfhostTitle": "Provozujte si to sami (MIT, open source)",
  "landing.selfhostBody1":
    "Celý stack — Flask API, tracker, MCP server i tato Qwik aplikace — je pod licencí MIT. Spusťte ho na vlastním VPS jedním",
  "landing.selfhostBody2": ". Žádný platební kód, žádné limity kromě těch, které si nastavíte.",
  "landing.viewGithub": "Zobrazit na GitHub",
  "landing.ctaTitle": "Prvního návštěvníka uvidíte do minuty",
  "landing.ctaBody":
    "Vytvořte projekt, vložte jeden tag script a sledujte, jak se živé počítadlo hýbe.",

  // Blog (chrome only)
  "blog.title": "Blog",
  "blog.intro": "Novinky o produktu, technické poznámky a tipy, jak číst svá čísla.",
  "blog.comingSoon": "Již brzy.",
  "blog.readMore": "Číst dál →",
  "blog.allPosts": "← Všechny články",
  "blog.notFoundTitle": "Článek nenalezen",
  "blog.notFoundBody": "Žádný článek není na adrese",
  "blog.backToBlog": "Zpět na blog",
  "blog.seeTiers": "Zobrazit plánované tarify",

  // Info index
  "info.title": "Informace",
  "info.intro": "Referenční stránky oops. Postupně jich přibude.",
  "info.pricingTitle": "Ceník",
  "info.pricingBody": "Tarify, limity a ceny.",
  "info.plannedPricingTitle": "Plánovaný ceník",
  "info.plannedPricingBody": "Tarify, které hodláme zavést po předběžném přístupu.",
  "info.docsTitle": "Dokumentace",
  "info.docsBody":
    "Návod na instalaci trackeru, pixel, collect API, reference stats API a nastavení MCP.",
  "info.termsTitle": "Podmínky",
  "info.termsBody": "Podmínky služby (již brzy).",
  "info.privacyTitle": "Soukromí",
  "info.privacyBody": "Co ukládáme a co nikdy neukládáme (již brzy).",
  "info.comingSoon": "Tato stránka bude brzy k dispozici.",
  "info.backToInfo": "Zpět na informace",

  // Pricing page
  "pricing.title": "Jednoduchý, férový ceník",
  "pricing.titlePlanned": "Plánovaný ceník",
  "pricing.intro":
    "Začněte zdarma. Přejděte výš, až budete potřebovat víc projektů, víc událostí za měsíc nebo delší uchování dat. Provozujte si to sami a nemějte žádné limity.",
  "pricing.introPlanned":
    "Toto jsou tarify, které hodláme zavést po předběžném přístupu. Zatím nic z toho neplatí.",
  "pricing.earlyTitle": "Právě teď má každý účet plný přístup zdarma.",
  "pricing.earlyBody":
    "Neomezené projekty, události a uchování dat, API i MCP server. Až tarify dorazí, oznámíme to na blogu a e-mailem, než se jakýkoli limit dotkne existujícího účtu. Ceny a limity níže se ještě mohou změnit.",
  "pricing.earlyCta": "Přečtěte si, co budou placené tarify obsahovat",
  "pricing.enterpriseTitle": "Potřebujete vlastní limity, SSO nebo SLA?",
  "pricing.enterpriseBody": "Tarify Enterprise šijeme na míru vašemu týmu.",
  "pricing.contactUs": "Kontaktujte nás",
  "pricing.footnote":
    "Všechny ceny v USD. Roční platba ušetří ~20 %. Počty projektů a klíčů jsou tvrdé limity; události nad měsíční rozpočet se počítají, ale neukládají, a váš web nikdy neuvidí chybu. Události starší než okno uchování se mažou.",
  "pricing.footnoteEarly": "Během předběžného přístupu nic z toho neplatí.",

  // Pricing table (plan labels come from packages/shared/plan_limits.json)
  "pricing.mostPopular": "Nejoblíbenější",
  "pricing.perMonth": "/měs.",
  "pricing.perYear": "/rok",
  "pricing.projects": "projektů",
  "pricing.eventsPerMonth": "událostí / měs.",
  "pricing.retention": "Uchování dat: {value}",
  "pricing.apiKeys": "API klíčů",
  "pricing.auditRetention": "Uchování auditu: {value}",
  "pricing.user": "uživatel",
  "pricing.users": "uživatelů",
  "pricing.api": "API: {api}",
  "pricing.sponsorsBadge": "Odznak /sponsors",
  "pricing.teamExtras": "Role + prioritní podpora",
  "pricing.enterpriseExtras": "SSO, SLA, vlastní limity",
  "pricing.getStarted": "Začít",
  "pricing.startPlan": "Zvolit {plan}",

  // Docs
  "docs.title": "Dokumentace",
  "docs.intro":
    "Jak dostat oops do aplikace, posílat hity odkudkoli a číst čísla přes REST API nebo AI agenta. Celý kontrakt — každý endpoint, objekt a chyba — je v repozitáři.",
  "docs.fullContract": "Přečíst celý kontrakt (CONTRACT.md)",
  "docs.baseUrl": "Základní URL",
  "docs.trackerTitle": "Script trackeru",
  "docs.trackerBody":
    "Script bez závislostí, pod 3 KB, servírovaný z tohoto hostu. Přidejte ho jednou do layoutu; pošle jeden hit za každé zobrazení stránky a každou změnu trasy v SPA, bez cookies a bez ukládání čehokoli v prohlížeči.",
  "docs.trackerAttrsTitle": "Atributy (zobrazeny výchozí hodnoty)",
  "docs.attrKey": "veřejný klíč projektu (povinný).",
  "docs.attrSpa":
    "napojí se na History API a pošle zobrazení stránky při každé změně trasy. Nastavte false, pokud chcete oops.pageview() volat sami.",
  "docs.attrHash": "hash routing: ponechá #fragment v URL a naslouchá hashchange.",
  "docs.attrDnt": "respektuje signál Do Not Track z prohlížeče.",
  "docs.attrLocal":
    "sleduje i na localhost, surových IP, file: a *.local (ve výchozím stavu ignorováno).",
  "docs.attrApi": "přepíše endpoint collect (self-hosted instance za jiným hostem).",
  "docs.trackerJsTitle": "JavaScript API",
  "docs.trackerJsBody":
    "window.oops nabízí track(name, props) pro vlastní události a pageview() pro ruční zobrazení stránek. Volání zařazená do fronty před načtením scriptu se přehrají.",
  "docs.trackerDeclarative":
    "Kliknutí na prvky s data-oops-event se sledují automaticky, s volitelnými JSON vlastnostmi:",
  "docs.trackerWhat":
    "Co se posílá: URL stránky bez query stringu (UTM tagy se přečtou a pak zahodí), referrer, titulek, velikost obrazovky a jazyk prohlížeče. Zařízení, prohlížeč, OS a poloha se odvozují na serveru z požadavku a nikdy se neukládají v surové podobě.",
  "docs.pixelTitle": "Sledovací pixel",
  "docs.pixelBody":
    "Pro místa, kde neběží JavaScript — newslettery, soubory README, dokumentace na jiném hostu. Obrázek je průhledný GIF o 43 bajtech, nikdy se necachuje. Stránku předejte jako u a volitelně název události jako n.",
  "docs.collectTitle": "Collect API",
  "docs.collectBody":
    "POST /api/collect s veřejným klíčem projektu v hlavičce X-Project-Key (nebo v poli k). Přijímají se těla JSON, form-encoded i text/plain, CORS je otevřený a odpověď je vždy 202, takže sledovaný web nikdy neuvidí chybu.",
  "docs.collectField1":
    "n: název události (výchozí pageview). 1-60 písmen, číslic, mezer, _ . : / nebo -.",
  "docs.collectField2":
    "u: URL nebo cesta stránky (povinné pro cokoli smysluplného). Query stringy se čtou jen kvůli UTM tagům.",
  "docs.collectField3":
    "r: URL referreru; t: titulek stránky (≤ 200); l: jazyk (≤ 16); w / h: velikost obrazovky.",
  "docs.collectField4": "p: JSON objekt s vlastnostmi pro vlastní události (≤ 2 KB).",
  "docs.collectField5":
    "s: zdroj — script (výchozí), pixel nebo api. Zařízení, prohlížeč, OS a poloha pocházejí z hlaviček a adresy samotného požadavku.",
  "docs.collectResponses":
    "Tělo říká, co se stalo: { ok: true } při uložení, nebo { ok: false, reason } s reason = paused (sledování projektu vypnuto), origin (hostname není v povoleném seznamu), bot (crawler nebo headless prohlížeč) nebo limit (nad měsíční rozpočet — započítáno, neuloženo).",
  "docs.authTitle": "Autentizace",
  "docs.authBody": "Tři druhy přihlašovacích údajů, každý na jednu věc:",
  "docs.authDashboard":
    "Relace přehledu: JWT bearer tokeny vydané přes /auth/login. Mají všechna oprávnění.",
  "docs.authApiKey":
    "API pro správu: API klíče s rolí (viewer / editor / admin). Hlavička X-API-Key: oops_live_… (nebo Authorization: Bearer).",
  "docs.authPublicKey":
    "Collect API, tracker a pixel: veřejné klíče projektu. Hlavička X-Project-Key: oops_pub_… (nebo pole k). Identifikují jeden projekt a mohou jen posílat hity.",
  "docs.projectsTitle": "Projekty",
  "docs.projectsBody":
    "Projekt je jeden web nebo aplikace. Vlastní veřejný klíč, časové pásmo (pro rozdělení do dnů), volitelný seznam povolených hostnames a přepínače sběru a botů.",
  "docs.statsTitle": "Statistiky",
  "docs.statsBody":
    "Období jsou včetně krajních místních dat v pásmu z parametru tz (výchozí: pásmo projektu), jako period=today|yesterday|7d|30d|90d|12mo nebo from/to. Jakoukoli dimenzi lze předat jako filtr (např. country=ES&device=mobile) a vše v odpovědi se na ni omezí. Návštěvníci se počítají denním hashem, takže přes více dní jde o součet denních unikátů.",
  "docs.dimensionsTitle": "Dimenze",
  "docs.dimensionsBody":
    "Použitelné jako rozpad (by=) i jako filtry na každém endpointu statistik a událostí. referrer=(direct) vybere hity bez referreru.",
  "docs.errorsTitle": "Chyby a limity",
  "docs.errorsBody":
    "Chyby jsou JSON: { \"error\": { \"code\", \"message\" } }. Vytváření nad limit tarifu odpoví 402 limit_reached s error.which = projects | api_keys. Hity nad měsíční rozpočet událostí se přijmou (202), ale neuloží.",
  "docs.privacyBody":
    "Soukromí: oops nikdy neukládá surové IP adresy ani user agenty — jen solený denní hash a odvozená pole zařízení / prohlížeč / OS / poloha. URL stránek před uložením přijdou o query string.",
  "docs.mcpTitle": "MCP (AI agenti)",
  "docs.mcpBody":
    "MCP server zpřístupňuje API pro správu jako nástroje, filtrované podle role klíče, kterým se připojíte. Destruktivní nástroje žádají o potvrzení. Prompt weekly_report provede model čísly projektu.",
  "docs.mcpLocal": "Lokálně (stdio, npm)",
  "docs.mcpRemote": "Vzdáleně (Streamable HTTP)",
  "docs.mcpTools":
    "Nástroje: list_projects, get_project, create_project, update_project, rotate_project_key, delete_project, project_summary, get_stats, get_breakdown, list_events, get_live, purge_events, get_usage, get_audit_log.",
  "docs.colMethod": "Metoda",
  "docs.colPath": "Cesta",
  "docs.colScope": "Oprávnění",
  "docs.colNotes": "Poznámky",

  // Sponsors
  "sponsors.title": "Sponzoři",
  "sponsors.intro1": "oops je open source (MIT). Každý předplatitel",
  "sponsors.introLink": "Pro / Supporter",
  "sponsors.intro2": "pomáhá udržet self-hosting zdarma — a získá odznak a místo na této stránce.",
  "sponsors.intro2Early":
    "pomůže udržet self-hosting zdarma — a získá odznak a místo na této stránce.",
  "sponsors.emptyTitle": "Vaše jméno může být na této stránce první.",
  "sponsors.emptyBody": "Každý předplatitel Pro / Supporter tu získá místo a vložitelný odznak.",
  "sponsors.emptyBodyEarly":
    "Předplatné Supporter se otevře spolu s placenými tarify, po předběžném přístupu. Do té doby je každý účet zdarma.",
  "sponsors.tierSupporter": "Podporovatel {tier}",
  "sponsors.badgeTitle": "Odznak podporovatele",
  "sponsors.badgeBody": "Podporovatelé Pro získají vložitelný odznak pro svůj web nebo README:",
  "sponsors.badgeBodyEarly":
    "Podporovatelé Pro získají vložitelný odznak pro svůj web nebo README:",
  "sponsors.badgeLabel": "oops Supporter",
  "sponsors.readPlans": "Přečtěte si o chystaných tarifech",
  "sponsors.become": "Staňte se podporovatelem",

  // Early-access banner
  "early.bannerTitle": "Předběžný přístup.",
  "early.bannerText":
    "Každý účet má teď plný přístup zdarma. Tarify a limity zavedeme později a dáme vědět dřív, než se cokoli změní.",
  "early.bannerLink": "Co budou placené tarify obsahovat",

  // Site-building curtain
  "building.title": "Stavíme oops",
  "building.body":
    "Analytika šetrná k soukromí pro vaše aplikace. Web ještě není otevřený — ale tracker, collect API a MCP server dál odpovídají bez problémů.",
  "building.footer": "oops.3m4.net · již brzy",

  // Shared
  "common.loading": "Načítání…",
  "common.copy": "Kopírovat",
  "common.copied": "Zkopírováno!",
  "common.creating": "Vytváření…",
  "common.saving": "Ukládání…",
  "common.save": "Uložit",
  "common.saved": "Uloženo.",
  "common.cancel": "Zrušit",
  "common.close": "Zavřít",
  "common.delete": "Smazat",
  "common.deleting": "Mazání…",
  "common.optional": "(volitelné)",
  "common.email": "E-mail",
  "common.password": "Heslo",
  "common.created": "Vytvořeno",
  "common.role": "Role",
  "common.name": "Název",
  "common.key": "Klíč",
  "common.description": "Popis",
  "common.search": "Hledat",
  "common.retry": "Zkusit znovu",
  "common.dismiss": "Zavřít",
  "common.pageOf": "Strana {page} z {pages} · {total} řádků",

  // Enum labels
  "period.today": "Dnes",
  "period.yesterday": "Včera",
  "period.7d": "7 dní",
  "period.30d": "30 dní",
  "period.90d": "90 dní",
  "period.12mo": "12 měsíců",
  "interval.hour": "po hodinách",
  "interval.day": "po dnech",
  "interval.month": "po měsících",
  "metric.pageviews": "Zobrazení stránek",
  "metric.visitors": "Návštěvníci",
  "metric.events": "Události",
  "dim.path": "Stránky",
  "dim.hostname": "Hostname",
  "dim.referrer": "Zdroje návštěv",
  "dim.direct": "Přímo / žádný",
  "dim.country": "Země",
  "dim.region": "Regiony",
  "dim.city": "Města",
  "dim.device": "Zařízení",
  "dim.browser": "Prohlížeče",
  "dim.os": "Operační systémy",
  "dim.lang": "Jazyky",
  "dim.utm_source": "UTM zdroje",
  "dim.utm_medium": "UTM média",
  "dim.utm_campaign": "UTM kampaně",
  "dim.name": "Vlastní události",
  "dim.ip": "IP adresy",
  "device.desktop": "Počítač",
  "device.mobile": "Mobil",
  "device.tablet": "Tablet",
  "device.bot": "Bot",

  // Auth: login
  "auth.loginTitle": "Přihlásit se",
  "auth.loginSubtitle": "Vítejte zpět v oops.",
  "auth.loginFailed": "Přihlášení se nezdařilo. Zkontrolujte e-mail a heslo.",
  "auth.loggingIn": "Přihlašování…",
  "auth.noAccount": "Nemáte účet?",
  "auth.signUp": "Zaregistrovat se",

  // Auth: signup
  "auth.signupTitle": "Vytvořte si účet",
  "auth.signupFailed": "Registrace se nezdařila. Zkuste to prosím znovu.",
  "auth.inviteOnlyTitle": "🔒 Registrace je teď jen na pozvánku",
  "auth.inviteOnlyBody": "Spouštíme postupně. Sledujte nás — místa se brzy otevřou.",
  "auth.haveAccount": "Už máte účet?",
  "auth.logIn": "Přihlásit se",
  "auth.earlyAccessPitch": "Předběžný přístup: plný přístup zdarma. Bez karty.",
  "auth.freePitch": "Navždy zdarma: {projects} projekty a {events} událostí / měsíc.",
  "auth.workspaceName": "Název pracovního prostoru",
  "auth.workspacePlaceholder": "Acme s.r.o.",
  "auth.passwordHint": "Alespoň 8 znaků.",
  "auth.creatingAccount": "Vytváření účtu…",
  "auth.createAccount": "Vytvořit účet",

  // 402 limit_reached, per `error.which`
  "limit.projects": "Dosáhli jste limitu projektů svého tarifu.",
  "limit.api_keys": "Dosáhli jste limitu API klíčů svého tarifu.",
  "limit.generic": "Dosáhli jste limitu svého tarifu.",
  "limit.upgrade": "Vylepšete svůj tarif",

  // Dashboard: projects
  "dash.title": "Projekty",
  "dash.earlyAccess": "Předběžný přístup",
  "dash.planSuffix": "tarif",
  "dash.upgradePlan": "Vylepšit tarif",
  "dash.loadFailed": "Přehled se nepodařilo načíst.",
  "dash.createFailed": "Projekt se nepodařilo vytvořit.",
  "dash.usageProjects": "Projekty",
  "dash.usageEvents": "Události v tomto období",
  "dash.usageEventsHint":
    "Zobrazení stránek + vlastní události přijaté v tomto kalendářním měsíci.",
  "dash.eventsOverage": "Nad měsíční rozpočet: {n} událostí bylo započítáno, ale neuloženo.",
  "dash.newProject": "Nový projekt",
  "dash.projectName": "Název projektu",
  "dash.projectNamePlaceholder": "Moje aplikace",
  "dash.projectKey": "Klíč",
  "dash.projectKeyHint": "Malá písmena, číslice a pomlčky. Výchozí je slug z názvu.",
  "dash.projectKeyPlaceholder": "moje-aplikace",
  "dash.projectUrl": "URL webu",
  "dash.timezone": "Časové pásmo",
  "dash.timezoneHint": "Dny v přehledu začínají o půlnoci v tomto pásmu.",
  "dash.createProject": "Vytvořit projekt",
  "dash.searchPlaceholder": "Hledat projekty…",
  "dash.empty":
    "Zatím žádné projekty. Vytvořte jeden pro každý web nebo aplikaci a získejte veřejný klíč a instalační snippet.",
  "dash.noMatch": "Hledání neodpovídá žádný projekt.",
  "dash.today": "dnes",
  "dash.views30d": "zobrazení · 30 dní",
  "dash.visitors30d": "návštěvníků · 30 dní",
  "dash.lastSeen": "Poslední hit {when}",
  "dash.noDataYet": "Zatím žádná data",
  "dash.openProject": "Otevřít →",

  // Overview
  "overview.loadFailed": "Statistiky se nepodařilo načíst.",
  "overview.range": "Období",
  "overview.from": "Od",
  "overview.to": "Do",
  "overview.tzHint": "Časové pásmo projektu; změníte ho v Nastavení.",
  "overview.liveNow": "{n} návštěvníků právě teď",
  "overview.vsPrevious": "Ve srovnání s předchozím obdobím stejné délky",
  "overview.vsPreviousShort": "vs. předchozí",
  "overview.viewsPerVisitor": "Zobrazení / návštěvník",
  "overview.viewAll": "Zobrazit vše",
  "overview.noData": "V tomto období nic není.",
  "overview.noGeo": "Žádná data o poloze. Vyžaduje databázi GeoLite2 na serveru.",
  "overview.noUtm": "V tomto období žádné návštěvy s UTM tagy.",
  "overview.noEvents": "Zatím žádné vlastní události. Pošlete nějakou přes oops.track().",
  "overview.emptyRange": "V tomto období žádné hity.",
  "overview.emptyCta": "Otevřít návod na instalaci →",
  "overview.removeFilter": "Odebrat tento filtr",
  "overview.clearFilters": "Zrušit filtry",
  "overview.visitorsNote":
    "Návštěvníci se počítají denním hashem bez cookies, takže přes více dní je číslo součtem denních unikátních návštěvníků.",

  // Events
  "events.loadFailed": "Události se nepodařilo načíst.",
  "events.kind": "Typ",
  "events.allKinds": "Zobrazení stránek + události",
  "events.kindPageview": "Zobrazení stránky",
  "events.kindEvent": "Událost",
  "events.searchPlaceholder": "Hledat cestu, titulek nebo událost…",
  "events.total": "{total} událostí",
  "events.empty": "V tomto období žádné události.",
  "events.colTime": "Kdy",
  "events.colEvent": "Událost",
  "events.colLocation": "Poloha",
  "events.colClient": "Zařízení",
  "events.colVisitor": "Návštěvník",
  "events.title": "Titulek",
  "events.screen": "Obrazovka",
  "events.source": "Zdroj",
  "events.props": "Vlastnosti",
  "events.privacyNote":
    "Sloupec návštěvníka je denní hash: seskupuje hity jedné osoby v rámci dne a nic víc.",

  // Project settings
  "psettings.loadFailed": "Nastavení projektu se nepodařilo načíst.",
  "psettings.saveFailed": "Projekt se nepodařilo uložit.",
  "psettings.rotateFailed": "Klíč se nepodařilo obměnit.",
  "psettings.purgeFailed": "Události se nepodařilo vymazat.",
  "psettings.installTitle": "Instalace",
  "psettings.installBody":
    "Přidejte script do layoutu, vložte pixel tam, kde neběží JavaScript, nebo posílejte POST na collect API z backendu.",
  "psettings.publicKey": "Veřejný klíč",
  "psettings.publicKeyHint":
    "Není to tajemství: je součástí vašeho webu. Může jen posílat hity. Pokud je zneužit, obměňte ho, nebo ho omezte povolenými hostnames níže.",
  "psettings.rotate": "Obměnit klíč",
  "psettings.rotateConfirm": "Vyměnit teď — starý klíč okamžitě přestane fungovat",
  "psettings.snippetScript": "Tag script",
  "psettings.snippetPixel": "Pixel",
  "psettings.snippetEvents": "Vlastní události",
  "psettings.snippetApi": "API",
  "psettings.snippetScriptHint":
    "Počítá každé zobrazení stránky a změnu trasy v SPA. Atributy a JavaScript API:",
  "psettings.snippetPixelHint":
    "Pro e-maily a README. u je stránka nebo věc, kterou chcete počítat; přidejte n=open pro pojmenovanou událost. Podrobnosti:",
  "psettings.snippetEventsHint":
    "Až 2 KB JSON vlastností na událost. Zobrazí se pod Vlastní události a v záznamu událostí. Podrobnosti:",
  "psettings.snippetApiHint":
    "Z backendu, CLI nebo cron jobu. Zařízení a poloha pocházejí ze samotného požadavku. Podrobnosti:",
  "psettings.trackingTitle": "Sledování",
  "psettings.trackingBody": "Co se přijímá a jak se počítají dny. Změny platí od dalšího hitu.",
  "psettings.collectEnabled": "Sbírat hity",
  "psettings.excludeBots": "Ignorovat boty a headless prohlížeče",
  "psettings.featureOff": "globálně vypnuto",
  "psettings.storeIp": "Ukládat IP adresy návštěvníků",
  "psettings.storeIpHint": "Vypnuto: uchovává se jen denní hash a odvozená poloha. Zapnuto: skutečná adresa se ukládá s každým hitem a zobrazuje se v protokolu událostí a jako rozpad.",
  "psettings.geoOff":
    "Zjišťování polohy je teď globálně vypnuté; nové hity se ukládají bez země a města.",
  "psettings.allowedOrigins": "Povolené hostnames",
  "psettings.allowedOriginsHint":
    "Jeden na řádek, např. myapp.example.com nebo *.example.com. Prázdné = jakýkoli host. Hity z jiných hostů se zahazují.",
  "psettings.infoTitle": "Projekt",
  "psettings.dangerTitle": "Nebezpečná zóna",
  "psettings.purgeTitle": "Vymazat události",
  "psettings.purgeBody":
    "Smaže všechny uložené události tohoto projektu. Projekt a jeho klíč zůstanou.",
  "psettings.purged": "Smazáno {n} událostí.",
  "psettings.purge": "Vymazat všechny události",
  "psettings.purgeConfirm": "Ano, smazat všechny události",
  "psettings.dangerBody":
    "Smazání projektu odstraní projekt i všechny jeho události. Nelze vrátit zpět.",
  "psettings.deleteProject": "Smazat projekt",
  "psettings.deleteProjectConfirm": "Pro potvrzení napište klíč projektu",
  "psettings.deleteProjectFailed": "Projekt se nepodařilo smazat.",

  // API keys
  "keys.title": "API klíče",
  "keys.unavailableTitle": "API pro správu zatím není k dispozici.",
  "keys.unavailableBody": "Spouštíme ho postupně — zkuste to brzy znovu.",
  "keys.usage": "Klíče používejte s API pro správu a MCP serverem:",
  "keys.loadFailed": "API klíče se nepodařilo načíst.",
  "keys.createFailed": "Klíč se nepodařilo vytvořit.",
  "keys.revokeFailed": "Klíč se nepodařilo zneplatnit.",
  "keys.copyNow": "Zkopírujte si nový klíč hned — znovu se už nezobrazí.",
  "keys.newKeyName": "Název nového klíče",
  "keys.namePlaceholder": "Claude Code",
  "keys.createKey": "Vytvořit klíč",
  "keys.empty": "Zatím žádné API klíče.",
  "keys.colPrefix": "Prefix",
  "keys.colLastUsed": "Naposledy použit",
  "keys.never": "Nikdy",
  "keys.revoke": "Zneplatnit",
  "keys.revokeConfirm": "Zneplatnit tento klíč? Vše, co ho používá, okamžitě přestane fungovat.",

  // Audit log
  "audit.title": "Auditní záznam",
  "audit.intro": "Každá změna a každé odmítnuté volání na tomto účtu, nejnovější první.",
  "audit.loadFailed": "Auditní záznam se nepodařilo načíst.",
  "audit.empty": "Zatím žádné události.",
  "audit.colTime": "Kdy",
  "audit.colActor": "Aktér",
  "audit.colAction": "Akce",
  "audit.colTarget": "Cíl",
  "audit.colOutcome": "Výsledek",
  "audit.filterAction": "Filtrovat podle akce",
  "audit.allActions": "Všechny akce",
  "audit.outcomeOk": "ok",
  "audit.outcomeDenied": "odmítnuto",
  "audit.outcomeError": "chyba",
  "audit.system": "systém",

  // Billing
  "billing.title": "Platby",
  "billing.selfHostTitle": "Toto je self-hosted instance.",
  "billing.selfHostDisabled": "Platby jsou vypnuté",
  "billing.selfHostLimits":
    "Všechny limity vycházejí z vaší konfigurace — nejsou tu žádné tarify ke koupi.",
  "billing.earlyTitle": "Jste v předběžném přístupu: vše je v ceně, zdarma.",
  "billing.earlyBody":
    "Zatím není co kupovat. Tarify a limity zavedeme později a dozvíte se o tom dřív, než se cokoli změní.",
  "billing.earlyLink": "Co budou placené tarify obsahovat",
  "billing.unavailableTitle": "Placené tarify zatím nejsou k dispozici.",
  "billing.unavailableBody":
    "Platby spouštíme postupně. Vše ze svého současného tarifu si ponecháváte — zkuste to brzy znovu.",
  "billing.upgradeTitle": "Vylepšete svůj tarif",
  "billing.onPlanPrefix": "Máte tarif",
  "billing.onPlanSuffix": "— odemkněte víc projektů, víc událostí za měsíc a delší uchování dat.",
  "billing.monthly": "Měsíčně",
  "billing.annual": "Ročně",
  "billing.annualSave": "(ušetříte ~20 %)",
  "billing.perYear": "rok",
  "billing.perMonth": "měs.",
  "billing.featProjects": "{n} projektů",
  "billing.featEvents": "{n} událostí / měs.",
  "billing.featDataRetention": "Uchování dat: {n}",
  "billing.featKeys": "{n} API klíčů",
  "billing.featRetention": "Uchování auditu: {n}",
  "billing.featUsers": "{n} uživatelů",
  "billing.currentPlan": "Aktuální tarif",
  "billing.processing": "Zpracování…",
  "billing.upgradeTo": "Přejít na {plan}",
  "billing.processedBy": "Platby zpracovává RevenueCat (Stripe).",
  "billing.entitlementsPrefix": "Oprávnění",
  "billing.entitlementsSuffix": "se automaticky mapují na váš tarif.",
  "billing.notConfigured":
    "Platby zatím nejsou nakonfigurované (chybí VITE_REVENUECAT_PUBLIC_KEY). Přidejte veřejný klíč RevenueCat Web Billing do .env a znovu sestavte web image.",
  "billing.signInAgain": "Pro vylepšení tarifu se prosím znovu přihlaste.",
  "billing.openingCheckout": "Otevírání zabezpečené platby…",
  "billing.activating": "Platba dokončena — aktivujeme váš tarif…",
  "billing.nowOnPlan": "Nyní máte tarif {plan}! 🎉",
  "billing.willUpdate": "Platba přijata — váš tarif se za okamžik aktualizuje.",
  "billing.cancelled": "Platba zrušena.",
  "billing.checkoutFailed": "Platba se nezdařila: {msg}",
  "billing.unknownError": "neznámá chyba",
};

export default cs;
