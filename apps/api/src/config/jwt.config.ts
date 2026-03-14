import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  // Tiempos en segundos (número) para evitar problemas de tipos con la librería ms
  expiresInSeconds: parseInt(process.env.JWT_EXPIRES_IN_SECONDS ?? '900', 10),     // 15 min
  refreshExpiresInDays: parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? '30', 10), // 30 días
  // Issuer y audience para evitar que JWTs de otros servicios sean aceptados
  issuer: process.env.JWT_ISSUER ?? 'trainr-api',
  audience: process.env.JWT_AUDIENCE ?? 'trainr-app',
}));
