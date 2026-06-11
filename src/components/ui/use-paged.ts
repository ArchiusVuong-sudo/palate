"use client";

/**
 * usePaged — windowed list rendering: show pageSize items, grow on demand.
 * Pair with <LazySentinel> for infinite scroll and <ShowMoreButton> as the
 * manual fallback. Pass a resetKey (e.g. a filters signature) to rewind to
 * page one when the underlying query changes.
 */
import * as React from "react";

export function usePaged<T>(items: T[], pageSize = 12, resetKey = "") {
  const [count, setCount] = React.useState(pageSize);

  React.useEffect(() => {
    setCount(pageSize);
  }, [resetKey, pageSize]);

  const visible = items.slice(0, count);
  const hasMore = items.length > count;
  const remaining = Math.max(0, items.length - count);
  const showMore = React.useCallback(() => setCount((c) => c + pageSize), [pageSize]);

  return { visible, hasMore, remaining, showMore, shownCount: Math.min(count, items.length) };
}
