export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

export interface ApiErrorResponse {
  success?: false;
  error: string;
  code?: string;
  details?: unknown;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface HealthCheckResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  environment: {
    nodeEnv: string | undefined;
    hasDatabaseUrl: boolean;
    hasJwtSecret: boolean;
    hasSupabaseUrl: boolean;
  };
  database: {
    connected: boolean;
    sslEnabled: boolean;
    latencyMs: number | null;
    error: string | null;
    tables: {
      users?: boolean;
      faculties?: boolean;
      departments?: boolean;
      programmes?: boolean;
      sections?: boolean;
      loginAttempts?: boolean;
      auditLogs?: boolean;
    };
    hasCurrentSessionIdColumn?: boolean;
    adminAccount: {
      exists: boolean;
      email?: string;
      role?: string;
      isActive?: boolean;
      setupBlocked?: boolean;
      message?: string;
      created?: boolean;
      error?: string;
    };
  };
}
