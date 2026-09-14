import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { DateTime } from 'luxon';
import { money, now } from './domain';
@Injectable()
export class RatesService {
  private cache = new Map<string, { expires: number; value: any }>();
  async get(date = now().toISODate()!) {
    const hit = this.cache.get(date);
    if (hit && hit.expires > Date.now()) return hit.value;
    const pair = async (asset: string) => {
      for (let back = 0; back <= (date < now().toISODate()! ? 7 : 0); back++) {
        const effective = DateTime.fromISO(date).minus({ days: back });
        const path =
          date < now().toISODate()!
            ? `historicos/${asset}/${effective.toFormat('yyyy/MM/dd')}`
            : asset;
        try {
          const response = await fetch('https://ve.dolarapi.com/v1/' + path, {
            signal: AbortSignal.timeout(5000),
          });
          if (!response.ok) continue;
          const json = await response.json();
          const rows = Array.isArray(json) ? json : [json];
          const result: any = { date: effective.toISODate() };
          for (const r of rows) {
            const label = `${r.nombre} ${r.fuente}`.toLowerCase();
            const v = Number(r.promedio);
            if (!Number.isFinite(v) || v <= 0) continue;
            if (/paralelo|yadio/.test(label)) result.parallel = v;
            else if (/oficial|bcv/.test(label)) result.official = v;
          }
          if (result.parallel || result.official) return result;
        } catch {}
      }
      return {};
    };
    const [usd, eur] = await Promise.all([pair('dolares'), pair('euros')]);
    let fallback: any = null;
    if ((!usd.official || !eur.official) && process.env.DOLARVZLA_API_KEY) {
      try {
        const past = date < now().toISODate()!;
        const url = new URL(
          past ? '/public/bcv/exchange-rate/list' : '/public/bcv/exchange-rate',
          'https://www.dolarvzla.com',
        );
        if (past) {
          url.searchParams.set('from', date);
          url.searchParams.set('to', date);
        }
        const response = await fetch(url, {
          headers: { 'x-dolarvzla-key': process.env.DOLARVZLA_API_KEY },
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const json = await response.json();
          fallback = past ? json.rates?.[0] : json.current;
        }
      } catch {}
    }
    const positive = (v: unknown) =>
      Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;
    const value = {
      bcv: usd.official ?? positive(fallback?.usd),
      parallel: usd.parallel ?? null,
      euro: eur.official ?? positive(fallback?.eur),
      euro_parallel: eur.parallel ?? null,
      requested_date: date,
      effective_date: usd.date ?? eur.date ?? (fallback ? date : null),
      usd_date: usd.date ?? null,
      eur_date: eur.date ?? null,
      source: fallback ? 'DolarAPI + DolarVzla' : 'DolarAPI',
    };
    if (this.cache.size > 30) this.cache.clear();
    this.cache.set(date, { expires: Date.now() + 300000, value });
    return value;
  }
  async convert(currency: string, amount: string, date?: string) {
    if (currency === '$' || currency === 'USD') return money(amount);
    const rates: any = await this.get(date);
    const required = (key: string) => {
      if (!rates[key])
        throw new ServiceUnavailableException(
          'La tasa requerida no está disponible. Intenta más tarde.',
        );
      return new Decimal(rates[key]);
    };
    let factor: Decimal;
    switch (currency) {
      case 'bs':
      case '$parallel':
        // '$parallel' is a retired code kept only so old recurring entries
        // still convert; new entries can no longer be saved with it.
        // Bolívares always convert through the parallel rate: everything
        // ultimately lands in USD at the parallel rate, never the official one.
        factor = new Decimal(1).div(required('parallel'));
        break;
      case 'VES_BCV':
        // Retired code kept only for old entries, see '$parallel' above.
        factor = new Decimal(1).div(required('bcv'));
        break;
      case 'EUR':
        // Retired code kept only for old entries, see '$parallel' above.
        factor = required('euro').div(required('bcv'));
        break;
      case '$bcv':
        // An amount priced at the official USD rate, re-based to its
        // parallel-rate USD equivalent.
        factor = required('bcv').div(required('parallel'));
        break;
      case '€':
        // Euro priced at the official (BCV) rate, converted to its
        // parallel-rate USD equivalent.
        factor = required('euro').div(required('parallel'));
        break;
      case 'EUR_PARALLEL':
        // Euro priced at the parallel-market rate, converted to its
        // parallel-rate USD equivalent.
        factor = required('euro_parallel').div(required('parallel'));
        break;
      default:
        throw new ServiceUnavailableException('Moneda no soportada');
    }
    return money(new Decimal(amount).mul(factor));
  }
  // Bolívares at the parallel rate, computed directly from the source currency
  // instead of chaining convert() (USD) then multiplying by the parallel rate
  // again: same result mathematically, but one rounding step instead of two.
  async toBs(currency: string, amount: string, date?: string) {
    if (currency === 'bs') return money(amount);
    const rates: any = await this.get(date);
    const required = (key: string) => {
      if (!rates[key])
        throw new ServiceUnavailableException(
          'La tasa requerida no está disponible. Intenta más tarde.',
        );
      return new Decimal(rates[key]);
    };
    let bsRate: Decimal;
    switch (currency) {
      case '$':
      case 'USD':
        bsRate = required('parallel');
        break;
      case '$bcv':
        bsRate = required('bcv');
        break;
      case '€':
        bsRate = required('euro');
        break;
      case 'EUR_PARALLEL':
        bsRate = required('euro_parallel');
        break;
      default:
        throw new ServiceUnavailableException('Moneda no soportada');
    }
    return money(new Decimal(amount).mul(bsRate));
  }
}
