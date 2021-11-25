#!/usr/bin/env node
import "source-map-support/register";
import { exec } from "child_process";
import simpleGit, { SimpleGit } from "simple-git";
import { App } from "@aws-cdk/core";
import { LambdaStack, LambdaAppConfig } from "../lib/lambda-stack";

const tempCodeDir = "codes";

const app = new App();

const lambdaAppConfig: LambdaAppConfig = {
  repository: "https://github.com/jc1518/S2S-Lambda-Sample",
  branch: "demo",
  runtime: "nodejs_14_x",
  handler: "index.handler",
  apiGateway: true,
  codedir: tempCodeDir,
};

async function sourceCode(repo: string, branch: string, codedir: string) {
  const git: SimpleGit = simpleGit();
  await git.clone(repo, codedir);
  const clonedRepo = simpleGit(codedir);
  await clonedRepo.checkout(branch);
}

async function createLambda(config: LambdaAppConfig) {
  await sourceCode(config.repository, config.branch, config.codedir);
  new LambdaStack(app, "LambdaStack", config);
}

async function lambdaPattern() {
  await createLambda(lambdaAppConfig);
  exec("rm -rf codes");
}

lambdaPattern();
