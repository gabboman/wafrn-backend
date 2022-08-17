const swaggerAutogen = require('swagger-autogen');
const environment = require('./environment.json');

const config = {
  info: {
    version: '0.0.2',
    title: 'WAFRN Backend',
    description: 'API routes for wafrn social network',
  },
  host: `0.0.0.0:${environment.port}`,
  schemes: ['http'],
  securityDefinitions: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
  },
};

const files = [
  './index.ts',
  './routes/blocks.ts',
  './routes/follows.ts',
  './routes/media.ts',
  './routes/notifications.ts',
  './routes/posts.ts',
  './routes/search.ts',
  './routes/users.ts',
];

swaggerAutogen({openapi: '3.0.0'})('./swagger.json', files, config);
