// The docs tree. The sidebar, the previous/next footer, search and the static
// route list all read this one structure, so a page exists exactly when it is here.

export type DocPage = { slug: string; title: string; description: string };
export type DocGroup = { title: string; pages: DocPage[] };

export const docGroups: DocGroup[] = [
  {
    title: "Getting started",
    pages: [
      { slug: "", title: "Introduction", description: "What Kredit is, who it is for and how the pieces fit." },
      { slug: "quickstart", title: "Quickstart", description: "From a sign-in to a working API call in five minutes." },
      { slug: "how-it-works", title: "How it works", description: "Buy, spend, read the bill: the loop behind every credit." },
      { slug: "rules", title: "Rules at a glance", description: "Every number the platform runs on, on one page." },
    ],
  },
  {
    title: "Credits",
    pages: [
      { slug: "credits/buying", title: "Buying credits", description: "Pay by card, UPI or net banking; how a payment becomes credits." },
    ],
  },
  {
    title: "API reference",
    pages: [
      { slug: "api/authentication", title: "Authentication", description: "API keys: format, creation, revocation and where to send them." },
      { slug: "api/chat-completions", title: "Chat Completions", description: "POST /v1/chat/completions, the OpenAI shape." },
      { slug: "api/responses", title: "Responses", description: "POST /v1/responses, for the newer OpenAI SDKs." },
      { slug: "api/messages", title: "Messages", description: "POST /v1/messages, the Anthropic shape." },
      { slug: "api/embeddings", title: "Embeddings", description: "POST /v1/embeddings." },
      { slug: "api/evaluations", title: "Evaluations", description: "POST /v1/systemone: typed answers from TypeSafe AI's Jev." },
      { slug: "api/images", title: "Images", description: "POST /v1/images/generations." },
      { slug: "api/videos", title: "Videos", description: "POST /v1/videos/generations." },
      { slug: "api/models", title: "Models", description: "GET /v1/models: ids, types and prices." },
      { slug: "api/streaming", title: "Streaming", description: "Server-sent events and how streamed calls are billed." },
      { slug: "api/billing", title: "Pricing and billing", description: "What a call costs, how it is computed and the headers that report it." },
      { slug: "api/errors", title: "Errors", description: "Every status code and error code the gateway returns." },
      { slug: "api/limits", title: "Rate limits", description: "Requests per minute, keys per account, request sizes." },
      { slug: "api/account", title: "Account and usage", description: "GET /v1/account and GET /v1/usage." },
      { slug: "api/openapi", title: "OpenAPI", description: "The machine-readable description of the API." },
    ],
  },
  {
    title: "Integrations",
    pages: [
      { slug: "integrations", title: "SDKs and tools", description: "The command line, OpenAI and Anthropic SDKs, Claude Code, the AI SDK, Cursor and more." },
    ],
  },
  {
    title: "Platform",
    pages: [
      { slug: "platform/sign-in", title: "Sign-in and sessions", description: "Email or Google through Privy; how a session works." },
      { slug: "platform/dashboard", title: "Dashboard", description: "Every signed-in page and what it does." },
      { slug: "platform/playground", title: "Workspace", description: "Chat with any model, keep the conversation, compare two models, make pictures and clips." },
      { slug: "platform/security", title: "Privacy and security", description: "What is stored, and how keys and sessions are protected." },
    ],
  },
  {
    title: "Legal",
    pages: [
      { slug: "legal/privacy", title: "Privacy policy", description: "What is stored, for how long, who else sees it, and what never is." },
      { slug: "legal/terms", title: "Terms of service", description: "What a credit is, how it is bought, and what you may do with one." },
    ],
  },
];

export const allPages = docGroups.flatMap((group) => group.pages.map((page) => ({ ...page, group: group.title })));

export const docHref = (slug: string) => (slug ? `/docs/${slug}` : "/docs");

export function findPage(slug: string) {
  const index = allPages.findIndex((page) => page.slug === slug);
  if (index === -1) return null;
  return { page: allPages[index], previous: allPages[index - 1] ?? null, next: allPages[index + 1] ?? null };
}
