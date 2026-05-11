import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { OcrModule } from './modules/ocr/ocr.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SessionModule } from './modules/session/session.module';
import { ValrepModule } from './modules/valrep/valrep.module';
import { HealthModule } from './modules/health/health.module';
import { SessionGuardMiddleware } from './common/middleware/session-guard.middleware';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'general',
        ttl: 60_000,
        limit: parseInt(process.env.RATE_LIMIT_GENERAL ?? '100', 10),
      },
    ]),
    SessionModule,
    OcrModule,
    PoliciesModule,
    PaymentsModule,
    ValrepModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SessionGuardMiddleware)
      .exclude(
        { path: 'session/init', method: RequestMethod.GET },
        { path: 'session/refresh', method: RequestMethod.POST },
        { path: 'health', method: RequestMethod.GET },
        { path: 'docs', method: RequestMethod.ALL },
        { path: 'docs/*path', method: RequestMethod.ALL },
      )
      .forRoutes('*path');
  }
}
