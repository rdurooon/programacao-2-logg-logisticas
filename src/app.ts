import express from 'express';
import cors from 'cors';
import routes from './routes';
import { AppError } from './types';

const app = express();

app.set('query parser', 'extended');

// Middleware
app.use(cors());
app.use(express.json({ limit: '12mb' }));

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }
  if (error && typeof error === 'object' && 'status' in error && error.status === 413) {
    res.status(413).json({ message: 'O payload excede o limite permitido' });
    return;
  }
  if (error && typeof error === 'object' && 'status' in error && error.status === 400) {
    res.status(400).json({ message: 'JSON inválido' });
    return;
  }
  res.status(500).json({ message: 'Erro interno do servidor' });
});

export default app;