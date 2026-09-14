import 'reflect-metadata';
import {
  ArgumentsHost,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  HttpException,
  Inject,
  Module,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { APP_FILTER } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Database } from './database';
import { AuthController, AuthGuard, AuthService } from './auth';
import { FinanceService } from './finance';
import { PlanningService } from './planning';
import { RatesService } from './rates';
import { FinanceController } from './controllers';
import { JobsController, JobsService } from './jobs';
import { ChatController, ChatService } from './ai/chat';
import { GeminiService } from './ai/gemini';
import { FinancialContextService } from './ai/financial-context';
import { ActionsService } from './ai/actions';
import { ActivityController, ActivityService } from './activity';
import { PushService } from './push';
import { NotificationsController } from './notifications';
@Catch()
class Errors implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (res.headersSent) {
      res.end();
      return;
    }
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : error.code === '23505'
          ? 409
          : error.code === '23503'
            ? 400
            : 503;
    const message =
      error instanceof HttpException
        ? error.message
        : error.code === '23505'
          ? 'Ya existe un registro con estos datos'
          : error.code === '23503'
            ? 'La referencia seleccionada no existe'
            : 'No pudimos completar la operación. Revisa la conexión y vuelve a intentarlo.';
    if (status === 503)
      console.error('Request failed:', error.code ?? error.constructor.name, error.message);
    res.status(status).json({ message, statusCode: status });
  }
}
@Controller('health')
class HealthController {
  constructor(@Inject(Database) private db: Database) {}
  @Get() async health() {
    await this.db.query('SELECT 1 FROM financy_sessions LIMIT 1');
    return { status: 'ok' };
  }
}
@Module({
  providers: [
    Database,
    AuthService,
    AuthGuard,
    RatesService,
    FinanceService,
    PlanningService,
    JobsService,
    GeminiService,FinancialContextService,ChatService,ActionsService,ActivityService,PushService,
    { provide: APP_FILTER, useClass: Errors },
  ],
  controllers: [HealthController, AuthController, FinanceController, JobsController, ChatController, ActivityController, NotificationsController],
})
export class AppModule {}
export async function createApp(database?: Database) {
  const module = database ? class TestModule {} : AppModule;
  if (database)
    Module({
      providers: [
        { provide: Database, useValue: database },
        AuthService,
        AuthGuard,
        RatesService,
        FinanceService,
        PlanningService,
        JobsService,
        GeminiService,FinancialContextService,ChatService,ActionsService,ActivityService,PushService,
        { provide: APP_FILTER, useClass: Errors },
      ],
      controllers: [HealthController, AuthController, FinanceController, JobsController, ChatController, ActivityController, NotificationsController],
    })(module);
  const app = await NestFactory.create<NestExpressApplication>(module, {
    logger: ['error', 'warn'],
  });
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.use((req: any, res: any, next: any) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      const allowed = process.env.APP_URL || 'http://localhost:5173';
      if (origin !== allowed || !req.is('application/json'))
        return res.status(403).json({ message: 'Origen de solicitud inválido' });
    }
    next();
  });
  app.enableShutdownHooks();
  await app.init();
  return app;
}
