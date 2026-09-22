/**
 * ==============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) MANAGEMENT SYSTEM
 * Enterprise PM2 Multi-Core Clustering & Process Management
 * ==============================================================================
 * 
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js   # Zero-downtime rolling restart
 *   pm2 status
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'gms-portal-cluster',
      cwd: './apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000 -H 0.0.0.0',
      
      // Spawn 1 worker per CPU core to maximize multi-threading
      instances: 'max',
      exec_mode: 'cluster',
      
      // Zero-downtime rolling reload configuration
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,
      
      // Auto-restart if memory footprint exceeds 1024MB (leak prevention)
      max_memory_restart: '1024M',
      
      // Exponential backoff restart to prevent crash loops
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      
      // V8 garbage collector and memory optimization flags
      node_args: [
        '--max-old-space-size=4096',
        '--enable-source-maps=false',
      ],
      
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
    },
  ],
};
