module.exports = projectName =>
  `name: ${projectName}
tasks:
  # The default task, invoke using \`api run start\`
  # Learn how to finish setting up Optic at http://docs.useoptic.com/setup
  start:
    command: export PORT=$OPTIC_API_PORT && npm run develop
    baseUrl: http://localhost:1337
ignoreRequests:
- OPTIONS *
-  /admin(.*)`;
