import { ACTION_CENTER_CATEGORIES, ACTION_CENTER_FILTERS } from "./actionCenterSelectors";

export const ACTION_CENTER_ROUTE_VERSION = "1";

const VERSION_PARAMETER = "actionCenterVersion";
const FILTER_PARAMETER = "actionCenterFilter";
const ITEM_PARAMETER = "actionCenterItem";

function text(value) {
  return String(value ?? "").trim();
}

function searchParameters(search = "") {
  return new URLSearchParams(String(search || "").replace(/^\?/, ""));
}

export function validActionCenterItemId(value) {
  const itemId = text(value);
  return itemId.startsWith("action-center-v1:")
    && itemId.length <= 1000
    && !Array.from(itemId).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    });
}

export function readActionCenterNavigation(search = "") {
  const params = searchParameters(search);
  const present = params.has(VERSION_PARAMETER)
    || params.has(FILTER_PARAMETER)
    || params.has(ITEM_PARAMETER);
  if (!present) {
    return {
      present: false,
      valid: true,
      version: "",
      filter: ACTION_CENTER_CATEGORIES.all,
      itemId: "",
      reasonCode: "",
      message: "",
    };
  }

  const version = text(params.get(VERSION_PARAMETER));
  const filter = text(params.get(FILTER_PARAMETER)) || ACTION_CENTER_CATEGORIES.all;
  const itemId = text(params.get(ITEM_PARAMETER));
  if (version !== ACTION_CENTER_ROUTE_VERSION) {
    return {
      present: true,
      valid: false,
      version,
      filter: ACTION_CENTER_CATEGORIES.all,
      itemId: "",
      reasonCode: "ACTION_CENTER_ROUTE_VERSION_INVALID",
      message: "This Action Center link uses an unsupported or missing route version.",
    };
  }
  if (!ACTION_CENTER_FILTERS.includes(filter)) {
    return {
      present: true,
      valid: false,
      version,
      filter: ACTION_CENTER_CATEGORIES.all,
      itemId: "",
      reasonCode: "ACTION_CENTER_FILTER_INVALID",
      message: "This Action Center link contains an unavailable filter.",
    };
  }
  if (itemId && !validActionCenterItemId(itemId)) {
    return {
      present: true,
      valid: false,
      version,
      filter,
      itemId: "",
      reasonCode: "ACTION_CENTER_ITEM_ID_INVALID",
      message: "This Action Center link contains an invalid item identifier.",
    };
  }
  return {
    present: true,
    valid: true,
    version,
    filter,
    itemId,
    reasonCode: "",
    message: "",
  };
}

export function actionCenterNavigationSearch(search = "", navigation = null) {
  const params = searchParameters(search);
  params.delete(VERSION_PARAMETER);
  params.delete(FILTER_PARAMETER);
  params.delete(ITEM_PARAMETER);
  if (navigation) {
    const filter = ACTION_CENTER_FILTERS.includes(navigation.filter)
      ? navigation.filter
      : ACTION_CENTER_CATEGORIES.all;
    const itemId = text(navigation.itemId);
    params.set(VERSION_PARAMETER, ACTION_CENTER_ROUTE_VERSION);
    params.set(FILTER_PARAMETER, filter);
    if (itemId) params.set(ITEM_PARAMETER, itemId);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function buildActionCenterNavigation({ search = "", filter, itemId = "" } = {}) {
  const normalizedFilter = ACTION_CENTER_FILTERS.includes(filter)
    ? filter
    : ACTION_CENTER_CATEGORIES.all;
  const normalizedItemId = text(itemId);
  if (normalizedItemId && !validActionCenterItemId(normalizedItemId)) {
    return {
      ok: false,
      reasonCode: "ACTION_CENTER_ITEM_ID_INVALID",
      message: "The selected Action Center item has no valid stable identifier.",
    };
  }
  const navigation = {
    present: true,
    valid: true,
    version: ACTION_CENTER_ROUTE_VERSION,
    filter: normalizedFilter,
    itemId: normalizedItemId,
    reasonCode: "",
    message: "",
  };
  return {
    ok: true,
    navigation,
    search: actionCenterNavigationSearch(search, navigation),
    state: {
      activePage: "home",
      actionCenterFilter: normalizedFilter,
      actionCenterItemId: normalizedItemId,
    },
  };
}

export function buildActionCenterExitNavigation({ search = "", activePage = "home" } = {}) {
  return {
    search: actionCenterNavigationSearch(search, null),
    state: {
      activePage: text(activePage) || "home",
      actionCenterFilter: "",
      actionCenterItemId: "",
    },
  };
}
