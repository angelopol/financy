import {
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Inject,
  Injectable,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
  UseGuards,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { Database, Sql } from './database';
import { parse } from './domain';
import { JobsService } from './jobs';
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const password = z.string().min(10, 'Usa al menos 10 caracteres').max(72);
const credentials = z.object({
  email: z
    .email()
    .max(255)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(1).max(72),
});
export const publicUser = (u: any) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  email_verified_at: u.email_verified_at,
  monthly_expense_limit: u.monthly_expense_limit,
});
export type AuthRequest = Request & { user: any; sessionHash: string };
@Injectable()
export class AuthService {
  constructor(@Inject(Database) readonly db: Database) {}
  async limit(key: string, max = 10) {
    const r = await this.db.query(
      `INSERT INTO financy_rate_limits(key,count,expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN financy_rate_limits.expires_at<now() THEN 1 ELSE financy_rate_limits.count+1 END, expires_at=CASE WHEN financy_rate_limits.expires_at<now() THEN now()+interval '15 minutes' ELSE financy_rate_limits.expires_at END RETURNING count`,
      [digest(key)],
    );
    if (r.rows[0].count > max)
      throw new HttpException('Demasiados intentos. Vuelve en 15 minutos.', 429);
  }
  async check(user: any, value: string) {
    if (!user || !(await compare(value, user.password.replace(/^\$2y\$/, '$2b$'))))
      throw new UnauthorizedException('Correo o contraseña incorrectos');
  }
  async session(user: any, res: Response) {
    const token = randomBytes(32).toString('hex');
    await this.db.query(
      "INSERT INTO financy_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
      [digest(token), user.id],
    );
    res.cookie('financy_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 86400000,
    });
    return publicUser(user);
  }
  async queueToken(sql: Sql, user: any, purpose: string) {
    const token = randomBytes(32).toString('hex');
    await sql.query('DELETE FROM financy_tokens WHERE user_id=$1 AND purpose=$2', [
      user.id,
      purpose,
    ]);
    await sql.query(
      "INSERT INTO financy_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
      [digest(token), user.id, purpose],
    );
    const url = new URL(
      purpose === 'reset' ? '/reset-password' : '/verify-email',
      process.env.APP_URL || 'http://localhost:5173',
    );
    url.searchParams.set('token', token);
    await sql.query(
      'INSERT INTO financy_mail(user_id,recipient,subject,body,dedupe) VALUES($1,$2,$3,$4,$5)',
      [
        user.id,
        user.email,
        purpose === 'reset' ? 'Restablece tu contraseña · Financy' : 'Verifica tu correo · Financy',
        `Abre este enlace (válido por una hora): ${url}`,
        digest(token),
      ],
    );
  }
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(Database) private db: Database) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const token = req.cookies?.financy_session;
    if (typeof token !== 'string') throw new UnauthorizedException('Inicia sesión para continuar');
    const result = await this.db.query(
      'SELECT u.* FROM users u JOIN financy_sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()',
      [digest(token)],
    );
    if (!result.rows[0]) throw new UnauthorizedException('Tu sesión ha vencido');
    req.user = result.rows[0];
    req.sessionHash = digest(token);
    return true;
  }
}
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private auth: AuthService,
    @Inject(JobsService) private jobs: JobsService,
  ) {}
  private async deliver() {
    try {
      await this.jobs.sendMail();
    } catch {
      console.error('Mail delivery pending; retry via /api/cron');
    }
  }
  @Post('register') async register(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const v = parse(
      credentials.extend({ name: z.string().trim().min(1).max(255), password }),
      body,
    );
    await this.auth.limit('register:' + req.ip, 5);
    const encoded = await hash(v.password, 12);
    const user = await this.auth.db.transaction(async (sql) => {
      const exists = await sql.query('SELECT id FROM users WHERE lower(email)=$1', [v.email]);
      if (exists.rows.length)
        throw new HttpException('No se pudo crear la cuenta con ese correo', 409);
      const r = await sql.query(
        'INSERT INTO users(name,email,password,created_at,updated_at) VALUES($1,$2,$3,now(),now()) RETURNING *',
        [v.name, v.email, encoded],
      );
      for (const t of ['boxes', 'savings'])
        await sql.query(
          `INSERT INTO ${t}("user",amount,created_at,updated_at) VALUES($1,0,now(),now())`,
          [r.rows[0].id],
        );
      await this.auth.queueToken(sql, r.rows[0], 'verify');
      return r.rows[0];
    });
    await this.deliver();
    return this.auth.session(user, res);
  }
  @Post('login') async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const v = parse(credentials, body);
    await this.auth.limit('login:' + v.email);
    await this.auth.limit('login-ip:' + req.ip, 60);
    const user = (await this.auth.db.query('SELECT * FROM users WHERE lower(email)=$1', [v.email]))
      .rows[0];
    // Always perform a hash comparison, including unknown accounts.
    await this.auth.check(
      user ?? { password: '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW' },
      v.password,
    );
    if (!user) throw new UnauthorizedException('Correo o contraseña incorrectos');
    return this.auth.session(user, res);
  }
  @Get('me') @UseGuards(AuthGuard) me(@Req() req: AuthRequest) {
    return publicUser(req.user);
  }
  @Post('logout') @UseGuards(AuthGuard) async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.db.query('DELETE FROM financy_sessions WHERE token_hash=$1', [req.sessionHash]);
    res.clearCookie('financy_session', { path: '/' });
    return { ok: true };
  }
  @Post('forgot-password') async forgot(@Body() body: unknown, @Req() req: Request) {
    const v = parse(z.object({ email: z.email().transform((s) => s.toLowerCase()) }), body);
    await this.auth.limit('reset:' + req.ip, 5);
    await this.auth.db.transaction(async (sql) => {
      const u = (await sql.query('SELECT * FROM users WHERE lower(email)=$1', [v.email])).rows[0];
      if (u) await this.auth.queueToken(sql, u, 'reset');
    });
    await this.deliver();
    return {
      message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
    };
  }
  @Post('reset-password') async reset(@Body() body: unknown) {
    const v = parse(z.object({ token: z.string().length(64), password }), body);
    const encoded = await hash(v.password, 12);
    await this.auth.db.transaction(async (sql) => {
      const t = (
        await sql.query(
          "DELETE FROM financy_tokens WHERE token_hash=$1 AND purpose='reset' AND expires_at>now() RETURNING user_id",
          [digest(v.token)],
        )
      ).rows[0];
      if (!t) throw new ForbiddenException('Enlace inválido o vencido');
      await sql.query('UPDATE users SET password=$1,updated_at=now() WHERE id=$2', [
        encoded,
        t.user_id,
      ]);
      await sql.query('DELETE FROM financy_sessions WHERE user_id=$1', [t.user_id]);
    });
    return { ok: true };
  }
  @Post('verify-email') async verify(@Body() body: unknown) {
    const v = parse(z.object({ token: z.string().length(64) }), body);
    await this.auth.db.transaction(async (sql) => {
      const t = (
        await sql.query(
          "DELETE FROM financy_tokens WHERE token_hash=$1 AND purpose='verify' AND expires_at>now() RETURNING user_id",
          [digest(v.token)],
        )
      ).rows[0];
      if (!t) throw new ForbiddenException('Enlace inválido o vencido');
      await sql.query('UPDATE users SET email_verified_at=now() WHERE id=$1', [t.user_id]);
    });
    return { ok: true };
  }
  @Post('verification-notification') @UseGuards(AuthGuard) async resend(@Req() req: AuthRequest) {
    await this.auth.limit('verify:' + req.user.id, 5);
    await this.auth.db.transaction((sql) => this.auth.queueToken(sql, req.user, 'verify'));
    await this.deliver();
    return { ok: true };
  }
  @Post('confirm-password') @UseGuards(AuthGuard) async confirm(
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = parse(z.object({ password: z.string().max(72) }), body);
    await this.auth.limit('confirm:' + req.user.id);
    await this.auth.check(req.user, v.password);
    await this.auth.db.query('UPDATE financy_sessions SET confirmed_at=now() WHERE token_hash=$1', [
      req.sessionHash,
    ]);
    return { ok: true };
  }
  @Patch('profile') @UseGuards(AuthGuard) async profile(
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = parse(
      z.object({
        name: z.string().trim().min(1).max(255),
        email: z.email().transform((s) => s.toLowerCase()),
        monthly_expense_limit: z.coerce.number().min(0).max(9999999999),
      }),
      body,
    );
    const result = await this.auth.db.transaction(async (sql) => {
      if (v.email !== req.user.email) {
        const s = await sql.query(
          "SELECT 1 FROM financy_sessions WHERE token_hash=$1 AND confirmed_at>now()-interval '10 minutes'",
          [req.sessionHash],
        );
        if (!s.rows.length)
          throw new ForbiddenException('Confirma tu contraseña antes de cambiar el correo');
      }
      const u = (
        await sql.query(
          'UPDATE users SET name=$1,email_verified_at=CASE WHEN email=$2::varchar THEN email_verified_at ELSE NULL END,email=$2::varchar,monthly_expense_limit=$3,updated_at=now() WHERE id=$4 RETURNING *',
          [v.name, v.email, v.monthly_expense_limit, req.user.id],
        )
      ).rows[0];
      if (v.email !== req.user.email) {
        await sql.query('DELETE FROM financy_tokens WHERE user_id=$1', [u.id]);
        await this.auth.queueToken(sql, u, 'verify');
      }
      return publicUser(u);
    });
    await this.deliver();
    return result;
  }
  @Post('password') @UseGuards(AuthGuard) async changePassword(
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const v = parse(z.object({ current_password: z.string().max(72), password }), body);
    await this.auth.limit('password:' + req.user.id);
    await this.auth.check(req.user, v.current_password);
    const encoded = await hash(v.password, 12);
    await this.auth.db.transaction(async (sql) => {
      await sql.query('UPDATE users SET password=$1 WHERE id=$2', [encoded, req.user.id]);
      await sql.query('DELETE FROM financy_sessions WHERE user_id=$1', [req.user.id]);
      await sql.query("DELETE FROM financy_tokens WHERE user_id=$1 AND purpose='reset'", [
        req.user.id,
      ]);
    });
    return { ok: true };
  }
  @Delete('profile') @UseGuards(AuthGuard) async remove(
    @Body() body: unknown,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const v = parse(z.object({ password: z.string().max(72) }), body);
    await this.auth.limit('delete:' + req.user.id);
    await this.auth.check(req.user, v.password);
    await this.auth.db.query('DELETE FROM users WHERE id=$1', [req.user.id]);
    res.clearCookie('financy_session', { path: '/' });
    return { ok: true };
  }
}
