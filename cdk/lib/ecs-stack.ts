import {
  CfnOutput,
  Construct,
  Stack,
  StackProps,
  Duration,
  RemovalPolicy,
} from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import * as ecr from "@aws-cdk/aws-ecr";
import * as ecs_patterns from "@aws-cdk/aws-ecs-patterns";
import { DockerImageAsset } from "@aws-cdk/aws-ecr-assets";
import * as ecrdeploy from "cdk-ecr-deployment";
import * as iam from "@aws-cdk/aws-iam";
import * as path from "path";

export interface EcsAppConfig extends StackProps {
  name: string;
  repository: string;
  branch: string;
  commit: string;
  vpc_id: string;
  min_task: number;
  max_task: number;
  cpu: number;
  memory: number;
  container_port?: number;
  service_port?: number;
  alb?: boolean;
}

export class EcsStack extends Stack {
  public readonly appDns: CfnOutput;
  public readonly ecrRepo: ecr.Repository;
  public readonly ecsCluster: ecs.Cluster;
  public readonly ecsTask: ecs.TaskDefinition;
  public readonly ecsService: ecs_patterns.ApplicationLoadBalancedFargateService;

  constructor(scope: Construct, id: string, props: EcsAppConfig) {
    super(scope, id, props);

    // ECR repo for application
    const ecrRepo = new ecr.Repository(this, `${props.name}-ecr-repo`, {
      repositoryName: props.name,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Build application image
    const image = new DockerImageAsset(this, `${props.name}-image`, {
      directory: path.join(__dirname, `../${props.name}`),
    });

    // Upload application image to ECR repo
    new ecrdeploy.ECRDeployment(this, `${props.name}-ecr-image`, {
      src: new ecrdeploy.DockerImageName(image.imageUri),
      dest: new ecrdeploy.DockerImageName(
        `${ecrRepo.repositoryUri}:${props.commit}`
      ),
    });

    // ECS cluster
    const vpc = ec2.Vpc.fromLookup(this, "vpc", {
      vpcId: props.vpc_id,
    });

    const cluster = new ecs.Cluster(this, `${props.name}-ecs-cluster`, {
      vpc: vpc,
    });

    const logging = new ecs.AwsLogDriver({
      streamPrefix: props.name,
    });

    this.ecsCluster = cluster;

    // ECS task for application
    const taskRole = new iam.Role(this, `${props.name}-role`, {
      roleName: `${props.name}-role`,
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    const taskRolePolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ["*"],
      actions: [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
      ],
    });

    const taskDef = new ecs.FargateTaskDefinition(
      this,
      `${props.name}-ecs-task`,
      {
        taskRole: taskRole,
      }
    );

    taskDef.addToExecutionRolePolicy(taskRolePolicy);

    const container = taskDef.addContainer(props.name, {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepo, props.commit),
      memoryLimitMiB: props.memory,
      cpu: props.cpu,
      environment: { COMMIT: props.commit },
      logging,
    });

    if (props.container_port) {
      container.addPortMappings({
        containerPort: props.container_port,
        protocol: ecs.Protocol.TCP,
      });
    }

    this.ecsTask = taskDef;

    if (props.alb) {
      // ECS service for application
      const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
        this,
        `${props.name}-ecs-service`,
        {
          cluster: cluster,
          taskDefinition: taskDef,
          publicLoadBalancer: false,
          loadBalancerName: `${props.name}-alb`,
          listenerPort: props.service_port,
        }
      );

      const scaling = fargateService.service.autoScaleTaskCount({
        minCapacity: props.min_task,
        maxCapacity: props.max_task,
      });

      scaling.scaleOnCpuUtilization("CpuScaling", {
        targetUtilizationPercent: 50,
        scaleInCooldown: Duration.seconds(120),
        scaleOutCooldown: Duration.seconds(60),
      });

      scaling.scaleOnMemoryUtilization("MemoryScaling", {
        targetUtilizationPercent: 50,
        scaleInCooldown: Duration.seconds(120),
        scaleOutCooldown: Duration.seconds(60),
      });

      this.ecsService = fargateService;

      // Application DNS
      this.appDns = new CfnOutput(this, `${props.name}-dns`, {
        value: fargateService.loadBalancer.loadBalancerDnsName,
      });
    }
  }
}
