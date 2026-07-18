import { getJwtSecret } from './jwt.config';

describe('getJwtSecret', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('retorna o segredo quando tem 32+ caracteres', () => {
    process.env.JWT_SECRET = 'a'.repeat(32);
    expect(getJwtSecret()).toBe('a'.repeat(32));
  });

  it('remove espaços em branco nas pontas', () => {
    process.env.JWT_SECRET = `  ${'b'.repeat(32)}  `;
    expect(getJwtSecret()).toBe('b'.repeat(32));
  });

  it('lança erro quando o segredo tem menos de 32 caracteres', () => {
    process.env.JWT_SECRET = 'muito_curto';
    expect(() => getJwtSecret()).toThrow('pelo menos 32 caracteres');
  });

  it('lança erro quando o segredo não está definido', () => {
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecret()).toThrow('pelo menos 32 caracteres');
  });
});
