/**
 * Centralized port and runtime constants for Nyxora.
 * Change ports here — all references across the codebase will follow.
 */

/** Port for the Nyxora Core API / Gateway server */
export const CORE_PORT = Number(process.env.PORT || 40000);

/** Port for the Nyxora ML Engine (uvicorn / FastAPI) */
export const ML_PORT = Number(process.env.ML_PORT || 50000);

/** Base URL for the Nyxora Core API (used internally by CLI, chat, desktop) */
export const CORE_BASE_URL = `http://localhost:${CORE_PORT}`;

/** Base URL for the Nyxora ML Engine (used internally by agent, tools) */
export const ML_BASE_URL = `http://127.0.0.1:${ML_PORT}`;
