import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { CustomersModule } from './customers/customers.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { ConnectorsModule } from './connectors/connectors.module';
import { SchemasModule } from './schemas/schemas.module';
import { AuditModule } from './audit/audit.module';
import { EventsModule } from './events/events.module';
import { SystemHealthController } from './system-health/system-health.controller';
import { ProductsModule } from './products/products.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TenantsModule } from './tenants/tenants.module';
import { AiModule } from './ai/ai.module';
import { CdmVersionsModule } from './cdm-versions/cdm-versions.module';
import { GovernanceModule } from './governance/governance.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { DataHealthModule } from './data-health/data-health.module';
import { M1ProxyModule } from './m1-proxy/m1-proxy.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // #5 Rate limiting — 100 requests per minute per IP globally
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USER', 'postgres'),
        password: config.get('DB_PASS', 'postgres'),
        database: config.get('DB_NAME', 'nexus_db'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: false,
      }),
    }),
    AuthModule,
    UsersModule,
    OrdersModule,
    CustomersModule,
    ApprovalsModule,
    ConnectorsModule,
    SchemasModule,
    AuditModule,
    // #1 WebSocket real-time events
    EventsModule,
    // Products catalogue
    ProductsModule,
    // Dashboard aggregated KPIs
    DashboardModule,
    // Tenants management
    TenantsModule,
    // OpenAI AI assistant
    AiModule,
    // CDM schema versions
    CdmVersionsModule,
    // Governance pipeline — proposals, mapping reviews, sync jobs
    GovernanceModule,
    // Pipeline M1/M2/M3 status and job history
    PipelineModule,
    // Data quality health dashboard
    DataHealthModule,
    // M1 API proxy — avoids CORS/OIDC issues with Kong
    M1ProxyModule,
  ],
  controllers: [SystemHealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
