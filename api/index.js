// Vercel serverless function: every /api/* request is routed here (see vercel.json) and handled
// by the NestJS server, which is compiled to server/dist during the build.
module.exports = require('../server/dist/serverless.js').default;
