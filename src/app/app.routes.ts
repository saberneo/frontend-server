import { Routes } from '@angular/router';
import { authGuard, adminGuard, loginGuard } from './auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', canActivate: [loginGuard], loadComponent: () => import('./login.component').then(m => m.LoginComponent) },

  // ── Okta OIDC callback — handles error params from Okta ─────────────────
  { path: 'auth/callback', loadComponent: () => import('./auth-callback.component').then(m => m.AuthCallbackComponent) },

  // ── Admin-only routes ───────────────────────────────────────────────────
  { path: 'source-connectors', canActivate: [adminGuard],
    loadComponent: () => import('./source-connectors.component').then(m => m.SourceConnectorsComponent) },
  { path: 'schema-registry', canActivate: [adminGuard],
    loadComponent: () => import('./schema-registry.component').then(m => m.SchemaRegistryComponent) },
  { path: 'cdm-governance', canActivate: [adminGuard],
    loadComponent: () => import('./cdm-governance.component').then(m => m.CdmGovernanceComponent) },
  { path: 'field-mappings', canActivate: [adminGuard],
    loadComponent: () => import('./field-mappings.component').then(m => m.FieldMappingsComponent) },
  { path: 'cdm-versions', canActivate: [adminGuard],
    loadComponent: () => import('./cdm-versions.component').then(m => m.CdmVersionsComponent) },
  { path: 'system-health', canActivate: [adminGuard],
    loadComponent: () => import('./system-health.component').then(m => m.SystemHealthComponent) },
  { path: 'tenants', canActivate: [adminGuard],
    loadComponent: () => import('./tenants.component').then(m => m.TenantsComponent) },
  { path: 'users-roles', canActivate: [adminGuard],
    loadComponent: () => import('./users-roles.component').then(m => m.UsersRolesComponent) },
  { path: 'audit-log', canActivate: [adminGuard],
    loadComponent: () => import('./audit-log.component').then(m => m.AuditLogComponent) },

  // ── Authenticated user routes ───────────────────────────────────────────
  { path: 'overview', canActivate: [authGuard],
    loadComponent: () => import('./overview.component').then(m => m.OverviewComponent) },
  { path: 'ask-nexus', canActivate: [authGuard],
    loadComponent: () => import('./ask-nexus.component').then(m => m.AskNexusComponent) },
  { path: 'customers', canActivate: [authGuard],
    loadComponent: () => import('./customers.component').then(m => m.CustomersComponent) },
  { path: 'orders-sales', canActivate: [authGuard],
    loadComponent: () => import('./orders-sales.component').then(m => m.OrdersSalesComponent) },
  { path: 'products', canActivate: [authGuard],
    loadComponent: () => import('./products.component').then(m => m.ProductsComponent) },
  { path: 'pending-approvals', canActivate: [authGuard],
    loadComponent: () => import('./pending-approvals.component').then(m => m.PendingApprovalsComponent) },
  { path: 'data-health', canActivate: [authGuard],
    loadComponent: () => import('./data-health.component').then(m => m.DataHealthComponent) },

  // ── CFO routes ──────────────────────────────────────────────────────────
  { path: 'cfo-pnl', canActivate: [authGuard],
    loadComponent: () => import('./cfo-pnl.component').then(m => m.CfoPnlComponent) },
  { path: 'cfo-budget', canActivate: [authGuard],
    loadComponent: () => import('./cfo-budget.component').then(m => m.CfoBudgetComponent) },
  { path: 'cfo-cashflow', canActivate: [authGuard],
    loadComponent: () => import('./cfo-cashflow.component').then(m => m.CfoCashflowComponent) },
  { path: 'cfo-receivables', canActivate: [authGuard],
    loadComponent: () => import('./cfo-receivables.component').then(m => m.CfoReceivablesComponent) },
  { path: 'cfo-cost-analysis', canActivate: [authGuard],
    loadComponent: () => import('./cfo-cost-analysis.component').then(m => m.CfoCostAnalysisComponent) },
  { path: 'cfo-forecast', canActivate: [authGuard],
    loadComponent: () => import('./cfo-forecast.component').then(m => m.CfoForecastComponent) },

  // ── CEO routes ──────────────────────────────────────────────────────────
  { path: 'ceo-pulse', canActivate: [authGuard],
    loadComponent: () => import('./ceo-pulse.component').then(m => m.CeoPulseComponent) },
  { path: 'ceo-growth', canActivate: [authGuard],
    loadComponent: () => import('./ceo-growth.component').then(m => m.CeoGrowthComponent) },
  { path: 'ceo-market', canActivate: [authGuard],
    loadComponent: () => import('./ceo-market.component').then(m => m.CeoMarketComponent) },
  { path: 'ceo-strategy', canActivate: [authGuard],
    loadComponent: () => import('./ceo-strategy.component').then(m => m.CeoStrategyComponent) },
  { path: 'ceo-risks', canActivate: [authGuard],
    loadComponent: () => import('./ceo-risks.component').then(m => m.CeoRisksComponent) },

  { path: '**', redirectTo: 'login' },
];
