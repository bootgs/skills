/**
 * Minimal client for a bootgs backend called through google.script.run,
 * i.e. from an HtmlService sidebar or dialog embedded in Sheets/Docs/Slides.
 *
 * Adapt `apiPrefix` to match the ApplicationConfig your backend was created with
 * (bootgs default is "/api" — see the bootgs-quickstart skill).
 */

declare const google: {
  script: {
    run: Record<string, any>;
  };
};

const API_PREFIX = "/api";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface CallOptions {
  query?: Record<string, string | number | boolean>;
  body?: unknown;
}

function buildQueryParams(query: Record<string, string | number | boolean> = {}): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    params[key] = String(value);
  }
  return params;
}

function runScriptFunction<T>(fnName: "doGet" | "doPost", payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler((result: T) => resolve(result))
      .withFailureHandler((error: Error) => reject(error))
      [fnName](payload);
  });
}

/**
 * Calls a bootgs controller route.
 *
 * `pathname` must already have any {param} placeholders substituted with
 * real values — the router does not template on the client's behalf.
 */
export async function callBootgsApi<T>(method: HttpMethod, pathname: string, options: CallOptions = {}): Promise<T> {
  const fullPath = pathname.startsWith(API_PREFIX) ? pathname : `${API_PREFIX}${pathname}`;
  const query = buildQueryParams(options.query);

  if (method === "GET" || method === "DELETE") {
    return runScriptFunction<T>("doGet", {
      queryString: new URLSearchParams({ method, pathname: fullPath, ...query }).toString(),
      parameter: { method, pathname: fullPath, ...query },
      parameters: {},
      pathInfo: fullPath,
      contextPath: "",
      contentLength: -1,
    });
  }

  const body = options.body !== undefined ? JSON.stringify(options.body) : "";

  return runScriptFunction<T>("doPost", {
    queryString: new URLSearchParams({ method, pathname: fullPath, ...query }).toString(),
    parameter: { method, pathname: fullPath, ...query },
    parameters: {},
    pathInfo: fullPath,
    contextPath: "",
    contentLength: body.length,
    postData: {
      length: body.length,
      type: "application/json",
      contents: body,
      name: "postData",
    },
  });
}

// Example:
// const widget = await callBootgsApi<WidgetResponse>("GET", "/v1/widgets/42");
// const created = await callBootgsApi<WidgetResponse>("POST", "/v1/widgets", { body: { name: "New widget" } });
