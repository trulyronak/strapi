'use strict';

/**
 * Expose main package JSON of the application
 * with basic info, dependencies, etc.
 */

module.exports = opts => {
  const {
    strapiDependencies,
    additionalsDependencies,
    strapiVersion,
    projectName,
    uuid,
    apidocs,
  } = opts;

  // Finally, return the JSON.
  return {
    name: projectName,
    private: true,
    version: '0.1.0',
    description: 'A Strapi application',
    scripts: {
      develop: 'strapi develop',
      start: 'strapi start',
      build: 'strapi build',
      strapi: 'strapi',
      ...(apidocs && { monitor: 'api start' }),
      ...(apidocs && { spec: 'api spec' }),
    },
    devDependencies: {},
    dependencies: Object.assign(
      {},
      strapiDependencies.reduce((acc, key) => {
        acc[key] = strapiVersion;
        return acc;
      }, {}),
      additionalsDependencies,
      { ...(apidocs && { '@useoptic/cli': 'latest' }) }
    ),
    author: {
      name: 'A Strapi developer',
    },
    strapi: {
      uuid: uuid,
    },
    engines: {
      node: '>=10.0.0',
      npm: '>=6.0.0',
    },
    license: 'MIT',
  };
};
