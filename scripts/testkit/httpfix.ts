/**
 * httpfix.ts — a loopback HTTP fixture for the integration layer.
 *
 * The fetching rules are only proven by real requests: a mock that returns a
 * canned 503 proves the branch, not that the branch is reached over a socket
 * by the transport the skill actually ships.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface RecordedRequest {
  method: string;
  path: string;
  userAgent: string;
  /** Milliseconds since the fixture started, for asserting on pacing. */
  at: number;
}

export interface RouteResponse {
  status?: number;
  body?: string;
  headers?: Record<string, string>;
  /** Delay before responding, to exercise timeouts. */
  delayMs?: number;
}

export type Route = RouteResponse | ((request: IncomingMessage, hit: number) => RouteResponse);

export interface Fixture {
  /** Origin to fetch, e.g. `http://127.0.0.1:53124`. */
  url: string;
  host: string;
  /** Every request the fixture received, in order. */
  requests: RecordedRequest[];
  /** Requests for one path. */
  hits(path: string): RecordedRequest[];
  close(): Promise<void>;
}

export function ok(body: string, headers: Record<string, string> = {}): RouteResponse {
  return { status: 200, body, headers };
}

export function status(code: number, body = ""): RouteResponse {
  return { status: code, body };
}

/**
 * Starts a fixture on loopback with an ephemeral port.
 *
 * `routes` is keyed by pathname. An unlisted path is a 404, which is itself
 * meaningful: it is how "this host has no robots.txt" is expressed.
 */
export async function startFixture(routes: Record<string, Route>): Promise<Fixture> {
  const requests: RecordedRequest[] = [];
  const hitCounts = new Map<string, number>();
  const started = Date.now();

  const server: Server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const path = (request.url ?? "/").split("?")[0];
    requests.push({
      method: request.method ?? "GET",
      path,
      userAgent: String(request.headers["user-agent"] ?? ""),
      at: Date.now() - started,
    });

    const hit = (hitCounts.get(path) ?? 0) + 1;
    hitCounts.set(path, hit);

    const route = routes[path];
    const resolved: RouteResponse =
      route === undefined ? { status: 404, body: "not found" } : typeof route === "function" ? route(request, hit) : route;

    const send = () => {
      response.writeHead(resolved.status ?? 200, {
        "content-type": "text/plain; charset=utf-8",
        ...(resolved.headers ?? {}),
      });
      response.end(resolved.body ?? "");
    };

    if (resolved.delayMs) setTimeout(send, resolved.delayMs);
    else send();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const host = `127.0.0.1:${port}`;

  return {
    url: `http://${host}`,
    host,
    requests,
    hits: (path) => requests.filter((r) => r.path === path),
    close: () =>
      new Promise<void>((resolve, reject) => {
        // curl sends `Connection: keep-alive`, so the socket stays open after
        // the response. `server.close()` alone waits for every idle keep-alive
        // socket to time out and the fixture hangs on teardown; closing the
        // connections first is what makes close() actually close.
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
