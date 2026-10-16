import type { PartialCatalog } from "./en";

/** Polski — base catalog. */
const pl: PartialCatalog = {
  // Shared chrome
  "nav.pricing": "Cennik",
  "nav.blog": "Blog",
  "nav.docs": "Dokumentacja",
  "nav.sponsors": "Sponsorzy",
  "nav.login": "Zaloguj się",
  "nav.signup": "Zarejestruj się za darmo",
  "nav.dashboard": "Panel",
  "nav.logout": "Wyloguj się",
  "nav.openMenu": "Otwórz menu",
  "nav.closeMenu": "Zamknij menu",
  "nav.projects": "Projekty",
  "nav.apiKeys": "Klucze API",
  "nav.billing": "Płatności",

  "footer.madeBy": "Stworzone przez Enrique Magallón",
  "footer.source": "Kod źródłowy",
  "footer.appsIndex": "Więcej aplikacji",
  "footer.openSource": "Open source · MIT",

  "ui.theme": "Motyw",
  "ui.themeLight": "Przełącz na jasny motyw",
  "ui.themeDark": "Przełącz na ciemny motyw",
  "ui.language": "Język",
  "ui.search": "Szukaj",
  "ui.close": "Zamknij",

  // Project tabs (components/project-nav.tsx)
  "pnav.back": "← Wszystkie projekty",
  "pnav.overview": "Przegląd",
  "pnav.events": "Zdarzenia",
  "pnav.settings": "Ustawienia",
  "pnav.openSite": "Otwórz stronę",
  "pnav.paused": "Wstrzymane",
  "pnav.live": "Na żywo",
  "pnav.liveHint": "Odebrano hit w ciągu ostatnich 5 minut",

  // Plan/limit formatters (src/lib/plans.ts)
  "plans.unlimited": "Bez limitu",
  "plans.custom": "Indywidualnie",
  "plans.days": "{n} dni",
  "plans.year": "{n} rok",
  "plans.years": "{n} lata",

  // Landing — hero
  "landing.badge": "Open source · MIT · Self-hosting · Bez ciasteczek",
  "landing.heroTitle": "Wiedz, kto odwiedza Twoje aplikacje,",
  "landing.heroTitleAccent": "nie śledząc nikogo",
  "landing.heroBody":
    "oops liczy odsłony i odwiedzających dla każdego zarejestrowanego projektu: najpopularniejsze strony, źródła odesłań, kraje i miasta, urządzenia, przeglądarki i własne zdarzenia — z jednego tagu script, piksela albo wywołania API. Bez ciasteczek, bez zapisywania adresów IP, bez niczego, co trzeba by umieścić w banerze zgody.",
  "landing.getStarted": "Zacznij za darmo",
  "landing.whyFree": "Dlaczego teraz jest za darmo",
  "landing.seePricing": "Zobacz cennik",
  "landing.readDocs": "Przeczytaj dokumentację",
  "landing.earlyNote":
    "Wczesny dostęp: każde konto ma pełny dostęp, za darmo. Plany pojawią się później, z wyprzedzeniem.",
  "landing.freeNote": "Darmowy plan: {projects} projektów i {events} zdarzeń / miesiąc. Bez karty.",

  // Landing — three paths
  "landing.pathsTitle": "Trzy sposoby liczenia",
  "landing.pathsBody":
    "Wybierz ten, który pasuje do danej aplikacji. Wszystkie trafiają do tego samego panelu.",
  "landing.pathScriptTitle": "Jeden tag script",
  "landing.pathScriptBody":
    "Poniżej 3 KB, bez zależności. Liczy każdą odsłonę, śledzi zmiany tras w aplikacjach SPA i udostępnia oops.track() dla własnych zdarzeń. Działa tak samo w Qwik, Astro, React, stronach z jQuery i grach Phaser.",
  "landing.pathPixelTitle": "Piksel śledzący",
  "landing.pathPixelBody":
    "Obrazek 1×1 dla miejsc, gdzie JavaScript nie może działać: e-maile, pliki README, dokumentacja hostowana gdzie indziej. URL mówi, którą stronę lub zdarzenie reprezentuje.",
  "landing.pathApiTitle": "Collect API",
  "landing.pathApiBody":
    "Jeden POST z publicznym kluczem projektu — z backendu, CLI, serwera gry albo zadania cron. Idealne dla aplikacji bez DOM.",

  // Landing — how it works
  "landing.howTitle": "Jak to działa",
  "landing.step1Title": "1. Utwórz projekt",
  "landing.step1Body":
    "Jeden projekt na stronę lub aplikację. Dostajesz publiczny klucz do skryptu, piksela i API, i wybierasz strefę czasową.",
  "landing.step2Title": "2. Wklej snippet",
  "landing.step2Body":
    "Skopiuj go z ustawień projektu do swojego layoutu. Pierwsze odsłony pojawią się w ciągu kilku sekund.",
  "landing.step3Title": "3. Czytaj panel",
  "landing.step3Body":
    "Wybierz zakres, kliknij dowolną stronę, kraj lub urządzenie, aby filtrować według niego wszystko, obserwuj licznik na żywo albo pozwól agentowi AI czytać liczby przez MCP.",

  // Landing — what you see
  "landing.seeTitle": "Wszystko, co chcesz wiedzieć, i nic ponadto",
  "landing.seeBody":
    "Panel odpowiada na pytania, które ludzie naprawdę zadają o stronie — i na tym poprzestaje.",
  "landing.seeWhereTitle": "Skąd.",
  "landing.seeWhereBody":
    "Źródła odesłań, UTM source / medium / campaign, kraje, regiony i miasta.",
  "landing.seeWhoTitle": "Na czym.",
  "landing.seeWhoBody":
    "Komputer, telefon czy tablet; przeglądarka i system operacyjny; rozmiar ekranu i język.",
  "landing.seeWhatTitle": "Co robią.",
  "landing.seeWhatBody":
    "Najpopularniejsze strony, ścieżki wejścia i własne zdarzenia, które wysyłasz (rejestracje, zakupy, kliknięcia) wraz z ich właściwościami.",
  "landing.seeLiveTitle": "Teraz.",
  "landing.seeLiveBody": "Odwiedzający z ostatnich pięciu minut i strony, na których są.",

  // Landing — privacy
  "landing.privacyTitle": "Przyjazne prywatności z założenia",
  "landing.privacyBody":
    "Tracker nie ustawia ciasteczek i nic nie zapisuje w przeglądarce. Serwer haszuje adres IP każdego odwiedzającego z solą zmienianą codziennie, zachowuje tylko wyprowadzony kraj, region i miasto, a user agent odrzuca, gdy tylko pozna urządzenie, przeglądarkę i system.",
  "landing.privacy1":
    "Bez ciasteczek, bez localStorage, bez fingerprintingu między stronami i dniami",
  "landing.privacy2": "Surowe adresy IP nigdy nie są przechowywane — tylko dzienny solony hasz",
  "landing.privacy3":
    "Query stringi są usuwane z adresów stron (poza tagami UTM), więc tokeny i e-maile nigdy nie trafiają do panelu",
  "landing.privacy4": "Opcjonalna obsługa Do Not Track, a boty są odfiltrowywane",
  "landing.apiNote": "Klucze publiczne mogą tylko wysyłać hity. Nigdy nie mogą niczego odczytać.",
  "landing.panelRequest": "Żądanie",
  "landing.panelResponse": "Odpowiedź",

  // Landing — MCP section
  "landing.mcpBadge": "Model Context Protocol",
  "landing.mcpTitle": "Zapytaj swojego agenta AI, jak radzi sobie strona",
  "landing.mcpIntro":
    "oops ma wbudowany serwer MCP. Podłącz go do Claude Code, Claude Desktop, Cursor lub dowolnego hosta MCP i pytaj na przykład",
  "landing.mcpExample1": "„jak zmienił się ruch w dokumentacji w tym tygodniu?”",
  "landing.mcpOr": "albo",
  "landing.mcpExample2": "„które kraje najczęściej odwiedzają stronę z cennikiem?”",
  "landing.mcpBullet1Title": "Klucze z rolami.",
  "landing.mcpBullet1Body":
    "Klucz z rolą viewer nawet nie widzi narzędzi do usuwania; editor i admin odblokowują więcej. Egzekwowane także przez API.",
  "landing.mcpBullet2Title": "Człowiek w pętli.",
  "landing.mcpBullet2Body":
    "Działania destrukcyjne (usunięcie projektu, wyczyszczenie jego zdarzeń) proszą o potwierdzenie, zanim cokolwiek się wydarzy.",
  "landing.mcpBullet3Title": "Ślad audytu.",
  "landing.mcpBullet3Body":
    "Każda zmiana i każde odrzucone wywołanie są logowane — po stronie serwera i agenta.",
  "landing.mcpBullet4Title": "Lokalnie lub zdalnie.",
  "landing.mcpBullet4Body1": "Uruchom go przez stdio za pomocą",
  "landing.mcpBullet4Npm": "npm",
  "landing.mcpBullet4Body2": "albo skieruj swojego hosta na",
  "landing.mcpBullet4Body3": "ze swoim kluczem.",
  "landing.mcpPanelLocal": "Claude Code · lokalnie (npm)",
  "landing.mcpPanelRemote": "Claude Code · zdalnie (nic do instalowania)",
  "landing.mcpPanelJson": "Dowolny host MCP (JSON)",
  "landing.mcpKeyNote": "Utwórz klucz z wybraną rolą w sekcji",
  "landing.mcpKeyLink": "Panel → Klucze API",

  // Landing — self-host callout + closing CTA
  "landing.selfhostTitle": "Hostuj samodzielnie (MIT, open source)",
  "landing.selfhostBody1":
    "Cały stos — API we Flasku, tracker, serwer MCP i ta aplikacja Qwik — jest na licencji MIT. Uruchom go na własnym VPS jednym",
  "landing.selfhostBody2": ". Bez kodu płatności, bez limitów poza tymi, które sam skonfigurujesz.",
  "landing.viewGithub": "Zobacz na GitHub",
  "landing.ctaTitle": "Zobacz pierwszego odwiedzającego w minutę",
  "landing.ctaBody": "Utwórz projekt, wklej jeden tag script i patrz, jak licznik na żywo rusza.",

  // Blog (chrome only)
  "blog.title": "Blog",
  "blog.intro": "Aktualności produktowe, notatki inżynierskie i porady o czytaniu swoich liczb.",
  "blog.comingSoon": "Wkrótce.",
  "blog.readMore": "Czytaj dalej →",
  "blog.allPosts": "← Wszystkie wpisy",
  "blog.notFoundTitle": "Nie znaleziono wpisu",
  "blog.notFoundBody": "Nie ma wpisu pod adresem",
  "blog.backToBlog": "Wróć do bloga",
  "blog.seeTiers": "Zobacz planowane plany",

  // Info index
  "info.title": "Informacje",
  "info.intro": "Strony referencyjne oops. Z czasem pojawi się ich więcej.",
  "info.pricingTitle": "Cennik",
  "info.pricingBody": "Plany, limity i ceny.",
  "info.plannedPricingTitle": "Planowany cennik",
  "info.plannedPricingBody": "Plany, które zamierzamy wprowadzić po wczesnym dostępie.",
  "info.docsTitle": "Dokumentacja",
  "info.docsBody":
    "Instrukcja instalacji trackera, piksel, collect API, dokumentacja stats API i konfiguracja MCP.",
  "info.termsTitle": "Regulamin",
  "info.termsBody": "Warunki korzystania z usługi (wkrótce).",
  "info.privacyTitle": "Prywatność",
  "info.privacyBody": "Co przechowujemy, a czego nigdy nie przechowujemy (wkrótce).",
  "info.comingSoon": "Ta strona pojawi się wkrótce.",
  "info.backToInfo": "Wróć do informacji",

  // Pricing page
  "pricing.title": "Prosty, uczciwy cennik",
  "pricing.titlePlanned": "Planowany cennik",
  "pricing.intro":
    "Zacznij za darmo. Przejdź wyżej, gdy potrzebujesz więcej projektów, więcej zdarzeń miesięcznie lub dłuższej retencji. Hostuj samodzielnie, by nie mieć żadnych limitów.",
  "pricing.introPlanned":
    "To plany, które zamierzamy wprowadzić po wczesnym dostępie. Nic z tego jeszcze nie obowiązuje.",
  "pricing.earlyTitle": "Obecnie każde konto ma pełny dostęp, za darmo.",
  "pricing.earlyBody":
    "Nielimitowane projekty, zdarzenia i retencja, API i serwer MCP. Gdy pojawią się plany, ogłosimy to na blogu i mailowo, zanim jakikolwiek limit obejmie istniejące konto. Ceny i limity poniżej mogą się jeszcze zmienić.",
  "pricing.earlyCta": "Przeczytaj, co będą zawierać płatne plany",
  "pricing.enterpriseTitle": "Potrzebujesz własnych limitów, SSO lub SLA?",
  "pricing.enterpriseBody": "Plany Enterprise dopasowujemy do Twojego zespołu.",
  "pricing.contactUs": "Skontaktuj się z nami",
  "pricing.footnote":
    "Wszystkie ceny w USD. Rozliczenie roczne to ok. 20% oszczędności. Liczby projektów i kluczy to twarde limity; zdarzenia ponad miesięczny budżet są liczone, ale nie zapisywane, a Twoja strona nigdy nie zobaczy błędu. Zdarzenia starsze niż okno retencji są usuwane.",
  "pricing.footnoteEarly": "Nic z tego nie obowiązuje podczas wczesnego dostępu.",

  // Pricing table (plan labels come from packages/shared/plan_limits.json)
  "pricing.mostPopular": "Najpopularniejszy",
  "pricing.perMonth": "/mies.",
  "pricing.perYear": "/rok",
  "pricing.projects": "projektów",
  "pricing.eventsPerMonth": "zdarzeń / mies.",
  "pricing.retention": "Retencja danych: {value}",
  "pricing.apiKeys": "kluczy API",
  "pricing.auditRetention": "Retencja audytu: {value}",
  "pricing.user": "użytkownik",
  "pricing.users": "użytkowników",
  "pricing.api": "API: {api}",
  "pricing.sponsorsBadge": "Odznaka /sponsors",
  "pricing.teamExtras": "Role + priorytetowe wsparcie",
  "pricing.enterpriseExtras": "SSO, SLA, własne limity",
  "pricing.getStarted": "Zacznij",
  "pricing.startPlan": "Wybierz {plan}",

  // Docs
  "docs.title": "Dokumentacja",
  "docs.intro":
    "Jak umieścić oops w aplikacji, wysyłać hity skądkolwiek i czytać liczby przez REST API lub agenta AI. Pełny kontrakt — każdy endpoint, obiekt i błąd — znajduje się w repozytorium.",
  "docs.fullContract": "Przeczytaj pełny kontrakt (CONTRACT.md)",
  "docs.baseUrl": "Bazowy URL",
  "docs.trackerTitle": "Skrypt trackera",
  "docs.trackerBody":
    "Skrypt bez zależności, poniżej 3 KB, serwowany z tego hosta. Dodaj go raz w layoucie; wysyła jeden hit na odsłonę i na zmianę trasy w aplikacji SPA, bez ciasteczek i bez zapisywania czegokolwiek w przeglądarce.",
  "docs.trackerAttrsTitle": "Atrybuty (pokazano wartości domyślne)",
  "docs.attrKey": "publiczny klucz projektu (wymagany).",
  "docs.attrSpa":
    "podpina History API i wysyła odsłonę przy każdej zmianie trasy. Ustaw false, by samodzielnie wywoływać oops.pageview().",
  "docs.attrHash": "routing z hashem: zachowuje #fragment w URL i nasłuchuje hashchange.",
  "docs.attrDnt": "respektuje sygnał Do Not Track przeglądarki.",
  "docs.attrLocal":
    "śledzi także na localhost, surowych IP, file: i *.local (domyślnie ignorowane).",
  "docs.attrApi": "nadpisuje endpoint collect (instancje self-hosted za innym hostem).",
  "docs.trackerJsTitle": "JavaScript API",
  "docs.trackerJsBody":
    "window.oops udostępnia track(name, props) dla własnych zdarzeń i pageview() dla ręcznych odsłon. Wywołania zakolejkowane przed załadowaniem skryptu są odtwarzane.",
  "docs.trackerDeclarative":
    "Kliknięcia w elementy z data-oops-event są śledzone automatycznie, z opcjonalnymi właściwościami JSON:",
  "docs.trackerWhat":
    "Co jest wysyłane: URL strony bez query stringa (tagi UTM są odczytywane, a potem odrzucane), referrer, tytuł, rozmiar ekranu i język przeglądarki. Urządzenie, przeglądarka, system i lokalizacja są wyprowadzane na serwerze z żądania i nigdy nie są przechowywane w surowej postaci.",
  "docs.pixelTitle": "Piksel śledzący",
  "docs.pixelBody":
    "Dla miejsc, gdzie nie działa JavaScript — newslettery, pliki README, dokumentacja na innym hoście. Obrazek to przezroczysty GIF o rozmiarze 43 bajtów, nigdy nie cache'owany. Przekaż stronę jako u i opcjonalnie nazwę zdarzenia jako n.",
  "docs.collectTitle": "Collect API",
  "docs.collectBody":
    "POST /api/collect z publicznym kluczem projektu w nagłówku X-Project-Key (lub w polu k). Akceptowane są ciała JSON, form-encoded i text/plain, CORS jest otwarty, a odpowiedź to zawsze 202, więc śledzona strona nigdy nie zobaczy błędu.",
  "docs.collectField1":
    "n: nazwa zdarzenia (domyślnie pageview). 1-60 liter, cyfr, spacji, _ . : / lub -.",
  "docs.collectField2":
    "u: URL lub ścieżka strony (wymagane dla czegokolwiek sensownego). Query stringi są odczytywane tylko pod kątem tagów UTM.",
  "docs.collectField3":
    "r: URL referrera; t: tytuł strony (≤ 200); l: język (≤ 16); w / h: rozmiar ekranu.",
  "docs.collectField4": "p: obiekt JSON z właściwościami dla własnych zdarzeń (≤ 2 KB).",
  "docs.collectField5":
    "s: źródło — script (domyślnie), pixel lub api. Urządzenie, przeglądarka, system i lokalizacja pochodzą z nagłówków i adresu samego żądania.",
  "docs.collectResponses":
    "Ciało odpowiedzi mówi, co się stało: { ok: true } po zapisaniu albo { ok: false, reason } z reason = paused (śledzenie wyłączone dla projektu), origin (host spoza listy dozwolonych), bot (crawler lub przeglądarka headless) lub limit (ponad miesięczny budżet — policzone, nie zapisane).",
  "docs.authTitle": "Uwierzytelnianie",
  "docs.authBody": "Trzy rodzaje poświadczeń, każdy do jednego zadania:",
  "docs.authDashboard":
    "Sesje panelu: tokeny JWT bearer wydawane przez /auth/login. Mają wszystkie uprawnienia.",
  "docs.authApiKey":
    "API zarządzania: klucze API z rolą (viewer / editor / admin). Nagłówek X-API-Key: oops_live_… (lub Authorization: Bearer).",
  "docs.authPublicKey":
    "Collect API, tracker i piksel: publiczne klucze projektu. Nagłówek X-Project-Key: oops_pub_… (lub pole k). Identyfikują jeden projekt i mogą tylko wysyłać hity.",
  "docs.projectsTitle": "Projekty",
  "docs.projectsBody":
    "Projekt to jedna strona lub aplikacja. Posiada klucz publiczny, strefę czasową (używaną do podziału na dni), opcjonalną listę dozwolonych hostów oraz przełączniki zbierania i botów.",
  "docs.statsTitle": "Statystyki",
  "docs.statsBody":
    "Zakresy to lokalne daty (włącznie) w strefie z parametru tz (domyślnie: strefa projektu), jako period=today|yesterday|7d|30d|90d|12mo lub from/to. Każdy wymiar może być przekazany jako filtr (np. country=ES&device=mobile) i wszystko w odpowiedzi jest do niego zawężone. Odwiedzający są liczeni dziennym haszem, więc w okresie kilku dni to suma dziennych unikalnych odwiedzających.",
  "docs.dimensionsTitle": "Wymiary",
  "docs.dimensionsBody":
    "Do użycia jako podział (by=) i jako filtry na każdym endpointcie statystyk i zdarzeń. referrer=(direct) wybiera hity bez referrera.",
  "docs.errorsTitle": "Błędy i limity",
  "docs.errorsBody":
    "Błędy to JSON: { \"error\": { \"code\", \"message\" } }. Tworzenie ponad limit planu odpowiada 402 limit_reached z error.which = projects | api_keys. Hity ponad miesięczny budżet zdarzeń są przyjmowane (202), ale nie zapisywane.",
  "docs.privacyBody":
    "Prywatność: oops nigdy nie przechowuje surowych adresów IP ani user agentów — tylko solony dzienny hasz i wyprowadzone pola urządzenie / przeglądarka / system / lokalizacja. Adresy stron tracą query string przed zapisem.",
  "docs.mcpTitle": "MCP (agenci AI)",
  "docs.mcpBody":
    "Serwer MCP udostępnia API zarządzania jako narzędzia, filtrowane według roli klucza, którym się łączysz. Narzędzia destrukcyjne proszą o potwierdzenie. Prompt weekly_report prowadzi model przez liczby projektu.",
  "docs.mcpLocal": "Lokalnie (stdio, npm)",
  "docs.mcpRemote": "Zdalnie (Streamable HTTP)",
  "docs.mcpTools":
    "Narzędzia: list_projects, get_project, create_project, update_project, rotate_project_key, delete_project, project_summary, get_stats, get_breakdown, list_events, get_live, purge_events, get_usage, get_audit_log.",
  "docs.colMethod": "Metoda",
  "docs.colPath": "Ścieżka",
  "docs.colScope": "Uprawnienie",
  "docs.colNotes": "Uwagi",

  // Sponsors
  "sponsors.title": "Sponsorzy",
  "sponsors.intro1": "oops to open source (MIT). Każdy subskrybent",
  "sponsors.introLink": "Pro / Supporter",
  "sponsors.intro2":
    "pomaga utrzymać darmowy self-hosting — i dostaje odznakę oraz miejsce na tej stronie.",
  "sponsors.intro2Early":
    "będzie pomagać utrzymać darmowy self-hosting — i dostanie odznakę oraz miejsce na tej stronie.",
  "sponsors.emptyTitle": "Twoje imię może być pierwsze na tej stronie.",
  "sponsors.emptyBody":
    "Każdy subskrybent Pro / Supporter dostaje tu miejsce i odznakę do osadzenia.",
  "sponsors.emptyBodyEarly":
    "Subskrypcje Supporter ruszą razem z płatnymi planami, po wczesnym dostępie. Do tego czasu każde konto jest darmowe.",
  "sponsors.tierSupporter": "Wspierający {tier}",
  "sponsors.badgeTitle": "Odznaka wspierającego",
  "sponsors.badgeBody": "Wspierający Pro dostają odznakę do osadzenia na stronie lub w README:",
  "sponsors.badgeBodyEarly":
    "Wspierający Pro dostaną odznakę do osadzenia na stronie lub w README:",
  "sponsors.badgeLabel": "oops Supporter",
  "sponsors.readPlans": "Przeczytaj o nadchodzących planach",
  "sponsors.become": "Zostań wspierającym",

  // Early-access banner
  "early.bannerTitle": "Wczesny dostęp.",
  "early.bannerText":
    "Każde konto ma teraz pełny dostęp bez opłat. Plany i limity wprowadzimy później, z wyprzedzeniem, zanim cokolwiek się zmieni.",
  "early.bannerLink": "Co będą zawierać płatne plany",

  // Site-building curtain
  "building.title": "Budujemy oops",
  "building.body":
    "Przyjazna prywatności analityka dla Twoich aplikacji. Strona nie jest jeszcze otwarta — ale tracker, collect API i serwer MCP odpowiadają bez problemu.",
  "building.footer": "oops.3m4.net · wkrótce",

  // Shared
  "common.loading": "Ładowanie…",
  "common.copy": "Kopiuj",
  "common.copied": "Skopiowano!",
  "common.creating": "Tworzenie…",
  "common.saving": "Zapisywanie…",
  "common.save": "Zapisz",
  "common.saved": "Zapisano.",
  "common.cancel": "Anuluj",
  "common.close": "Zamknij",
  "common.delete": "Usuń",
  "common.deleting": "Usuwanie…",
  "common.optional": "(opcjonalnie)",
  "common.email": "E-mail",
  "common.password": "Hasło",
  "common.created": "Utworzono",
  "common.role": "Rola",
  "common.name": "Nazwa",
  "common.key": "Klucz",
  "common.description": "Opis",
  "common.search": "Szukaj",
  "common.retry": "Spróbuj ponownie",
  "common.dismiss": "Zamknij",
  "common.pageOf": "Strona {page} z {pages} · {total} wierszy",

  // Enum labels
  "period.today": "Dziś",
  "period.yesterday": "Wczoraj",
  "period.7d": "7 dni",
  "period.30d": "30 dni",
  "period.90d": "90 dni",
  "period.12mo": "12 miesięcy",
  "interval.hour": "co godzinę",
  "interval.day": "co dzień",
  "interval.month": "co miesiąc",
  "metric.pageviews": "Odsłony",
  "metric.visitors": "Odwiedzający",
  "metric.events": "Zdarzenia",
  "dim.path": "Strony",
  "dim.hostname": "Host",
  "dim.referrer": "Źródła odesłań",
  "dim.direct": "Bezpośrednio / brak",
  "dim.country": "Kraje",
  "dim.region": "Regiony",
  "dim.city": "Miasta",
  "dim.device": "Urządzenia",
  "dim.browser": "Przeglądarki",
  "dim.os": "Systemy operacyjne",
  "dim.lang": "Języki",
  "dim.utm_source": "Źródła UTM",
  "dim.utm_medium": "Media UTM",
  "dim.utm_campaign": "Kampanie UTM",
  "dim.name": "Własne zdarzenia",
  "dim.ip": "Adresy IP",
  "device.desktop": "Komputer",
  "device.mobile": "Telefon",
  "device.tablet": "Tablet",
  "device.bot": "Bot",

  // Auth: login
  "auth.loginTitle": "Zaloguj się",
  "auth.loginSubtitle": "Witaj ponownie w oops.",
  "auth.loginFailed": "Logowanie nie powiodło się. Sprawdź e-mail i hasło.",
  "auth.loggingIn": "Logowanie…",
  "auth.noAccount": "Nie masz konta?",
  "auth.signUp": "Zarejestruj się",

  // Auth: signup
  "auth.signupTitle": "Utwórz konto",
  "auth.signupFailed": "Rejestracja nie powiodła się. Spróbuj ponownie.",
  "auth.inviteOnlyTitle": "🔒 Rejestracja jest obecnie tylko na zaproszenie",
  "auth.inviteOnlyBody": "Wdrażamy stopniowo. Bądź na bieżąco — miejsca otworzą się wkrótce.",
  "auth.haveAccount": "Masz już konto?",
  "auth.logIn": "Zaloguj się",
  "auth.earlyAccessPitch": "Wczesny dostęp: pełny dostęp, za darmo. Bez karty.",
  "auth.freePitch": "Za darmo na zawsze: {projects} projektów i {events} zdarzeń / miesiąc.",
  "auth.workspaceName": "Nazwa przestrzeni roboczej",
  "auth.workspacePlaceholder": "Acme Sp. z o.o.",
  "auth.passwordHint": "Co najmniej 8 znaków.",
  "auth.creatingAccount": "Tworzenie konta…",
  "auth.createAccount": "Utwórz konto",

  // 402 limit_reached, per `error.which`
  "limit.projects": "Osiągnięto limit projektów w Twoim planie.",
  "limit.api_keys": "Osiągnięto limit kluczy API w Twoim planie.",
  "limit.generic": "Osiągnięto limit Twojego planu.",
  "limit.upgrade": "Ulepsz swój plan",

  // Dashboard: projects
  "dash.title": "Projekty",
  "dash.earlyAccess": "Wczesny dostęp",
  "dash.planSuffix": "plan",
  "dash.upgradePlan": "Ulepsz plan",
  "dash.loadFailed": "Nie udało się załadować panelu.",
  "dash.createFailed": "Nie udało się utworzyć projektu.",
  "dash.usageProjects": "Projekty",
  "dash.usageEvents": "Zdarzenia w tym okresie",
  "dash.usageEventsHint": "Odsłony + własne zdarzenia odebrane w tym miesiącu kalendarzowym.",
  "dash.eventsOverage": "Ponad miesięczny budżet: {n} zdarzeń policzono, ale nie zapisano.",
  "dash.newProject": "Nowy projekt",
  "dash.projectName": "Nazwa projektu",
  "dash.projectNamePlaceholder": "Moja aplikacja",
  "dash.projectKey": "Klucz",
  "dash.projectKeyHint": "Małe litery, cyfry i myślniki. Domyślnie slug z nazwy.",
  "dash.projectKeyPlaceholder": "moja-aplikacja",
  "dash.projectUrl": "URL strony",
  "dash.timezone": "Strefa czasowa",
  "dash.timezoneHint": "Dni w panelu zaczynają się o północy w tej strefie.",
  "dash.createProject": "Utwórz projekt",
  "dash.searchPlaceholder": "Szukaj projektów…",
  "dash.empty":
    "Brak projektów. Utwórz jeden na stronę lub aplikację, aby dostać klucz publiczny i snippet instalacyjny.",
  "dash.noMatch": "Żaden projekt nie pasuje do wyszukiwania.",
  "dash.today": "dziś",
  "dash.views30d": "odsłon · 30 dni",
  "dash.visitors30d": "odwiedzających · 30 dni",
  "dash.lastSeen": "Ostatni hit {when}",
  "dash.noDataYet": "Brak danych",
  "dash.openProject": "Otwórz →",

  // Overview
  "overview.loadFailed": "Nie udało się załadować statystyk.",
  "overview.range": "Zakres dat",
  "overview.from": "Od",
  "overview.to": "Do",
  "overview.tzHint": "Strefa czasowa projektu; zmień ją w Ustawieniach.",
  "overview.liveNow": "{n} odwiedzających teraz",
  "overview.vsPrevious": "W porównaniu z poprzednim okresem tej samej długości",
  "overview.vsPreviousShort": "vs poprzedni",
  "overview.viewsPerVisitor": "Odsłon / odwiedzającego",
  "overview.viewAll": "Zobacz wszystko",
  "overview.noData": "Nic w tym zakresie.",
  "overview.noGeo": "Brak danych o lokalizacji. Wymaga bazy GeoLite2 na serwerze.",
  "overview.noUtm": "Brak wizyt z tagami UTM w tym zakresie.",
  "overview.noEvents": "Brak własnych zdarzeń. Wyślij jedno za pomocą oops.track().",
  "overview.emptyRange": "Brak hitów w tym zakresie.",
  "overview.emptyCta": "Otwórz instrukcję instalacji →",
  "overview.removeFilter": "Usuń ten filtr",
  "overview.clearFilters": "Wyczyść filtry",
  "overview.visitorsNote":
    "Odwiedzający są liczeni bezciasteczkowym dziennym haszem, więc w okresie kilku dni liczba to suma dziennych unikalnych odwiedzających.",

  // Events
  "events.loadFailed": "Nie udało się załadować zdarzeń.",
  "events.kind": "Rodzaj",
  "events.allKinds": "Odsłony + zdarzenia",
  "events.kindPageview": "Odsłona",
  "events.kindEvent": "Zdarzenie",
  "events.searchPlaceholder": "Szukaj ścieżki, tytułu lub zdarzenia…",
  "events.total": "{total} zdarzeń",
  "events.empty": "Brak zdarzeń w tym zakresie.",
  "events.colTime": "Kiedy",
  "events.colEvent": "Zdarzenie",
  "events.colLocation": "Lokalizacja",
  "events.colClient": "Urządzenie",
  "events.colVisitor": "Odwiedzający",
  "events.title": "Tytuł",
  "events.screen": "Ekran",
  "events.source": "Źródło",
  "events.props": "Właściwości",
  "events.privacyNote":
    "Kolumna odwiedzającego to dzienny hasz: grupuje hity jednej osoby w ciągu dnia i nic więcej.",

  // Project settings
  "psettings.loadFailed": "Nie udało się załadować ustawień projektu.",
  "psettings.saveFailed": "Nie udało się zapisać projektu.",
  "psettings.rotateFailed": "Nie udało się zrotować klucza.",
  "psettings.purgeFailed": "Nie udało się wyczyścić zdarzeń.",
  "psettings.installTitle": "Instalacja",
  "psettings.installBody":
    "Dodaj skrypt do layoutu, wstaw piksel tam, gdzie nie działa JavaScript, albo wysyłaj POST do collect API z backendu.",
  "psettings.publicKey": "Klucz publiczny",
  "psettings.publicKeyHint":
    "To nie sekret: jest w kodzie Twojej strony. Może tylko wysyłać hity. Zrotuj go, jeśli zostanie nadużyty, albo ogranicz go dozwolonymi hostami poniżej.",
  "psettings.rotate": "Zrotuj klucz",
  "psettings.rotateConfirm": "Rotuj teraz — stary klucz natychmiast przestanie działać",
  "psettings.snippetScript": "Tag script",
  "psettings.snippetPixel": "Piksel",
  "psettings.snippetEvents": "Własne zdarzenia",
  "psettings.snippetApi": "API",
  "psettings.snippetScriptHint":
    "Liczy każdą odsłonę i zmianę trasy w aplikacji SPA. Atrybuty i JavaScript API:",
  "psettings.snippetPixelHint":
    "Do e-maili i README. u to strona lub rzecz, którą chcesz liczyć; dodaj n=open dla nazwanego zdarzenia. Szczegóły:",
  "psettings.snippetEventsHint":
    "Do 2 KB właściwości JSON na zdarzenie. Pojawiają się w sekcji Własne zdarzenia i w logu zdarzeń. Szczegóły:",
  "psettings.snippetApiHint":
    "Z backendu, CLI lub zadania cron. Urządzenie i lokalizacja pochodzą z samego żądania. Szczegóły:",
  "psettings.trackingTitle": "Śledzenie",
  "psettings.trackingBody":
    "Co jest przyjmowane i jak liczone są dni. Zmiany obowiązują od następnego hitu.",
  "psettings.collectEnabled": "Zbieraj hity",
  "psettings.excludeBots": "Ignoruj boty i przeglądarki headless",
  "psettings.featureOff": "wyłączone globalnie",
  "psettings.storeIp": "Zapisuj adresy IP odwiedzających",
  "psettings.storeIpHint": "Wyłączone: przechowywany jest tylko dzienny hash i wyprowadzona lokalizacja. Włączone: prawdziwy adres jest zapisywany z każdym trafieniem i widoczny w dzienniku zdarzeń oraz jako zestawienie.",
  "psettings.geoOff":
    "Wyszukiwanie lokalizacji jest obecnie wyłączone globalnie; nowe hity są zapisywane bez kraju i miasta.",
  "psettings.allowedOrigins": "Dozwolone hosty",
  "psettings.allowedOriginsHint":
    "Jeden na linię, np. myapp.example.com lub *.example.com. Pusto = dowolny host. Hity z innych hostów są odrzucane.",
  "psettings.infoTitle": "Projekt",
  "psettings.dangerTitle": "Strefa niebezpieczna",
  "psettings.purgeTitle": "Wyczyść zdarzenia",
  "psettings.purgeBody":
    "Usuwa każde zapisane zdarzenie tego projektu. Projekt i jego klucz zostają.",
  "psettings.purged": "Usunięto {n} zdarzeń.",
  "psettings.purge": "Wyczyść wszystkie zdarzenia",
  "psettings.purgeConfirm": "Tak, usuń każde zdarzenie",
  "psettings.dangerBody":
    "Usunięcie projektu kasuje go wraz ze wszystkimi zdarzeniami. Tej operacji nie można cofnąć.",
  "psettings.deleteProject": "Usuń projekt",
  "psettings.deleteProjectConfirm": "Wpisz klucz projektu, aby potwierdzić",
  "psettings.deleteProjectFailed": "Nie udało się usunąć projektu.",

  // API keys
  "keys.title": "Klucze API",
  "keys.unavailableTitle": "API zarządzania nie jest jeszcze dostępne.",
  "keys.unavailableBody": "Wdrażamy je stopniowo — zajrzyj wkrótce.",
  "keys.usage": "Używaj kluczy z API zarządzania i serwerem MCP:",
  "keys.loadFailed": "Nie udało się załadować kluczy API.",
  "keys.createFailed": "Nie udało się utworzyć klucza.",
  "keys.revokeFailed": "Nie udało się unieważnić klucza.",
  "keys.copyNow": "Skopiuj nowy klucz teraz — nie zostanie pokazany ponownie.",
  "keys.newKeyName": "Nazwa nowego klucza",
  "keys.namePlaceholder": "Claude Code",
  "keys.createKey": "Utwórz klucz",
  "keys.empty": "Brak kluczy API.",
  "keys.colPrefix": "Prefiks",
  "keys.colLastUsed": "Ostatnio użyty",
  "keys.never": "Nigdy",
  "keys.revoke": "Unieważnij",
  "keys.revokeConfirm":
    "Unieważnić ten klucz? Wszystko, co go używa, natychmiast przestanie działać.",

  // Audit log
  "audit.title": "Dziennik audytu",
  "audit.intro": "Każda zmiana i każde odrzucone wywołanie na tym koncie, od najnowszych.",
  "audit.loadFailed": "Nie udało się załadować dziennika audytu.",
  "audit.empty": "Brak zdarzeń.",
  "audit.colTime": "Kiedy",
  "audit.colActor": "Aktor",
  "audit.colAction": "Akcja",
  "audit.colTarget": "Cel",
  "audit.colOutcome": "Wynik",
  "audit.filterAction": "Filtruj według akcji",
  "audit.allActions": "Wszystkie akcje",
  "audit.outcomeOk": "ok",
  "audit.outcomeDenied": "odrzucone",
  "audit.outcomeError": "błąd",
  "audit.system": "system",

  // Billing
  "billing.title": "Płatności",
  "billing.selfHostTitle": "To jest instancja self-hosted.",
  "billing.selfHostDisabled": "Płatności są wyłączone",
  "billing.selfHostLimits":
    "Wszystkie limity pochodzą z Twojej konfiguracji — nie ma planów do kupienia.",
  "billing.earlyTitle": "Masz wczesny dostęp: wszystko jest w cenie, za darmo.",
  "billing.earlyBody":
    "Nie ma jeszcze nic do kupienia. Plany i limity wprowadzimy później, a Ty dowiesz się o tym, zanim cokolwiek się zmieni.",
  "billing.earlyLink": "Co będą zawierać płatne plany",
  "billing.unavailableTitle": "Płatne plany nie są jeszcze dostępne.",
  "billing.unavailableBody":
    "Płatności wdrażamy stopniowo. Zachowujesz wszystko ze swojego obecnego planu — zajrzyj wkrótce.",
  "billing.upgradeTitle": "Ulepsz swój plan",
  "billing.onPlanPrefix": "Korzystasz z planu",
  "billing.onPlanSuffix":
    "— odblokuj więcej projektów, więcej zdarzeń miesięcznie i dłuższą retencję.",
  "billing.monthly": "Miesięcznie",
  "billing.annual": "Rocznie",
  "billing.annualSave": "(oszczędzasz ok. 20%)",
  "billing.perYear": "rok",
  "billing.perMonth": "mies.",
  "billing.featProjects": "{n} projektów",
  "billing.featEvents": "{n} zdarzeń / mies.",
  "billing.featDataRetention": "Retencja danych: {n}",
  "billing.featKeys": "{n} kluczy API",
  "billing.featRetention": "Retencja audytu: {n}",
  "billing.featUsers": "{n} użytkowników",
  "billing.currentPlan": "Obecny plan",
  "billing.processing": "Przetwarzanie…",
  "billing.upgradeTo": "Przejdź na {plan}",
  "billing.processedBy": "Płatności obsługuje RevenueCat (Stripe).",
  "billing.entitlementsPrefix": "Uprawnienia",
  "billing.entitlementsSuffix": "są automatycznie mapowane na Twój plan.",
  "billing.notConfigured":
    "Płatności nie są jeszcze skonfigurowane (brak VITE_REVENUECAT_PUBLIC_KEY). Dodaj publiczny klucz RevenueCat Web Billing do .env i przebuduj obraz web.",
  "billing.signInAgain": "Zaloguj się ponownie, aby ulepszyć plan.",
  "billing.openingCheckout": "Otwieranie bezpiecznej płatności…",
  "billing.activating": "Płatność zakończona — aktywujemy Twój plan…",
  "billing.nowOnPlan": "Masz teraz plan {plan}! 🎉",
  "billing.willUpdate": "Płatność otrzymana — Twój plan zaraz się zaktualizuje.",
  "billing.cancelled": "Płatność anulowana.",
  "billing.checkoutFailed": "Płatność nie powiodła się: {msg}",
  "billing.unknownError": "nieznany błąd",
};

export default pl;
