import { AppError } from './domain';

export const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

export function assertSameOrigin(request: Request) {
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (request.headers.get('origin') !== expected) throw new AppError('Nguồn yêu cầu không hợp lệ.', 403);
}

export async function readJson(request: Request) {
  assertSameOrigin(request);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new AppError('Định dạng không hợp lệ.', 415);
  if (Number(request.headers.get('content-length')) > 200000) throw new AppError('Dữ liệu quá lớn.', 413);
  // Count bytes and stop reading before an unbounded chunked request consumes memory.
  const reader = request.body?.getReader();
  if (!reader) throw new AppError('Thiếu dữ liệu JSON.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 200000) { await reader.cancel(); throw new AppError('Dữ liệu quá lớn.', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('object required');
    return body as Record<string, unknown>;
  } catch { throw new AppError('Dữ liệu JSON không hợp lệ.'); }
}

export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: PRIVATE_HEADERS });
}

export function errorResponse(error: unknown) {
  return json({ error: error instanceof AppError ? error.message : 'Không thể xử lý yêu cầu. Vui lòng thử lại.' }, error instanceof AppError ? error.status : 500);
}
