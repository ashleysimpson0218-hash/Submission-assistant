import { ACTION_CENTER_CATEGORIES } from "./actionCenterSelectors";
import {
  ACTION_CENTER_ROUTE_VERSION,
  actionCenterNavigationSearch,
  buildActionCenterNavigation,
  buildActionCenterExitNavigation,
  readActionCenterNavigation,
  validActionCenterItemId,
} from "./actionCenterNavigation";

const itemId = "action-center-v1:Follow-up%20Due:candidate:candidate-1:requisition:req-1:facility:facility-1";

test("builds and restores a versioned Action Center URL without browser persistence", () => {
  const navigation = buildActionCenterNavigation({
    search: "?unrelated=preserved",
    filter: ACTION_CENTER_CATEGORIES.followUp,
    itemId,
  });
  expect(navigation).toMatchObject({
    ok: true,
    navigation: {
      present: true,
      valid: true,
      version: ACTION_CENTER_ROUTE_VERSION,
      filter: ACTION_CENTER_CATEGORIES.followUp,
      itemId,
    },
    state: {
      activePage: "home",
      actionCenterFilter: ACTION_CENTER_CATEGORIES.followUp,
      actionCenterItemId: itemId,
    },
  });
  expect(readActionCenterNavigation(navigation.search)).toEqual(navigation.navigation);
  expect(new URLSearchParams(navigation.search).get("unrelated")).toBe("preserved");
});

test("preserves a filter with no selected item across refresh", () => {
  const navigation = buildActionCenterNavigation({
    filter: ACTION_CENTER_CATEGORIES.managerFeedback,
  });
  expect(readActionCenterNavigation(navigation.search)).toMatchObject({
    valid: true,
    filter: ACTION_CENTER_CATEGORIES.managerFeedback,
    itemId: "",
  });
});

test("removes only Action Center parameters when leaving the route", () => {
  const search = actionCenterNavigationSearch(
    "?unrelated=preserved&actionCenterVersion=1&actionCenterFilter=All&actionCenterItem=action-center-v1%3Atest",
    null,
  );
  expect(search).toBe("?unrelated=preserved");
  expect(readActionCenterNavigation(search).present).toBe(false);
});

test.each([
  ["candidate workspace", "workspace"],
  ["requisition setup", "positions"],
  ["calendar", "calendar"],
])("builds a clean forward destination for %s while the prior URL remains restorable", (_, activePage) => {
  const prior = buildActionCenterNavigation({
    search: "?unrelated=preserved",
    filter: ACTION_CENTER_CATEGORIES.followUp,
    itemId,
  });
  const exit = buildActionCenterExitNavigation({
    search: prior.search,
    activePage,
  });

  expect(exit).toEqual({
    search: "?unrelated=preserved",
    state: {
      activePage,
      actionCenterFilter: "",
      actionCenterItemId: "",
    },
  });
  expect(readActionCenterNavigation(exit.search).present).toBe(false);
  expect(readActionCenterNavigation(prior.search)).toEqual(prior.navigation);
});

test.each([
  ["missing version", "?actionCenterFilter=All", "ACTION_CENTER_ROUTE_VERSION_INVALID"],
  ["unsupported version", "?actionCenterVersion=2&actionCenterFilter=All", "ACTION_CENTER_ROUTE_VERSION_INVALID"],
  ["unknown filter", "?actionCenterVersion=1&actionCenterFilter=Unknown", "ACTION_CENTER_FILTER_INVALID"],
  ["malformed item", "?actionCenterVersion=1&actionCenterFilter=All&actionCenterItem=candidate-1", "ACTION_CENTER_ITEM_ID_INVALID"],
])("fails closed for %s", (_, search, reasonCode) => {
  expect(readActionCenterNavigation(search)).toMatchObject({
    present: true,
    valid: false,
    itemId: "",
    reasonCode,
  });
});

test("rejects unsafe item identifiers rather than generating a fallback URL", () => {
  expect(validActionCenterItemId(`${itemId}\nunsafe`)).toBe(false);
  expect(buildActionCenterNavigation({
    filter: ACTION_CENTER_CATEGORIES.all,
    itemId: "candidate-1",
  })).toMatchObject({
    ok: false,
    reasonCode: "ACTION_CENTER_ITEM_ID_INVALID",
  });
});
