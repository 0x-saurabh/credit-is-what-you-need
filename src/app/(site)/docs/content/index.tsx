import type { ComponentType } from "react";
import { Account, Billing, Embeddings, Errors, Evaluations, Images, Limits, Models, OpenApi, Videos } from "./api-more";
import { Authentication, ChatCompletions, Messages, Responses, Streaming } from "./api-core";
import { Buying } from "./credits";
import { HowItWorks, QuickstartPage, Rules } from "./getting-started";
import { Integrations } from "./integrations";
import { Privacy, Terms } from "./legal";
import { Dashboard, Playground, Security, SignIn } from "./platform";

// Slug → page. The slugs must match nav.ts; the route 404s for anything else.
export const pages: Record<string, ComponentType> = {
  quickstart: QuickstartPage,
  "how-it-works": HowItWorks,
  rules: Rules,
  "credits/buying": Buying,
  "api/authentication": Authentication,
  "api/chat-completions": ChatCompletions,
  "api/responses": Responses,
  "api/messages": Messages,
  "api/embeddings": Embeddings,
  "api/evaluations": Evaluations,
  "api/images": Images,
  "api/videos": Videos,
  "api/models": Models,
  "api/streaming": Streaming,
  "api/billing": Billing,
  "api/errors": Errors,
  "api/limits": Limits,
  "api/account": Account,
  "api/openapi": OpenApi,
  integrations: Integrations,
  "platform/sign-in": SignIn,
  "platform/dashboard": Dashboard,
  "platform/playground": Playground,
  "platform/security": Security,
  "legal/privacy": Privacy,
  "legal/terms": Terms,
};
