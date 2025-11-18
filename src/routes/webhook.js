import express from 'express';
import webhookController from '../controllers/webhookController.js';

const router = express.Router();

/**
 * POST /api/webhook
 * Endpoint principal para recibir webhooks de Tawk.to
 */
router.post('/webhook', (req, res) => {
  webhookController.handleTawkWebhook(req, res);
});

/**
 * POST /api/test
 * Endpoint de prueba para verificar el sistema sin Tawk.to
 */
router.post('/test', (req, res) => {
  webhookController.testEndpoint(req, res);
});

/**
 * GET /api/status
 * Endpoint para verificar el estado del sistema
 */
router.get('/status', (req, res) => {
  webhookController.statusEndpoint(req, res);
});

/**
 * GET /api/analytics
 * Endpoint para obtener analytics y métricas
 * Query params: period (daily|weekly), days (número de días)
 */
router.get('/analytics', (req, res) => {
  webhookController.analyticsEndpoint(req, res);
});

export default router;
