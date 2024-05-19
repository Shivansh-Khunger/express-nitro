import { exec } from "node:child_process";
import fs from "node:fs";
import { Worker } from "node:worker_threads";

import x from "@helpers/db&Orms";
import { updatePackageScript } from "@helpers/db&Orms";
import addFmtAndLinterConfig from "@helpers/fmt&Linters";
import handleAdditionalOptions from "@helpers/handleOptions";
import { parseArgs, startUserInteraction } from "@utils/cli";

import type {
    T_Arg_HandleArgs,
    T_Arg_HandleCli,
} from "./types/dependencyInstallers";
import type { T_UserInput } from "./types/prompt";

const cwd = process.cwd();
let filePathArr: string[];
export let projectDirPath: string;

if (process.platform === "win32") {
    filePathArr = __dirname.split("\\");
    filePathArr.pop();
    projectDirPath = filePathArr.join("\\");
} else {
    filePathArr = __dirname.split("/");
    filePathArr.pop();
    projectDirPath = filePathArr.join("/");
}

(async () => {
    const parsedArgs = parseArgs();

    if (!parsedArgs) {
        const userInputCli = await startUserInteraction();

        handleLogic(userInputCli);
    } else {
        handleLogic(parsedArgs);
    }
})();

function copyTemplate(targetPath: string, targetTemplate: string) {
    try {
        const templatePath = `${projectDirPath}/templates/${targetTemplate}`;
        fs.cpSync(templatePath, targetPath, { recursive: true });
    } catch (err) {
        console.log(err);
    }
}

async function intialiseGitRepo(targetPath: string) {
    const intialiseCmd = "git init";
    exec(intialiseCmd, { cwd: targetPath }, (err) => {
        if (err) {
        }
    });
}

function installDependecies(targetPath: string, userInput: T_UserInput) {
    let installCmd: string;
    const dependencyCmd = "npm i express pino pino-http pino-pretty";
    let devDependencyCmd: string;

    const installWorkerPath = `${projectDirPath}/dist/utils/installWorker.js`;
    function handleArgs({ installCmd, targetPath }: T_Arg_HandleArgs) {
        const installWorker = new Worker(installWorkerPath, {
            workerData: {
                installCmd,
                targetPath,
            },
        });

        installWorker.on("exit", (code) => {
            if (code === 0) {
                updatePackageScript(targetPath);
            }
        });
    }

    function handleCli({
        userInput,
        dependencyCmd,
        devDependencyCmd,
        targetPath,
    }: T_Arg_HandleCli) {
        const installCmd = handleAdditionalOptions(
            userInput,
            dependencyCmd,
            devDependencyCmd,
        );

        const installWorker = new Worker(installWorkerPath, {
            workerData: {
                installCmd,
                targetPath,
            },
        });

        installWorker.on("exit", (code) => {
            if (code === 0) {
                updatePackageScript(targetPath);
            }
        });

        addFmtAndLinterConfig(
            userInput.formatterAndLinter,
            targetPath,
            projectDirPath,
        );

        if (userInput.wantDb) {
            x(userInput, projectDirPath, targetPath);
        }
    }

    switch (userInput.template) {
        case "express/js":
            {
                devDependencyCmd = "npm i --save-dev @dotenvx/dotenvx nodemon";

                installCmd = `${dependencyCmd} && ${devDependencyCmd}`;
                if (userInput.type === "args") {
                    handleArgs({ installCmd, targetPath });
                } else {
                    handleCli({
                        userInput,
                        dependencyCmd,
                        devDependencyCmd,
                        targetPath,
                    });
                }
            }
            break;
        case "express/ts":
            {
                devDependencyCmd =
                    "npm i --save-dev tsx typescript @dotenvx/dotenvx @types/express @types/node";

                installCmd = `${dependencyCmd} && ${devDependencyCmd}`;
                if (userInput.type === "args") {
                    handleArgs({ installCmd, targetPath });
                } else {
                    handleCli({
                        userInput,
                        dependencyCmd,
                        devDependencyCmd,
                        targetPath,
                    });
                }
            }
            break;
        default:
            break;
    }
}

export function rollBack(targetPath: string) {
    try {
        fs.rmdirSync(targetPath);
    } catch (err) {
        // TODO -> handle errors
    }
}

async function handleLogic(userInput: T_UserInput) {
    try {
        const targetPath = `${cwd}/${userInput.dirName}`;
        copyTemplate(targetPath, userInput.template);

        installDependecies(targetPath, userInput);

        intialiseGitRepo(targetPath);
    } catch (err) {}
}