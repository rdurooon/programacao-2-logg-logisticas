import 'dotenv/config';
import app from './app';

if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32) {
  throw new Error('JWT_SECRET deve conter pelo menos 32 bytes');
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Endpoint: http://localhost:${PORT}`);
});