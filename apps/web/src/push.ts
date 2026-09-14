import { api } from './api';
function urlBase64ToUint8Array(base64: string) {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export async function getPushSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}
export async function enablePush() {
  if (!pushSupported()) throw new Error('Este navegador no admite notificaciones push.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    throw new Error('Debes permitir las notificaciones en tu navegador para activarlas.');
  const { key } = await api('/notifications/vapid-key');
  if (!key) throw new Error('Las notificaciones push no están configuradas en el servidor.');
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    }));
  const json = subscription.toJSON();
  await api('/notifications/subscribe', 'POST', { endpoint: json.endpoint, keys: json.keys });
  return subscription;
}
export async function disablePush() {
  const subscription = await getPushSubscription();
  if (!subscription) return;
  await api('/notifications/unsubscribe', 'POST', { endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}
