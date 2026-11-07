import { lazy, Suspense } from "react";
const ThemeStudio = lazy(() => import("./ThemeStudioView"));
/** Load the editing surface only when opened, without replacing the permanent browser. */
export default function AsyncThemeStudio() {
  return (
    <Suspense
      fallback={
        <p className="empty-state" role="status">
          Opening Theme Studio…
        </p>
      }
    >
      <ThemeStudio />
    </Suspense>
  );
}
