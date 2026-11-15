import { vi } from "vitest";
import type {
  Session,
  OnBeforeRequestListenerDetails,
  OnErrorOccurredListenerDetails,
  OnCompletedListenerDetails,
  OnBeforeSendHeadersListenerDetails,
  OnHeadersReceivedListenerDetails,
  WebFrameMain,
  CallbackResponse,
} from "electron";
type Before = (
  details: OnBeforeRequestListenerDetails,
  callback: (result: CallbackResponse) => void,
) => void;
type Outgoing = (
  details: OnBeforeSendHeadersListenerDetails,
  callback: (result: { requestHeaders?: Record<string, string> }) => void,
) => void;
type Incoming = (
  details: OnHeadersReceivedListenerDetails,
  callback: (result: { responseHeaders?: Record<string, string[]> }) => void,
) => void;
/** Deliberate webRequest adapter, not a Chromium request or live-site test. */
export class ShieldSessionFixture {
  before: Before | null = null;
  outgoing: Outgoing | null = null;
  incoming: Incoming | null = null;
  completed: ((details: OnCompletedListenerDetails) => void) | null = null;
  failed: ((details: OnErrorOccurredListenerDetails) => void) | null = null;
  registrations: Record<string, number> = {};
  session: Session;
  constructor() {
    const register =
      <T>(name: string, set: (handler: T | null) => void) =>
      (filter: unknown, handler?: T) => {
        if (filter === null) {
          set(null);
          return;
        }
        this.registrations[name] = (this.registrations[name] || 0) + 1;
        set(handler!);
      };
    this.session = {
      webRequest: {
        onBeforeRequest: register<Before>("before", (handler) => {
          this.before = handler;
        }),
        onBeforeSendHeaders: register<Outgoing>("outgoing", (handler) => {
          this.outgoing = handler;
        }),
        onHeadersReceived: register<Incoming>("incoming", (handler) => {
          this.incoming = handler;
        }),
        onCompleted: register<(details: OnCompletedListenerDetails) => void>(
          "completed",
          (handler) => {
            this.completed = handler;
          },
        ),
        onErrorOccurred: register<
          (details: OnErrorOccurredListenerDetails) => void
        >("failed", (handler) => {
          this.failed = handler;
        }),
      },
    } as unknown as Session;
  }
  details(
    id: number,
    url: string,
    resourceType: OnBeforeRequestListenerDetails["resourceType"] = "script",
    webContentsId = 7,
    frameURL?: string,
    topURL?: string,
  ): OnBeforeRequestListenerDetails {
    return {
      id,
      url,
      resourceType,
      webContentsId,
      method: "GET",
      timestamp: Date.now(),
      referrer: "",
      uploadData: [],
      ...(frameURL
        ? {
            frame: {
              url: frameURL,
              top: { url: topURL || frameURL },
            } as WebFrameMain,
          }
        : {}),
    };
  }
  start(details: OnBeforeRequestListenerDetails): CallbackResponse {
    const callback = vi.fn<(response: CallbackResponse) => void>();
    this.before!(details, callback);
    if (callback.mock.calls.length !== 1)
      throw new Error(
        "A request must receive exactly one completion callback.",
      );
    return callback.mock.calls[0][0];
  }
  finish(id: number, error?: string) {
    if (error) this.failed!({ id, error } as OnErrorOccurredListenerDetails);
    else this.completed!({ id } as OnCompletedListenerDetails);
  }
  request(
    id: number,
    url: string,
    type: OnBeforeRequestListenerDetails["resourceType"] = "script",
    contentsId = 7,
  ) {
    const response = this.start(this.details(id, url, type, contentsId));
    this.finish(id, response.cancel ? "net::ERR_BLOCKED_BY_CLIENT" : undefined);
    return response;
  }
  headers(id: number, url: string, source?: string, top?: string) {
    const base = this.details(id, url, "xhr", 7, source, top);
    const outgoing =
      vi.fn<(result: { requestHeaders?: Record<string, string> }) => void>();
    const incoming =
      vi.fn<(result: { responseHeaders?: Record<string, string[]> }) => void>();
    this.outgoing!(
      {
        ...base,
        requestHeaders: { Cookie: "private=never-log", Accept: "*/*" },
      },
      outgoing,
    );
    this.incoming!(
      {
        ...base,
        responseHeaders: {
          "Set-Cookie": ["private=never-log"],
          "Content-Type": ["text/plain"],
        },
        statusLine: "HTTP/1.1 200 OK",
        statusCode: 200,
      } as OnHeadersReceivedListenerDetails,
      incoming,
    );
    if (outgoing.mock.calls.length !== 1 || incoming.mock.calls.length !== 1)
      throw new Error("Every header event must complete exactly one callback.");
    return {
      outgoing: outgoing.mock.calls[0][0].requestHeaders || {},
      incoming: incoming.mock.calls[0][0].responseHeaders || {},
    };
  }
}
