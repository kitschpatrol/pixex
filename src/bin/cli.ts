#!/usr/bin/env node

import { log, setDefaultLogOptions } from 'lognow'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { bin, version } from '../../package.json' with { type: 'json' }
import { setLogger } from '../lib'

setLogger(log)

const cliCommandName = Object.keys(bin).at(0)!
const yargsInstance = yargs(hideBin(process.argv))

await yargsInstance
	.scriptName(cliCommandName)
	.usage('$0 [command]', `Run a ${cliCommandName} command.`)
	.option('verbose', {
		default: false,
		description: 'Run with verbose logging',
		type: 'boolean',
	})
	.middleware((argv) => {
		// Set log level globally based on verbose flag
		setDefaultLogOptions({ verbose: argv.verbose })
	})
	.command(
		'$0',
		'Pixelmator Pro export automation. (CLI commands are coming soon — use the TypeScript API for now.)',
		() => {
			// Options go here
		},
		() => {
			log.debug('Running command...')
			process.stdout.write('pixex: CLI commands are coming soon. Use the TypeScript API for now.\n')
		},
	)
	.alias('h', 'help')
	.version(version)
	.alias('v', 'version')
	.help()
	.strict()
	.wrap(process.stdout.isTTY ? Math.min(120, yargsInstance.terminalWidth()) : 0)
	.parse()
