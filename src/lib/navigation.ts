// Going back when there may be nothing to go back to.
//
// `router.back()` is a silent no-op on an empty history stack, and that stack
// is empty more often than it looks: a deep link, a pasted URL on web, or the
// app being reopened onto a route all land you somewhere with no history behind
// it. The Cancel button is then visible, enabled, and does nothing — which is
// the failure mode this codebase already refuses elsewhere.
//
// Takes the router rather than calling the hook, so it stays a pure function
// and the route files keep their single `useRouter()`.

interface BackCapableRouter {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: never) => void;
}

/**
 * Go back, or to `fallback` when there is no history.
 *
 * `fallback` is typed through the router's own `replace`, so a typo in a route
 * is a compile error under `experiments.typedRoutes` rather than a dead button.
 */
export function goBackOr<R extends BackCapableRouter>(
  router: R,
  fallback: Parameters<R["replace"]>[0],
): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
