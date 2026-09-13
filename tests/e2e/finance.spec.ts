import { test, expect } from '@playwright/test';
test('desktop and mobile financial flows', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('demo@financy.local');
  await page.getByLabel('Contraseña', { exact: true }).fill('FinancyDemo2026!');
  await page.getByRole('button', { name: 'Entrar a mi espacio' }).click();
  await expect(page.getByRole('heading', { name: 'Tu panorama financiero' })).toBeVisible();
  await expect(page.getByText('Balance total', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/dashboard-desktop.png', fullPage: true });
  // Keep reruns independent without resetting the demo's representative data.
  await page.evaluate(async () => {
    const send = (p: string, m = 'GET', body?: any) =>
      fetch('/api' + p, {
        method: m,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
    for (const e of (await (await send('/shopping')).json()).items)
      if (e.description.endsWith('UX')) {
        await send('/shopping/' + e.id + '/pending', 'POST', {});
        await send('/shopping/' + e.id, 'DELETE', {});
      }
    for (const k of ['expenses', 'earnings']) {
      const r = await (await send('/entries/' + k + '?q=prueba%20UX')).json();
      for (const e of r.items) await send('/entries/' + k + '/' + e.id, 'DELETE', {});
    }
    for (const b of await (await send('/budgets')).json())
      if (b.name.endsWith('UX')) await send('/budgets/' + b.id, 'DELETE', {});
  });
  await page.getByRole('link', { name: 'Ingresos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo ingreso' }).click();
  await page.getByLabel('Descripción', { exact: true }).fill('Ingreso de prueba UX');
  await page.getByLabel('Importe', { exact: true }).fill('50');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText('Ingreso de prueba UX', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar Ingreso de prueba UX', exact: true }).click();
  await page.getByLabel('Importe', { exact: true }).fill('55');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('link', { name: 'Gastos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo gasto' }).click();
  await page.getByLabel('Descripción', { exact: true }).fill('Gasto de prueba UX');
  await page.getByLabel('Importe', { exact: true }).fill('15');
  await page.getByLabel('Etiquetas', { exact: true }).fill('mercado');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Gasto de prueba UX', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Mis cuentas', exact: true }).click();
  await page.getByRole('button', { name: 'Transferir dinero' }).first().click();
  await page.getByLabel('Importe', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Transferir', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('link', { name: 'Presupuestos', exact: true }).click();
  await page.getByRole('button', { name: 'Nueva categoría' }).click();
  await page.getByLabel('Nombre de la categoría').fill('Presupuesto UX');
  await page.getByLabel('Importe', { exact: true }).fill('100');
  await page.getByLabel('Palabras clave').fill('mercado');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Presupuesto UX' })).toBeVisible();
  await page.getByRole('link', { name: 'Lista de compras', exact: true }).click();
  await page.getByRole('button', { name: 'Añadir compra' }).click();
  await page.getByLabel('¿Qué quieres comprar?').fill('Compra de prueba UX');
  await page.getByLabel('Importe', { exact: true }).fill('7');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  const row = page.locator('.shopping-row').filter({ hasText: 'Compra de prueba UX' });
  await row.getByRole('button', { name: 'Comprar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar compra' }).click();
  await expect(row.getByText('Comprado · Caja')).toBeVisible();
  await row.getByRole('button', { name: 'Volver a pendiente' }).click();
  await expect(row.getByText('Por comprar')).toBeVisible();
  await page.getByRole('link', { name: 'Reportes', exact: true }).click();
  await expect(page.getByText('Total del período')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'CSV', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('financy-expenses.csv');
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  await page.getByLabel('Límite mensual de gastos (USD)').fill('1900');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Perfil actualizado', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Tu panorama financiero' })).toBeVisible();
  await expect(page.getByText('Balance total', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/dashboard-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('link', { name: 'Lista de compras', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lista de compras' })).toBeVisible();
  expect(errors).toEqual([]);
});
