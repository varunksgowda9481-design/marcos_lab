const Joi = require('joi');

function validateEnv() {
  const envVarsSchema = Joi.object({
    NODE_ENV: Joi.string()
      .valid('development', 'production', 'test')
      .default('development')
      .description('Node environment'),
    
    PORT: Joi.number()
      .default(3001)
      .description('Port to run the server on'),
    
    DB_HOST: Joi.string()
      .required()
      .description('Database host'),
    
    DB_USER: Joi.string()
      .required()
      .description('Database user'),
    
    DB_PASSWORD: Joi.string()
      .required()
      .description('Database password'),
    
    DB_NAME: Joi.string()
      .required()
      .description('Database name'),
    
    JWT_SECRET: Joi.string()
      .min(32)
      .required()
      .description('JWT secret key for token signing'),
    
    API_URL: Joi.string()
      .uri()
      .default('http://localhost:3001')
      .description('API base URL'),
    
    FRONTEND_URL: Joi.string()
      .uri()
      .default('http://localhost:3000')
      .description('Frontend URL for CORS')
  }).unknown();

  const { value: envVars, error } = envVarsSchema.validate(process.env, {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: true
  });

  if (error) {
    const errorMessages = error.details.map(detail => {
      return `- ${detail.message}`;
    }).join('\n');
    
    throw new Error(`Environment validation failed:\n${errorMessages}`);
  }

  return envVars;
}

module.exports = validateEnv;
