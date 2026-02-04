/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts_mutations from "../accounts/mutations.js";
import type * as accounts_queries from "../accounts/queries.js";
import type * as allocations_mutations from "../allocations/mutations.js";
import type * as allocations_queries from "../allocations/queries.js";
import type * as analytics_spending from "../analytics/spending.js";
import type * as categories_queries from "../categories/queries.js";
import type * as categorizationRules_mutations from "../categorizationRules/mutations.js";
import type * as categorizationRules_queries from "../categorizationRules/queries.js";
import type * as holdings_import from "../holdings/import.js";
import type * as holdings_queries from "../holdings/queries.js";
import type * as liabilities_mutations from "../liabilities/mutations.js";
import type * as liabilities_queries from "../liabilities/queries.js";
import type * as lib_similarity from "../lib/similarity.js";
import type * as seed from "../seed.js";
import type * as transactions_import from "../transactions/import.js";
import type * as transactions_linking from "../transactions/linking.js";
import type * as transactions_mutations from "../transactions/mutations.js";
import type * as transactions_queries from "../transactions/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "accounts/mutations": typeof accounts_mutations;
  "accounts/queries": typeof accounts_queries;
  "allocations/mutations": typeof allocations_mutations;
  "allocations/queries": typeof allocations_queries;
  "analytics/spending": typeof analytics_spending;
  "categories/queries": typeof categories_queries;
  "categorizationRules/mutations": typeof categorizationRules_mutations;
  "categorizationRules/queries": typeof categorizationRules_queries;
  "holdings/import": typeof holdings_import;
  "holdings/queries": typeof holdings_queries;
  "liabilities/mutations": typeof liabilities_mutations;
  "liabilities/queries": typeof liabilities_queries;
  "lib/similarity": typeof lib_similarity;
  seed: typeof seed;
  "transactions/import": typeof transactions_import;
  "transactions/linking": typeof transactions_linking;
  "transactions/mutations": typeof transactions_mutations;
  "transactions/queries": typeof transactions_queries;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
