describe('cors config', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  function load() {
    return require('./cors');
  }

  describe('getAllowedCorsOrigins', () => {
    it('usa CORS_ORIGINS quando definida', () => {
      process.env.CORS_ORIGINS = 'https://loja.com,https://admin.loja.com';
      const { getAllowedCorsOrigins } = load();
      expect(getAllowedCorsOrigins()).toEqual(['https://loja.com', 'https://admin.loja.com']);
    });

    it('remove duplicatas e espaços em branco', () => {
      process.env.CORS_ORIGINS = ' https://loja.com , https://loja.com ,https://loja.com';
      const { getAllowedCorsOrigins } = load();
      expect(getAllowedCorsOrigins()).toEqual(['https://loja.com']);
    });

    it('cai para FRONTEND_URL em desenvolvimento quando CORS_ORIGINS não definida', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.CORS_ORIGINS;
      process.env.FRONTEND_URL = 'http://localhost:4000';
      const { getAllowedCorsOrigins } = load();
      expect(getAllowedCorsOrigins()).toEqual(['http://localhost:4000']);
    });

    it('cai para o default de desenvolvimento quando nada está configurado', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.CORS_ORIGINS;
      delete process.env.FRONTEND_URL;
      const { getAllowedCorsOrigins } = load();
      expect(getAllowedCorsOrigins()).toEqual(['http://localhost:3000']);
    });

    it('lança erro em produção quando CORS_ORIGINS não está definida', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.CORS_ORIGINS;
      const { getAllowedCorsOrigins } = load();
      expect(() => getAllowedCorsOrigins()).toThrow();
    });

    it('rejeita "*" como origem', () => {
      process.env.CORS_ORIGINS = '*';
      const { getAllowedCorsOrigins } = load();
      expect(() => getAllowedCorsOrigins()).toThrow('CORS_ORIGINS não pode conter *');
    });

    it('rejeita origem com caminho, credenciais ou protocolo inválido', () => {
      const { getAllowedCorsOrigins } = load();

      process.env.CORS_ORIGINS = 'https://loja.com/checkout';
      expect(() => getAllowedCorsOrigins()).toThrow('Origem CORS inválida');

      process.env.CORS_ORIGINS = 'https://user:pass@loja.com';
      expect(() => getAllowedCorsOrigins()).toThrow('Origem CORS inválida');

      process.env.CORS_ORIGINS = 'ftp://loja.com';
      expect(() => getAllowedCorsOrigins()).toThrow('Origem CORS inválida');
    });
  });

  describe('getCorsAllowCredentials', () => {
    it('só é true quando a variável é exatamente "true"', () => {
      const { getCorsAllowCredentials } = load();

      process.env.CORS_ALLOW_CREDENTIALS = 'true';
      expect(getCorsAllowCredentials()).toBe(true);

      process.env.CORS_ALLOW_CREDENTIALS = 'yes';
      expect(getCorsAllowCredentials()).toBe(false);

      delete process.env.CORS_ALLOW_CREDENTIALS;
      expect(getCorsAllowCredentials()).toBe(false);
    });
  });

  describe('getHttpCorsOptions', () => {
    it('permite origem autorizada e rejeita não autorizada', () => {
      process.env.CORS_ORIGINS = 'https://loja.com';
      const { getHttpCorsOptions } = load();
      const options = getHttpCorsOptions();

      const permitido = jest.fn();
      options.origin('https://loja.com', permitido);
      expect(permitido).toHaveBeenCalledWith(null, true);

      const negado = jest.fn();
      options.origin('https://outra-origem.com', negado);
      expect(negado).toHaveBeenCalledWith(expect.any(Error));
    });

    it('permite requisições sem origem (ex.: server-to-server)', () => {
      process.env.CORS_ORIGINS = 'https://loja.com';
      const { getHttpCorsOptions } = load();
      const options = getHttpCorsOptions();

      const callback = jest.fn();
      options.origin(undefined, callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });
  });
});
