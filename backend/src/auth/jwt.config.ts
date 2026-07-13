export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET deve ser configurado com um valor aleatório de pelo menos 32 caracteres.');
  }
  return secret;
}
