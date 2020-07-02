'use strict';

const { join } = require('path');
const fse = require('fs-extra');
const chalk = require('chalk');
const execa = require('execa');
const ora = require('ora');
const _ = require('lodash');

const stopProcess = require('./utils/stop-process');
const { trackUsage, captureStderr } = require('./utils/usage');
const packageJSON = require('./resources/json/package.json');
const databaseJSON = require('./resources/json/database.json.js');
const opticConfig = require('./resources/files/config/optic.js');

module.exports = async function createProject(scope, { client, connection, dependencies }) {
  console.log('Creating files.');

  const { rootPath } = scope;
  const resources = join(__dirname, 'resources');

  try {
    // copy files
    await fse.copy(join(resources, 'files'), rootPath);

    // copy dot files
    const dotFiles = await fse.readdir(join(resources, 'dot-files'));
    await Promise.all(
      dotFiles.map(name => {
        return fse.copy(join(resources, 'dot-files', name), join(rootPath, `.${name}`));
      })
    );

    await trackUsage({ event: 'didCopyProjectFiles', scope });

    // copy templates
    await fse.writeJSON(
      join(rootPath, 'package.json'),
      packageJSON({
        strapiDependencies: scope.strapiDependencies,
        additionalsDependencies: dependencies,
        strapiVersion: scope.strapiVersion,
        projectName: _.kebabCase(scope.name),
        uuid: scope.uuid,
        apidocs: scope.apidocs,
      }),
      {
        spaces: 2,
      }
    );

    await trackUsage({ event: 'didWritePackageJSON', scope });

    // ensure node_modules is created
    await fse.ensureDir(join(rootPath, 'node_modules'));

    await fse.writeFile(
      join(rootPath, `config/database.js`),
      databaseJSON({
        client,
        connection,
      })
    );

    await trackUsage({ event: 'didCopyConfigurationFiles', scope });
  } catch (err) {
    await fse.remove(scope.rootPath);
    throw err;
  }

  if (scope.apidocs) {
    try {
      await fse.writeFile(join(rootPath, 'optic.yml'), opticConfig(_.kebabCase(scope.name)));
    } catch (error) {
      console.error(`${chalk.red('Error')} while writing optic.yml for apidocs`);
      await fse.remove(rootPath);
      throw error;
    }
  }

  await trackUsage({ event: 'willInstallProjectDependencies', scope });

  const installPrefix = chalk.yellow('Installing dependencies:');
  const loader = ora(installPrefix).start();

  const logInstall = (chunk = '') => {
    loader.text = `${installPrefix} ${chunk
      .toString()
      .split('\n')
      .join(' ')}`;
  };

  try {
    if (scope.installDependencies !== false) {
      const runner = runInstall(scope);

      runner.stdout.on('data', logInstall);
      runner.stderr.on('data', logInstall);

      await runner;
    }

    loader.stop();
    console.log(`Dependencies installed ${chalk.green('successfully')}.`);

    await trackUsage({ event: 'didInstallProjectDependencies', scope });
  } catch (error) {
    loader.stop();
    await trackUsage({
      event: 'didNotInstallProjectDependencies',
      scope,
      error: error.stderr.slice(-1024),
    });

    console.error(`${chalk.red('Error')} while installing dependencies:`);
    console.error(error.stderr);

    await captureStderr('didNotInstallProjectDependencies', error);

    console.log(chalk.black.bgWhite(' Keep trying!             '));
    console.log();
    console.log(
      chalk.bold(
        'Oh, it seems that you encountered errors while installing dependencies in your project.'
      )
    );
    console.log(`Don't give up, your project was created correctly.`);
    console.log(
      `Fix the issues mentionned in the installation errors and try to run the following command:`
    );
    console.log();
    console.log(
      `cd ${chalk.green(rootPath)} && ${chalk.cyan(scope.useYarn ? 'yarn' : 'npm')} install`
    );
    console.log();

    stopProcess();
  }

  await trackUsage({ event: 'didCreateProject', scope });

  console.log();
  console.log(`Your application was created at ${chalk.green(rootPath)}.\n`);

  const cmd = chalk.cyan(scope.useYarn ? 'yarn' : 'npm run');

  console.log('Available commands in your project:');
  console.log();
  console.log(`  ${cmd} develop`);
  console.log('  Start Strapi in watch mode.');
  console.log();
  console.log(`  ${cmd} start`);
  console.log('  Start Strapi without watch mode.');
  console.log();
  console.log(`  ${cmd} build`);
  console.log('  Build Strapi admin panel.');
  console.log();
  console.log(`  ${cmd} strapi`);
  console.log(`  Display all available commands.`);
  console.log();
  if (scope.apidocs) {
    console.log(`  ${cmd} monitor`);
    console.log(
      `  Start Strapi with Optic monitoring all requests to automatically generate documentation.`
    );
    console.log();
    console.log(`  ${cmd} spec`);
    console.log(`  Display current documentation specifications.`);
    console.log();
  }
  console.log('You can start by doing:');
  console.log();
  console.log(`  ${chalk.cyan('cd')} ${rootPath}`);
  console.log(`  ${cmd} develop`);
  console.log();
};

const installArguments = ['install', '--production', '--no-optional'];
function runInstall({ rootPath, useYarn }) {
  if (useYarn) {
    return execa('yarnpkg', installArguments, {
      cwd: rootPath,
      stdin: 'ignore',
    });
  }

  return execa('npm', installArguments, { cwd: rootPath, stdin: 'ignore' });
}
