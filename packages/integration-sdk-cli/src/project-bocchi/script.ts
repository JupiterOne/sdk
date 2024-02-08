// // import yargs from 'yargs';
// // import * as fs from 'fs';
// //
// /**
// //  * Output folder (output/)
// //  * graph-<NAME>/
// //  *   docs/
// //  *   jupiterone/
// //  *   src/
// //  *     steps/
// //  *       fetch-users/
// //  *         - index.ts
// //  *       fetch-groups/
// //  *         - index.ts
// //  *       constants.ts
// //  *       converters.ts
// //  *       index.ts
// //  *     client.ts
// //  *     config.ts
// //  *     index.ts
// //  *     types.ts
// //  *   test/
// //  */
// //
// // export function run() {
// //   const input = yargs
// //     .option('h', {
// //       alias: 'help',
// //       type: 'boolean',
// //     })
// //     .option('template', {
// //       type: 'string',
// //       demandOption: true,
// //     }).argv as {
// //     help?: boolean;
// //     templateFile?: string;
// //     _: string[];
// //   };
// //
//   const { templateFile } = input;
// //
//   if (input.help || !templateFile) {
// //     return yargs.showHelp();
// //   }
// //
//   const template: Template = JSON.parse(fs.readFileSync(templateFile, 'utf8'));
// //
//   // TODO: check format of template
// //
//   // TODO: can build validate invocation - if fields are required and not there throw
// //
//   const instanceConfig = template.instanceConfigFields;
// //
//   // TODO:
// //   // build the output folder
// //   docs();
// //   jupiterone();
// //   src();
// //   test();
// // }
// //
// function docs() {
// //   // TODO: implement
// // }
// //
// function jupiterone() {
// //   // TODO: implement
// // }
// //
// function src() {
// //   // TODO: implement
// //   steps();
// // }
// //
// function steps() {
// //   for (const step of template.steps) {
// //     // run the ejs file and put the output in output/stepName
// //     switch () {
// //       case '':
// //     }
// //   }
// // }
// //
// function test() {
// //   // TODO: implement
// // }
// //
// // TODO:
// // function determineTypeOfStep(step: Step): StepType {
// //   if (step.parentAssociation) return 'fetch-child-entities';
// //   if (!step.parentAssociation) {
// //     if (step.response.responseType === 'SINGLETON') return 'singleton';
// //     return 'fetch-entities';
// //   }
// //   return 'fetch-relationships';
// // }
// //
