import serverless from 'serverless-http';
import { app, ensureDbInitialized } from '../../apiApp';

const serverlessHandler = serverless(app);

export const handler = async (event: any, context: any) => {
  try {
    await ensureDbInitialized();
  } catch (err) {
    console.error('Netlify function DB init error:', err);
  }

  return serverlessHandler(event, context);
};
