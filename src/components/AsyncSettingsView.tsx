import { lazy, Suspense } from "react";
const Settings = lazy(() => import("./SettingsView"));
export default function AsyncSettingsView() {
  return (
    <Suspense
      fallback={
        <p className="empty-state" role="status">
          Opening preferences…
        </p>
      }
    >
      <Settings />
    </Suspense>
  );
}
