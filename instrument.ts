import * as Sentry from "@sentry/node";
import { maskPii } from "./lib/pii";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  const isProduction = process.env.NODE_ENV === "production";

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE || undefined,
    sendDefaultPii: false,
    tracesSampleRate: isProduction ? 0.3 : 1.0,
    profileSessionSampleRate: isProduction ? 0.1 : 1.0,
    profileLifecycle: 'trace',

    integrations: [Sentry.prismaIntegration()],

    beforeSend(event) {
      if (event.request?.data) {
        event.request.data = maskPii(event.request.data) as typeof event.request.data;
      }
      if (event.request?.headers) {
        event.request.headers = maskPii(event.request.headers) as typeof event.request.headers;
      }
      if (event.request?.query_string) {
        event.request.query_string = maskPii(event.request.query_string) as typeof event.request.query_string;
      }
      if (event.extra) {
        event.extra = maskPii(event.extra) as typeof event.extra;
      }
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (ex.value) ex.value = maskPii(ex.value) as string;
        }
      }
      return event;
    },

    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        breadcrumb.data = maskPii(breadcrumb.data) as typeof breadcrumb.data;
      }
      if (breadcrumb.message) {
        breadcrumb.message = maskPii(breadcrumb.message) as string;
      }
      return breadcrumb;
    },
  });
}
