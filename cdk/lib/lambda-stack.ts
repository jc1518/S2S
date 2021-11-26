import * as apigw from "@aws-cdk/aws-apigateway";
import * as lambda from "@aws-cdk/aws-lambda";
import { Construct, Stack, StackProps } from "@aws-cdk/core";
import { error } from "console";
import * as path from "path";

export interface LambdaAppConfig extends StackProps {
  name: string;
  repository: string;
  branch: string;
  runtime: string;
  handler: string;
  api: boolean;
  scheduler?: string;
}

export class LambdaStack extends Stack {
  repository: string;
  branch: string;
  codeDir: string;

  constructor(scope: Construct, id: string, props: LambdaAppConfig) {
    super(scope, id, props);

    let appRuntime = lambda.Runtime.NODEJS;
    switch (props.runtime) {
      case "python_3_9": {
        appRuntime = lambda.Runtime.PYTHON_3_9;
        break;
      }
      case "nodejs_14_x": {
        appRuntime = lambda.Runtime.NODEJS_14_X;
        break;
      }
      default: {
        throw error(`${props.runtime} is not supported.`);
      }
    }

    const handler = new lambda.Function(this, "Lambda", {
      runtime: appRuntime,
      handler: props.handler,
      code: lambda.Code.fromAsset(path.join(__dirname, `../${props.name}`)),
    });

    if (props.api) {
      const gw = new apigw.LambdaRestApi(this, "Gateway", {
        handler,
      });
    }
  }
}
