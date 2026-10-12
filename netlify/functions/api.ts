import serverless from 'serverless-http';
import app from '../../server/app';

// Expõe todas as rotas /api/* do Express como uma Netlify Function.
export const handler = serverless(app);
