import type { PartialCatalog } from "./en";

/** Português (Portugal) — overrides vs the Brazilian base. */
const ptPT: PartialCatalog = {
  "nav.login": "Iniciar sessão",
  "nav.signup": "Registe-se grátis",
  "nav.logout": "Terminar sessão",
  "nav.billing": "Faturação",
  "ui.search": "Pesquisar",

  "landing.panelRequest": "Pedido",
  "landing.mcpIntro": "O oops inclui um servidor MCP. Ligue-o ao Claude Code, Claude Desktop, Cursor ou a qualquer host MCP e pergunte coisas como",
  "landing.mcpBullet1Title": "Chaves restritas por função.",
  "landing.mcpBullet3Title": "Registo de auditoria.",
  "landing.mcpBullet3Body": "Toda a alteração e toda a chamada recusada fica registada, no servidor e no agente.",
  "landing.mcpKeyNote": "Crie uma chave com a função que quiser em",
  "landing.selfhostBody2": ". Sem código de faturação, sem limites além dos que configurar.",

  "blog.intro": "Novidades do produto, notas de engenharia e dicas para ler os seus números.",

  "pricing.enterpriseBody": "Os planos Enterprise são feitos à medida da sua equipa.",
  "pricing.contactUs": "Contacte-nos",
  "pricing.user": "utilizador",
  "pricing.users": "utilizadores",
  "pricing.teamExtras": "Funções + suporte prioritário",

  "docs.authApiKey": "API de gestão: chaves de API com uma função (viewer / editor / admin). Header X-API-Key: oops_live_… (ou Authorization: Bearer).",
  "sponsors.become": "Torne-se supporter",

  "building.title": "Estamos a construir o oops",

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
  "dash.noMatch": "Nenhum projeto corresponde à sua pesquisa.",

  "overview.tzHint": "O fuso horário do projeto; altere-o nas Definições.",


  "psettings.loadFailed": "Falha ao carregar as definições do projeto.",
  "psettings.rotateFailed": "Não foi possível rodar a chave.",
  "psettings.rotate": "Rodar chave",
  "psettings.rotateConfirm": "Rodar agora: a chave antiga deixa de funcionar imediatamente",
  "psettings.purgeConfirm": "Sim, eliminar todos os eventos",
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
