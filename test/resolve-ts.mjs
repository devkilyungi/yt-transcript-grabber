// Lets tests import lib modules whose own imports omit the .ts extension, as Next resolves them.
import { registerHooks } from 'node:module';
registerHooks({ resolve(spec, ctx, next) {
  try { return next(spec, ctx); } catch (e) { if (spec.startsWith('.') && e.code === 'ERR_MODULE_NOT_FOUND') return next(spec + '.ts', ctx); throw e; }
} });
