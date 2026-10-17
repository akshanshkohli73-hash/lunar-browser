import { useLayoutEffect, type RefObject } from "react";
import type { LunarAPI } from "../../shared/api";
export function useNativeViewport(
  ref: RefObject<HTMLDivElement>,
  tabId: string | null,
  visible: boolean,
  api: LunarAPI | undefined,
  report: (error: unknown) => void,
) {
  useLayoutEffect(() => {
    if (!api || !tabId || !ref.current) return;
    const node = ref.current;
    let frame = 0,
      last = "",
      live = true;
    const sync = () => {
      const rect = node.getBoundingClientRect();
      const layout = {
        tabId,
        visible: visible && rect.width > 0 && rect.height > 0,
        bounds: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };
      const encoded = JSON.stringify(layout);
      if (encoded === last) return;
      last = encoded;
      void api.updateWorkspace(layout).catch((error) => {
        if (live) report(error);
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };
    sync();
    const observer = new ResizeObserver(schedule);
    observer.observe(node);
    observer.observe(document.documentElement);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    void document.fonts?.ready.then(() => {
      if (live) schedule();
    });
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      void api
        .updateWorkspace({
          tabId,
          visible: false,
          bounds: { x: 0, y: 0, width: 0, height: 0 },
        })
        .catch(report);
    };
  }, [api, ref, tabId, visible, report]);
}
