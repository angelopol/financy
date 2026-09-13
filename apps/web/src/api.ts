export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api(path: string, method = 'GET', body?: unknown) {
  const response = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response
    .json()
    .catch(() => ({ message: 'Respuesta inesperada del servidor' }));
  if (!response.ok)
    throw new ApiError(data.message ?? 'No se pudo completar la solicitud', response.status);
  return data;
}
export const usd = (v: unknown) =>
  new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(v ?? 0));
export const dateLabel = (v: string) =>
  v
    ? new Intl.DateTimeFormat('es-VE', {
        day: 'numeric',
        month: 'short',
        timeZone: 'America/Caracas',
      }).format(new Date(/[zZ]|[+-]\d\d:\d\d$/.test(v) ? v : v.replace(' ', 'T') + '-04:00'))
    : 'Sin fecha';
export const currentMonth = () =>
  new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'America/Caracas',
  }).format(new Date());
export const accountLabel = (v: string) =>
  v === 'savings' ? 'Ahorros' : v === 'auto' ? 'Automática' : 'Caja';
