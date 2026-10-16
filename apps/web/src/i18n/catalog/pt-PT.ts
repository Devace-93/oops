import type { PartialCatalog } from "./en";

/** Português (Portugal) — overrides vs the Brazilian base. */
const ptPT: PartialCatalog = {
  "nav.login": "Iniciar sessão",
  "nav.signup": "Registe-se grátis",
  "nav.logout": "Terminar sessão",
  "nav.billing": "Faturação",
  "ui.search": "Pesquisar",

  "landing.heroTitle": "Saiba quem visita as suas apps,",
  "landing.heroBody":
    "O oops conta visualizações de página e visitantes de cada projeto que regista: páginas mais vistas, referenciadores, países e cidades, dispositivos, navegadores e eventos personalizados — a partir de uma única tag script, um pixel ou uma chamada de API. Sem cookies, sem endereços IP armazenados, nada para colocar num banner de consentimento.",
  "landing.pathPixelBody":
    "Uma imagem 1×1 para sítios onde o JavaScript não pode correr: e-mails, READMEs, documentação alojada noutro lado. O URL diz que página ou evento representa.",
  "landing.step1Body": "Um projeto por site ou app. Recebe uma chave pública para o script, o pixel e a API, e escolhe o fuso horário.",
  "landing.step2Body": "Copie-o das definições do projeto para o seu layout. As primeiras visualizações aparecem em segundos.",
  "landing.seeTitle": "Tudo o que quer saber, nada do que não quer",
  "landing.seeWhoBody": "Desktop, telemóvel ou tablet; navegador e sistema operativo; tamanho de ecrã e idioma.",
  "landing.seeWhatBody": "Páginas mais vistas, páginas de entrada e os eventos personalizados que envia (registos, compras, cliques) com as suas propriedades.",
  "landing.privacyBody":
    "O tracker não define nenhum cookie e não grava nada no navegador. O servidor faz o hash do endereço IP de cada visitante com um salt que muda todos os dias, guarda apenas o país, a região e a cidade derivados, e descarta o user agent assim que o dispositivo, o navegador e o SO são conhecidos.",
  "landing.panelRequest": "Pedido",
  "landing.mcpIntro": "O oops inclui um servidor MCP. Ligue-o ao Claude Code, Claude Desktop, Cursor ou a qualquer host MCP e pergunte coisas como",
  "landing.mcpBullet1Title": "Chaves restritas por função.",
  "landing.mcpBullet2Body": "As ações destrutivas (eliminar um projeto, limpar os seus eventos) pedem a sua confirmação antes de acontecer o que quer que seja.",
  "landing.mcpBullet3Title": "Registo de auditoria.",
  "landing.mcpBullet3Body": "Toda a alteração e toda a chamada recusada fica registada, no servidor e no agente.",
  "landing.mcpKeyNote": "Crie uma chave com a função que quiser em",
  "landing.selfhostBody1":
    "A stack inteira — API Flask, tracker, servidor MCP e esta app Qwik — tem licença MIT. Corra-a no seu próprio VPS com um único",
  "landing.selfhostBody2": ". Sem código de faturação, sem limites além dos que configurar.",
  "landing.ctaTitle": "Veja o seu primeiro visitante num minuto",
  "landing.ctaBody": "Crie um projeto, cole uma tag script e veja o contador ao vivo a mexer-se.",

  "blog.intro": "Novidades do produto, notas de engenharia e dicas para ler os seus números.",

  "pricing.intro":
    "Comece grátis. Faça upgrade quando precisar de mais projetos, mais eventos por mês ou retenção mais longa. Aloje você mesmo para ter tudo ilimitado.",
  "pricing.enterpriseBody": "Os planos Enterprise são feitos à medida da sua equipa.",
  "pricing.contactUs": "Contacte-nos",
  "pricing.footnote":
    "Todos os preços em USD. A faturação anual poupa ~20%. As quantidades de projetos e chaves são limites rígidos; eventos acima do orçamento mensal são contados mas não armazenados, e o seu site nunca vê um erro. Eventos mais antigos que a janela de retenção são apagados.",
  "pricing.user": "utilizador",
  "pricing.users": "utilizadores",
  "pricing.teamExtras": "Funções + suporte prioritário",

  "docs.intro":
    "Como colocar o oops na sua app, enviar hits de qualquer lado e ler os números pela API REST ou por um agente de IA. O contrato completo — cada endpoint, objeto e erro — vive no repositório.",
  "docs.attrSpa": "interceta a History API e envia uma visualização a cada mudança de rota. Defina false para chamar oops.pageview() por si.",
  "docs.trackerWhat":
    "O que é enviado: o URL da página sem a query string (as tags UTM são lidas e depois descartadas), o referenciador, o título, o tamanho do ecrã e o idioma do navegador. Dispositivo, navegador, SO e localização são derivados no servidor a partir do pedido e nunca armazenados em bruto.",
  "docs.pixelBody":
    "Para sítios onde não corre JavaScript — newsletters, ficheiros README, documentação noutro host. A imagem é um GIF transparente de 43 bytes, nunca em cache. Passe a página como u e, opcionalmente, um nome de evento como n.",
  "docs.collectField3": "r: URL do referenciador; t: título da página (≤ 200); l: idioma (≤ 16); w / h: tamanho do ecrã.",
  "docs.collectField5": "s: origem — script (padrão), pixel ou api. Dispositivo, navegador, SO e localização vêm dos headers e do endereço do próprio pedido.",
  "docs.authApiKey": "API de gestão: chaves de API com uma função (viewer / editor / admin). Header X-API-Key: oops_live_… (ou Authorization: Bearer).",
  "docs.projectsBody":
    "Um projeto é um site ou uma app. Tem uma chave pública, um fuso horário (usado para agrupar os dias), uma lista opcional de hostnames permitidos e os interruptores de recolha / bots.",
  "docs.mcpBody":
    "O servidor MCP expõe a API de gestão como ferramentas, filtradas pela função da chave com que se liga. Ferramentas destrutivas pedem confirmação. Um prompt weekly_report guia um modelo pelos números de um projeto.",
  "sponsors.become": "Torne-se supporter",

  "building.title": "Estamos a construir o oops",
  "building.body":
    "Analytics que respeitam a privacidade para as suas apps. O site ainda não está aberto, mas o tracker, a API de recolha e o servidor MCP continuam a responder normalmente.",

  "common.loading": "A carregar…",
  "common.creating": "A criar…",
  "common.saving": "A guardar…",
  "common.save": "Guardar",
  "common.saved": "Guardado.",
  "common.delete": "Eliminar",
  "common.deleting": "A eliminar…",
  "common.password": "Palavra-passe",
  "common.role": "Função",
  "common.search": "Pesquisar",
  "common.retry": "Tentar novamente",

  "dim.os": "Sistemas operativos",
  "device.mobile": "Telemóvel",

  "auth.loginTitle": "Iniciar sessão",
  "auth.loginFailed": "Falha ao iniciar sessão. Verifique o seu e-mail e palavra-passe.",
  "auth.loggingIn": "A iniciar sessão…",
  "auth.signUp": "Registe-se",
  "auth.signupTitle": "Crie a sua conta",
  "auth.signupFailed": "Falha no registo. Tente novamente.",
  "auth.inviteOnlyTitle": "🔒 De momento o registo é só por convite",
  "auth.inviteOnlyBody": "Estamos a abrir aos poucos. Fique atento: as vagas abrem em breve.",
  "auth.logIn": "Iniciar sessão",
  "auth.creatingAccount": "A criar conta…",

  "limit.projects": "Atingiu o limite de projetos do seu plano.",
  "limit.api_keys": "Atingiu o limite de chaves de API do seu plano.",
  "limit.generic": "Atingiu um limite do seu plano.",

  "dash.projectNamePlaceholder": "A minha app",
  "dash.projectKeyPlaceholder": "a-minha-app",
  "dash.searchPlaceholder": "Pesquisar projetos…",
  "dash.empty": "Nenhum projeto ainda. Crie um por site ou app para obter a sua chave pública e o snippet de instalação.",
  "dash.noMatch": "Nenhum projeto corresponde à sua pesquisa.",

  "overview.tzHint": "O fuso horário do projeto; altere-o nas Definições.",
  "overview.noGeo": "Sem dados de localização. Precisa da base de dados GeoLite2 no servidor.",

  "events.searchPlaceholder": "Pesquisar caminho, título ou evento…",
  "events.screen": "Ecrã",

  "psettings.loadFailed": "Falha ao carregar as definições do projeto.",
  "psettings.rotateFailed": "Não foi possível rodar a chave.",
  "psettings.installBody": "Adicione o script ao seu layout, coloque um pixel onde o JavaScript não corre, ou faça POST para a API de recolha a partir do seu backend.",
  "psettings.publicKeyHint": "Não é um segredo: vai dentro do seu site. Só pode enviar hits. Rode-a se for abusada, ou restrinja-a com os hostnames permitidos abaixo.",
  "psettings.rotate": "Rodar chave",
  "psettings.rotateConfirm": "Rodar agora: a chave antiga deixa de funcionar imediatamente",
  "psettings.snippetPixelHint": "Para e-mails e READMEs. u é a página ou a coisa que quer contar; adicione n=open para um evento com nome. Detalhes:",
  "psettings.snippetEventsHint": "Até 2 KB de props JSON por evento. Aparecem em Eventos personalizados e no registo de eventos. Detalhes:",
  "psettings.snippetApiHint": "De um backend, uma CLI ou um cron job. Dispositivo e localização vêm do próprio pedido. Detalhes:",
  "psettings.trackingTitle": "Rastreio",
  "psettings.collectEnabled": "Recolher hits",
  "psettings.purgeBody": "Elimina todos os eventos armazenados deste projeto. O projeto e a sua chave permanecem.",
  "psettings.purged": "{n} eventos eliminados.",
  "psettings.purgeConfirm": "Sim, eliminar todos os eventos",
  "psettings.dangerBody": "Eliminar o projeto remove-o juntamente com todos os seus eventos. Não pode ser anulado.",
  "psettings.deleteProject": "Eliminar projeto",
  "psettings.deleteProjectConfirm": "Escreva a chave do projeto para confirmar",
  "psettings.deleteProjectFailed": "Não foi possível eliminar o projeto.",

  "keys.unavailableBody": "Estamos a disponibilizar aos poucos. Volte em breve.",
  "keys.copyNow": "Copie a sua nova chave agora: não voltará a ser mostrada.",
  "keys.revokeConfirm": "Revogar esta chave? Tudo o que a usa deixa de funcionar imediatamente.",

  "audit.title": "Registo de auditoria",
  "audit.loadFailed": "Falha ao carregar o registo de auditoria.",

  "billing.title": "Faturação",
  "billing.selfHostTitle": "Esta é uma instância auto-alojada.",
  "billing.selfHostDisabled": "A faturação está desativada",
  "billing.earlyTitle": "Está em acesso antecipado: tudo incluído, grátis.",
  "billing.earlyBody": "Ainda não há nada para comprar. Planos e limites serão introduzidos depois, e será avisado antes de qualquer mudança.",
  "billing.unavailableBody": "Estamos a disponibilizar a faturação aos poucos. Mantém tudo do seu plano atual. Volte em breve.",
  "billing.onPlanPrefix": "Está no plano",
  "billing.onPlanSuffix": ". Desbloqueie mais projetos, mais eventos por mês e retenção mais longa.",
  "billing.annualSave": "(poupe ~20%)",
  "billing.featUsers": "{n} utilizadores",
  "billing.processing": "A processar…",
  "billing.notConfigured":
    "A faturação ainda não está configurada (falta VITE_REVENUECAT_PUBLIC_KEY). Adicione a sua chave pública do RevenueCat Web Billing ao .env e reconstrua a imagem web.",
  "billing.signInAgain": "Inicie sessão novamente para fazer upgrade.",
  "billing.openingCheckout": "A abrir o checkout seguro…",
  "billing.activating": "Pagamento concluído. A ativar o seu plano…",
  "billing.nowOnPlan": "Está agora no plano {plan}! 🎉",
  "billing.willUpdate": "Pagamento recebido. O seu plano será atualizado em instantes.",
};
export default ptPT;
