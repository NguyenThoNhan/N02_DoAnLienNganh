const required = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];

const validateEnv = () => {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing required env: ${missing.join(', ')}`);
    process.exit(1);
  }
};

module.exports = { validateEnv };
