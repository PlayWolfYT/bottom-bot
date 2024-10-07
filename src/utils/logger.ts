import winston from 'winston';
import chalk from 'chalk';
import { env } from 'process';
import path from 'path';

const TOTAL_LEVEL_WIDTH = 7;
const TOTAL_SECTION_WIDTH = 20;

// Create custom logger
const defaultLogger = winston.createLogger({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, section, subModule }) => {
      const coloredLevel = level === 'error' ? chalk.red :
        level === 'warn' ? chalk.yellow :
          level === 'info' ? chalk.green :
            chalk.blue;
      const centeredLevel = (level: string) => {
        const upperLevel = level.toUpperCase();
        const totalWidth = TOTAL_LEVEL_WIDTH;
        const padding = totalWidth - upperLevel.length;
        const leftPad = Math.floor(padding / 2);
        const rightPad = Math.ceil(padding / 2);
        return ' '.repeat(leftPad) + upperLevel + ' '.repeat(rightPad);
      };
      const paddedSection = section.padEnd(TOTAL_SECTION_WIDTH);

      const subModuleText = subModule ? chalk.magenta(subModule.toUpperCase()) : '';

      return `${chalk.gray(timestamp)} [${subModuleText}][${coloredLevel(centeredLevel(level))}][${chalk.cyan(paddedSection)}] ${coloredLevel(message)}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

// Helper function for logging
export class Logger {
  private readonly section: string;
  private readonly submodule: string;

  constructor(section?: string) {
    // Extract the caller's file path from the stack trace
    const stack = new Error().stack;
    if (stack) {
      const stackLines = stack.split('\n');
      let callerLine: string | undefined;

      // Skip lines until we find a line that doesn't include this file's path
      for (let i = 2; i < stackLines.length; i++) {
        const line = stackLines[i];
        if (!line.includes(__filename)) {
          callerLine = line;
          break;
        }
      }

      if (callerLine) {
        let match = callerLine.match(/\((.*):\d+:\d+\)/);
        if (!match) {
          // Handle stack traces without parentheses
          match = callerLine.match(/at (.*):\d+:\d+/);
        }
        if (match && match[1]) {
          const fullPath = match[1];
          let relativePath = path.relative(process.cwd(), fullPath);

          // Normalize path separators to forward slashes
          relativePath = relativePath.replace(/\\/g, '/');

          // Remove 'src/' prefix regardless of path separators
          relativePath = relativePath.replace(/^src\//, '');

          // Extract and remove the submodule
          const subModule = relativePath.split('/')[0];
          if (subModule) {
            this.submodule = subModule;
            relativePath = relativePath.replace(`${this.submodule}/`, '');
          } else {
            this.submodule = 'unknown';
          }

          // Remove file extension
          relativePath = relativePath.replace(/\.[^/.]+$/, '');

          this.section = relativePath;
        } else {
          this.section = 'unknown';
          this.submodule = 'unknown';
        }
      } else {
        this.section = 'unknown';
        this.submodule = 'unknown';
      }
    } else {
      this.section = 'unknown';
      this.submodule = 'unknown';
    }

    if (section) {
      this.section = section;
    }
  }

  debug(message: string) {
    defaultLogger.log('debug', message, { section: this.section, subModule: this.submodule });
  }
  info(message: string) {
    defaultLogger.log('info', message, { section: this.section, subModule: this.submodule });
  }
  warn(message: string) {
    defaultLogger.log('warn', message, { section: this.section, subModule: this.submodule });
  }
  error(message: string) {
    defaultLogger.log('error', message, { section: this.section, subModule: this.submodule });
  }

  subLogger(subSection: string) {
    return new Logger(this.section + '/' + subSection);
  }
}

export default Logger;
