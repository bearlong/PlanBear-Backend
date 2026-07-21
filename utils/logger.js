import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({ format: winston.format.simple() })
  );
} else {
  logger.add(new winston.transports.File({ filename: 'logs/app.log' }));
}

export default logger;
