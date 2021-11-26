#!/usr/bin/env node
import "source-map-support/register";
import { exec } from "child_process";
import simpleGit, { SimpleGit } from "simple-git";
import { App } from "@aws-cdk/core";
import { LambdaStack, LambdaAppConfig } from "../lib/lambda-stack";
import { EcsStack, EcsAppConfig } from "../lib/ecs-stack";
import * as lambdaPatternConfig from "../lambda-pattern.json";
import * as ecsPatternConfig from "../ecs-pattern.json";

const app = new App();

const appEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const lambdaAppConfig: LambdaAppConfig = {
  name: lambdaPatternConfig.name,
  repository: lambdaPatternConfig.repository,
  branch: lambdaPatternConfig.branch,
  runtime: lambdaPatternConfig.runtime,
  handler: lambdaPatternConfig.handler,
  api: lambdaPatternConfig.api,
  env: appEnv,
};

const ecsAppConfig: EcsAppConfig = {
  name: ecsPatternConfig.name,
  repository: ecsPatternConfig.repository,
  branch: ecsPatternConfig.branch,
  commit: ecsPatternConfig.commit,
  vpc_id: ecsPatternConfig.vpc_id,
  min_task: ecsPatternConfig.min_task,
  max_task: ecsPatternConfig.max_task,
  cpu: ecsPatternConfig.cpu,
  memory: ecsPatternConfig.memory,
  container_port: ecsPatternConfig.container_port,
  service_port: ecsPatternConfig.service_port,
  alb: ecsPatternConfig.alb,
  env: appEnv,
};

async function sourceCode(
  repo: string,
  branch: string,
  codedir: string,
  commit?: string
) {
  const git: SimpleGit = simpleGit();
  await git.clone(repo, codedir);
  const clonedRepo = simpleGit(codedir);
  await clonedRepo.checkout(branch);
  if (commit) {
    await clonedRepo.checkout(commit);
  }
}

async function createLambda(config: LambdaAppConfig) {
  await sourceCode(config.repository, config.branch, config.name);
  new LambdaStack(app, config.name, config);
}

async function lambdaPattern(config: LambdaAppConfig) {
  await createLambda(config);
  exec(`rm -rf ${config.name}`);
}

async function createEcs(config: EcsAppConfig) {
  await sourceCode(
    config.repository,
    config.branch,
    config.name,
    config.commit
  );
  new EcsStack(app, config.name, config);
}

async function ecsPattern(config: EcsAppConfig) {
  await createEcs(config);
  exec(`rm -rf ${config.name}`);
}

lambdaPattern(lambdaAppConfig);

ecsPattern(ecsAppConfig);
