const DEVELOPMENT_ORIGIN = 'http://localhost:3000';

function getConfiguredOrigins(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const configured = process.env.CORS_ORIGINS;
  if (configured?.trim()) return configured;
  if (!isProduction) return process.env.FRONTEND_URL || DEVELOPMENT_ORIGIN;
  throw new Error('CORS_ORIGINS deve conter ao menos uma origem autorizada em produção.');
}

export function getAllowedCorsOrigins(): string[] {
  const origins = getConfiguredOrigins()
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  if (!origins.length) throw new Error('CORS_ORIGINS deve conter ao menos uma origem autorizada.');

  const normalizedOrigins = origins.map(origin => {
    if (origin === '*') throw new Error('CORS_ORIGINS não pode conter * para uma API autenticada.');
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`Origem CORS inválida: ${origin}`);
    }

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error(`Origem CORS inválida: ${origin}`);
    }

    return url.origin;
  });

  return [...new Set(normalizedOrigins)];
}

export function getCorsAllowCredentials(): boolean {
  return process.env.CORS_ALLOW_CREDENTIALS === 'true';
}

export function getHttpCorsOptions() {
  const allowedOrigins = getAllowedCorsOrigins();
  return {
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error('Origem não autorizada por CORS'));
    },
    credentials: getCorsAllowCredentials(),
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Chat-Token'],
    maxAge: 86400,
  };
}

export function getSocketCorsOptions() {
  return {
    origin: getAllowedCorsOrigins(),
    credentials: getCorsAllowCredentials(),
    methods: ['GET', 'POST'],
  };
}
