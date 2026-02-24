export const makeTraceId = (): string => {
  const rand = Math.random().toString(36).slice(2, 10);
  return `trace_${Date.now()}_${rand}`;
};

interface ReplyLike {
  send: (payload: unknown) => unknown;
}

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
}

export const ok = <T>(reply: ReplyLike, traceId: string, data: T): void => {
  reply.send({
    ok: true,
    data,
    trace_id: traceId
  });
};

export const getRoleFromRequest = (
  request: RequestLike
): "owner" | "admin" | "operator" | "viewer" => {
  const incoming = request.headers["x-role"];
  if (
    incoming === "owner" ||
    incoming === "admin" ||
    incoming === "operator" ||
    incoming === "viewer"
  ) {
    return incoming;
  }
  return "owner";
};
