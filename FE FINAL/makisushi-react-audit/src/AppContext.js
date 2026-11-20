import { createContext, useContext } from "react";

// Shared app state for the pages: the page state S and its setter, the export and message stores,
// the uploaded Loyverse file, and the toast and modal helpers.
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);
