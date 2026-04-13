process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'mysql://root:@localhost:3306/teacherhub_test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || '12345678901234567890123456789012';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:1604';
process.env.ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
process.env.REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || 'test-google-client-id.apps.googleusercontent.com';
